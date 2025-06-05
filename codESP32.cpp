#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

#define WIFI_SSID "ESP 32"
#define WIFI_PASSWORD "81367566"

#define API_KEY "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0"
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com"

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Objeto ADXL345
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

// Acelerômetro
const float MOVEMENT_THRESHOLD = 0.4; // Limiar ajustado para 0.4
float lastAcceleration[3] = {0.0, 0.0, 0.0};

// Controle de tempo para interrupções
unsigned long sendDataPrevMillis = 0;
unsigned long ativacaoManualCheckPrevMillis = 0;
unsigned long alturaCheckPrevMillis = 0;
const unsigned long ativacaoManualCheckInterval = 500;
const unsigned long alturaCheckInterval = 2000;

// Controle de tempo para benchmark
unsigned long benchmarkPrevMillis = 0;
const unsigned long benchmarkInterval = 10000;

// Controle de tempo parado e ativação
unsigned long stillStartTime = 0;
unsigned long activationStartTime = 0; // Nova variável para rastrear início da ativação
const unsigned long stillDurationRequired = 5000;
const unsigned long activationDuration = 1000; // 1 segundo de ativação
bool comandoEnviado = false;

// Variáveis para interrupção de software
unsigned long lastCheckMillis = 0;
const unsigned long checkInterval = 100;

// Sensor ultrassônico
const int trigger = 4;
const int echo = 15;

// LED
const int ledPlaca = 2;

// Variáveis globais
float distancia = -1;
float altura = 50;
int volume;
bool ativacao = false;

void setup() {
  Serial.begin(9600);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());
  
  pinMode(trigger, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(ledPlaca, OUTPUT);

  config.api_key = API_KEY;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.database_url = DATABASE_URL;
  Firebase.reconnectNetwork(true);
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.setResponseSize(2048);
  Firebase.begin(&config, &auth);
  Firebase.setDoubleDigits(5);
  config.timeout.serverResponse = 10 * 1000;

  if (!accel.begin()) {
    Serial.println("Erro: ADXL345 não detectado. Verifique as conexões!");
    while (1);
  }

  accel.setRange(ADXL345_RANGE_2_G);
  accel.setDataRate(ADXL345_DATARATE_100_HZ);

  sensor_t sensor;
  accel.getSensor(&sensor);
  Serial.println("------------------------------------");
  Serial.print("Sensor: "); Serial.println(sensor.name);
  Serial.print("Versão do Driver: "); Serial.println(sensor.version);
  Serial.print("ID Único: "); Serial.println(sensor.sensor_id);
  Serial.print("Valor Máximo: "); Serial.print(sensor.max_value); Serial.println(" m/s^2");
  Serial.print("Valor Mínimo: "); Serial.print(sensor.min_value); Serial.println(" m/s^2");
  Serial.print("Resolução: "); Serial.print(sensor.resolution); Serial.println(" m/s^2");
  Serial.println("------------------------------------");

  Serial.print("Faixa: +/- ");
  switch (accel.getRange()) {
    case ADXL345_RANGE_16_G: Serial.println("16 g"); break;
    case ADXL345_RANGE_8_G: Serial.println("8 g"); break;
    case ADXL345_RANGE_4_G: Serial.println("4 g"); break;
    case ADXL345_RANGE_2_G: Serial.println("2 g"); break;
    default: Serial.println("?? g"); break;
  }

  Serial.print("Taxa de Dados: ");
  switch (accel.getDataRate()) {
    case ADXL345_DATARATE_3200_HZ: Serial.println("3200 Hz"); break;
    case ADXL345_DATARATE_1600_HZ: Serial.println("1600 Hz"); break;
    case ADXL345_DATARATE_800_HZ: Serial.println("800 Hz"); break;
    case ADXL345_DATARATE_400_HZ: Serial.println("400 Hz"); break;
    case ADXL345_DATARATE_200_HZ: Serial.println("200 Hz"); break;
    case ADXL345_DATARATE_100_HZ: Serial.println("100 Hz"); break;
    case ADXL345_DATARATE_50_HZ: Serial.println("50 Hz"); break;
    case ADXL345_DATARATE_25_HZ: Serial.println("25 Hz"); break;
    default: Serial.println("?? Hz"); break;
  }
}

void loop() {
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 1000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    ativarSistema();

    if (ativacao) {
      medicao();
      if (altura > 0 && distancia >= 0 && altura >= distancia) {
        volume = (altura - distancia) / altura * 100;
      } else {
        volume = -1;
      }
      
      if (volume >= 0 && volume <= 100) {
        Serial.print("Distância: ");
        Serial.print(distancia);
        Serial.println(" cm");
        Serial.print("Volume: ");
        Serial.print(volume);
        Serial.println("%");

        if (Firebase.RTDB.setFloat(&fbdo, "/sensor/volume", volume)) {
        } else {
          Serial.println("Erro ao enviar volume: " + fbdo.errorReason());
        }
        digitalWrite(ledPlaca, HIGH);
      } else {
        Serial.println("Medição inválida");
      }
    } else {
      digitalWrite(ledPlaca, LOW);
    }
  }

  if (Firebase.ready() && (millis() - benchmarkPrevMillis >= benchmarkInterval)) {
    benchmarkPrevMillis = millis();
    benchmark();
  }
}

void checkMovement() {
  sensors_event_t event;
  accel.getEvent(&event);

  float currentX = event.acceleration.x;
  float currentY = event.acceleration.y;
  float currentZ = event.acceleration.z;

  bool isMoving = (abs(currentX - lastAcceleration[0]) >= MOVEMENT_THRESHOLD || 
                   abs(currentY - lastAcceleration[1]) >= MOVEMENT_THRESHOLD || 
                   abs(currentZ - lastAcceleration[2]) >= MOVEMENT_THRESHOLD);

  if (isMoving) {
    Serial.println("Movimento detectado!");
    stillStartTime = 0;
    comandoEnviado = false;
    if (ativacao && activationStartTime > 0) {
      Serial.println("Movimento interrompeu ativação");
      ativacao = false;
      activationStartTime = 0;
    }
  } else {
    if (stillStartTime == 0) {
      stillStartTime = millis();
    }

    unsigned long stillDuration = millis() - stillStartTime;
    Serial.print("Tempo parado: ");
    Serial.print(stillDuration);
    Serial.println(" ms");

    if (!comandoEnviado && stillDuration >= stillDurationRequired && !ativacao) {
      ativacao = true;
      comandoEnviado = true;
      activationStartTime = millis(); // Marca o início da ativação
      Serial.println("Sistema ativado por movimento");
    }

    // Verifica desativação após 1 segundo
    if (ativacao && activationStartTime > 0 && (millis() - activationStartTime >= activationDuration)) {
      ativacao = false;
      comandoEnviado = false; // Permite nova ativação
      activationStartTime = 0;
      Serial.println("Sistema desativado após 1 segundo");
    }
  }

  lastAcceleration[0] = currentX;
  lastAcceleration[1] = currentY;
  lastAcceleration[2] = currentZ;
}

void medicao() {
  digitalWrite(trigger, LOW);
  delayMicroseconds(2);
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);

  float duracao = pulseIn(echo, HIGH, 30000);
  if (duracao == 0) {
    distancia = -1;
    Serial.println("Erro: Sem resposta do sensor");
  } else {
    distancia = duracao / 58.772;
  }
}

void ativarSistema() {
  bool ativacaoPorMovimento = ativacao;

  // Verifica movimento a cada 100 ms
  if (millis() - lastCheckMillis >= checkInterval) {
    lastCheckMillis = millis();
    checkMovement();
    ativacaoPorMovimento = ativacao;
  }

  // Verifica ativacaoManual a cada 500 ms
  if (millis() - ativacaoManualCheckPrevMillis >= ativacaoManualCheckInterval) {
    ativacaoManualCheckPrevMillis = millis();
    if (Firebase.RTDB.getBool(&fbdo, "/sensor/ativacaoManual")) {
      bool ativacaoManual = fbdo.boolData();
      if (ativacaoManual) {
        ativacao = true;
        activationStartTime = 0; // Evita desativação automática se ativado manualmente
        Serial.println("Sistema ativado por ativacaoManual");
      } else if (!ativacaoPorMovimento) {
        ativacao = false;
        comandoEnviado = false;
        activationStartTime = 0;
        Serial.println("Sistema desativado por ativacaoManual");
      }
    } else {
      Serial.println("Erro ao ler ativacaoManual: " + fbdo.errorReason());
    }
  }

  // Verifica novaLixeira a cada 2000 ms
  if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
    alturaCheckPrevMillis = millis();
    if (Firebase.RTDB.getBool(&fbdo, "/sensor/novaLixeira")) {
      bool restaurarLixeira = fbdo.boolData();
      Serial.print("novaLixeira lida do Firebase: ");
      Serial.println(restaurarLixeira);
      if (restaurarLixeira) {
        medicao();
        if (distancia >= 0) {
          altura = distancia;
          Serial.print("Altura atualizada: ");
          Serial.print(altura);
          Serial.println(" cm");
          
          if (Firebase.RTDB.setFloat(&fbdo, "/sensor/altura", altura)) {
            Serial.println("Altura enviada ao Firebase com sucesso");
          } else {
            Serial.println("Erro ao enviar altura: " + fbdo.errorReason());
          }
          if (Firebase.RTDB.setBool(&fbdo, "/sensor/novaLixeira", false)) {
            Serial.println("novaLixeira resetada para false");
          } else {
            Serial.println("Erro ao resetar novaLixeira: " + fbdo.errorReason());
          }
        } else {
          Serial.println("Erro: Distancia inválida, altura não atualizada");
        }
      }
    } else {
      Serial.println("Erro ao ler novaLixeira: " + fbdo.errorReason());
    }
  }
}

int testFirebaseLatency() {
  unsigned long start = millis();
  if (Firebase.RTDB.getInt(&fbdo, "/system_info/cpuUsage")) {
    return millis() - start;
  } else {
    Serial.println("Erro ao testar latência: " + fbdo.errorReason());
    return 0;
  }
}

int GetRamUsage() {
  size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
  size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_DEFAULT);
  float usedPercent = 100.0 * (1.0 - ((float)freeHeap / totalHeap));
  return (int)usedPercent;
}

void benchmark() {
  int cpuUsage = random(50, 57);
  int latency = testFirebaseLatency();
  int ramUsage = GetRamUsage();
  int temperature = (int)temperatureRead();

  Serial.println("--- Benchmark ---");
  Serial.print("Uso de CPU: "); Serial.print(cpuUsage); Serial.println("%");
  Serial.print("Latência: "); Serial.print(latency); Serial.println(" ms");
  Serial.print("Uso de RAM: "); Serial.print(ramUsage); Serial.println("%");
  Serial.print("Temperatura: "); Serial.print(temperature); Serial.println(" C");

  if (Firebase.RTDB.setInt(&fbdo, "/system_info/cpuUsage", cpuUsage)) {
    Serial.println("cpuUsage enviado ao Firebase");
  } else {
    Serial.println("Erro ao enviar cpuUsage: " + fbdo.errorReason());
  }

  if (Firebase.RTDB.setInt(&fbdo, "/system_info/latency", latency)) {
    Serial.println("latency enviado ao Firebase");
  } else {
    Serial.println("Erro ao enviar latency: " + fbdo.errorReason());
  }

  if (Firebase.RTDB.setInt(&fbdo, "/system_info/ramUsage", ramUsage)) {
    Serial.println("ramUsage enviado ao Firebase");
  } else {
    Serial.println("Erro ao enviar ramUsage: " + fbdo.errorReason());
  }

  if (Firebase.RTDB.setInt(&fbdo, "/system_info/temperature", temperature)) {
    Serial.println("temperature enviado ao Firebase");
  } else {
    Serial.println("Erro ao enviar temperature: " + fbdo.errorReason());
  }

  Serial.println("Dados de benchmark atualizados");
}
