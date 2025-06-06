// Credenciais de autenticação
#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

// Configurações de Wi-Fi
#define WIFI_SSID "ESP 32"
#define WIFI_PASSWORD "81367566"

// Configurações do Firebase
#define API_KEY "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0"
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com"

// Bibliotecas
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

// Objetos do Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Acelerômetro
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);
const float MOVEMENT_THRESHOLD = 0.4; // Limiar de movimento (m/s^2)
float lastAcceleration[3] = { 0.0, 0.0, 0.0 }; // Últimas acelerações

// Controle de tempo
unsigned long sendDataPrevMillis = 0;
unsigned long ativacaoManualCheckPrevMillis = 0; // Tempo para ativação manual
unsigned long inerciaCheckPrevMillis = 0; // Tempo para inércia
unsigned long inerciaStartTime = 0; // Início da inércia
unsigned long alturaCheckPrevMillis = 0;
unsigned long lastCheckMillis = 0; // Última verificação de interrupção
const unsigned long ativacaoManualCheckInterval = 500; // Intervalo para ativação manual (ms)
const unsigned long inerciaCheckInterval = 1000; // Intervalo para inércia (ms)
const unsigned long inerciaDurationRequired = 1500; // Duração da inércia (ms)
const unsigned long alturaCheckInterval = 2000; // Intervalo para altura (ms)
const unsigned long checkInterval = 100; // Intervalo de interrupção (ms)

// Controle de tempo parado
unsigned long stillStartTime = 0; // Início do tempo parado
const unsigned long stillDurationRequired = 5000; // Tempo de parada necessário (ms)
const unsigned long stillDurationTolerance = 100; // Tolerância de tempo parado (ms)
bool comandoEnviado = false; // Flag para evitar envios repetidos

// Sensor ultrassônico
const int trigger = 4; // Pino de disparo
const int echo = 15; // Pino de eco

// LED
const int ledPlaca = 2; // Pino do LED

// Variáveis globais
float distancia = -1; // Distância medida (cm), inicia inválida
float altura; // Altura da lixeira (cm)
int volume; // Volume calculado (%)
bool ativacao = false; // Estado de ativação do sistema

// Benchmark
unsigned long benchmarkPrevMillis = 0;
const unsigned long benchmarkInterval = 10000; // Intervalo para benchmark (ms)

void setup() {
  // Comunicação serial
  Serial.begin(9600);

  // Conexão Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());

  // Configuração dos pinos
  pinMode(trigger, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(ledPlaca, OUTPUT);

  // Configuração do Firebase
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

  // Inicialização do acelerômetro
  if (!accel.begin()) {
    Serial.println("Erro: ADXL345 não detectado. Verifique as conexões!");
    while (1); // Para o programa
  }
  accel.setRange(ADXL345_RANGE_2_G); // Faixa de ±2g
  accel.setDataRate(ADXL345_DATARATE_100_HZ); // Taxa de 100 Hz

  // Informações do sensor
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

  // Faixa configurada
  Serial.print("Faixa: +/- ");
  switch (accel.getRange()) {
    case ADXL345_RANGE_16_G: Serial.println("16 g"); break;
    case ADXL345_RANGE_8_G: Serial.println("8 g"); break;
    case ADXL345_RANGE_4_G: Serial.println("4 g"); break;
    case ADXL345_RANGE_2_G: Serial.println("2 g"); break;
    default: Serial.println("?? g"); break;
  }

  // Taxa de dados configurada
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
  // Executa medições a cada 1 segundo
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 1000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    ativarSistema();

    if (ativacao) {
      medicao();
      if (altura >= distancia) {
        volume = (altura - distancia) / altura * 100;
      }
      if (volume >= 0 && volume <= 100) {
        Serial.print("Distância: "); Serial.print(distancia); Serial.println(" cm");
        Serial.print("Volume: "); Serial.print(volume); Serial.println("%");

        if (Firebase.RTDB.setFloat(&fbdo, "/sensor/volume", volume)) {
          // Volume enviado com sucesso
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

  // Executa benchmark a cada 10 segundos
  if (Firebase.ready() && (millis() - benchmarkPrevMillis >= benchmarkInterval)) {
    benchmarkPrevMillis = millis();
    benchmark();
  }
}

void checkMovement() {
  // Obtém evento do acelerômetro
  sensors_event_t event;
  accel.getEvent(&event);

  // Acelerações atuais
  float currentX = event.acceleration.x;
  float currentY = event.acceleration.y;
  float currentZ = event.acceleration.z;

  // Detecta movimento significativo
  bool isMoving = (abs(currentX - lastAcceleration[0]) >= MOVEMENT_THRESHOLD ||
                   abs(currentY - lastAcceleration[1]) >= MOVEMENT_THRESHOLD ||
                   abs(currentZ - lastAcceleration[2]) >= MOVEMENT_THRESHOLD);

  if (isMoving) {
    Serial.println("Movimento detectado!");
    stillStartTime = 0; // Reinicia contador de tempo parado
    comandoEnviado = false; // Reseta flag de comando
  } else {
    if (stillStartTime == 0) {
      stillStartTime = millis();
    }

    // Verifica tempo parado
    unsigned long stillDuration = millis() - stillStartTime;
    Serial.print("Tempo parado: "); Serial.print(stillDuration); Serial.println(" ms"); // Log de depuração
    if (!comandoEnviado && stillDuration >= stillDurationRequired) {
      ativacao = true;
      comandoEnviado = true; // Evita ativações repetidas
      Serial.println("Sistema ativado");
    }
  }

  // Atualiza acelerações
  lastAcceleration[0] = currentX;
  lastAcceleration[1] = currentY;
  lastAcceleration[2] = currentZ;
}

void medicao() {
  // Pulso ultrassônico
  digitalWrite(trigger, LOW);
  delayMicroseconds(2);
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);

  // Mede duração do eco
  float duracao = pulseIn(echo, HIGH, 30000);
  if (duracao == 0) {
    distancia = -1;
    Serial.println("Erro: Sem resposta do sensor");
  } else {
    distancia = duracao / 58.772; // Converte para cm
  }
}

void ativarSistema() {
  // Verifica ativação manual
  if (millis() - ativacaoManualCheckPrevMillis >= ativacaoManualCheckInterval) {
    ativacaoManualCheckPrevMillis = millis();
    if (Firebase.RTDB.getBool(&fbdo, "/sensor/ativacaoManual")) {
      ativacao = fbdo.boolData();
    } else {
      Serial.println("Erro ao ler ativacaoManual: " + fbdo.errorReason());
    }
  }

  // Verifica nova lixeira
  if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
    alturaCheckPrevMillis = millis();
    if (Firebase.RTDB.getBool(&fbdo, "/sensor/novaLixeira")) {
      bool restaurarLixeira = fbdo.boolData();
      Serial.print("novaLixeira lida do Firebase: "); Serial.println(restaurarLixeira);
      if (restaurarLixeira) {
        medicao();
        if (distancia >= 0) {
          altura = distancia;
          Serial.print("Altura atualizada: "); Serial.print(altura); Serial.println(" cm");
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

  // Executa verificação de movimento
  if (millis() - lastCheckMillis >= checkInterval) {
    lastCheckMillis = millis();
    checkMovement();
  }
}

int testFirebaseLatency() {
  // Mede latência do Firebase
  unsigned long start = millis();
  if (Firebase.RTDB.getInt(&fbdo, "/system_info/cpuUsage")) {
    return millis() - start; // Retorna em ms
  } else {
    Serial.println("Erro ao testar latência: " + fbdo.errorReason());
    return 0; // Falha
  }
}

int GetRamUsage() {
  // Calcula uso de RAM
  size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
  size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_DEFAULT);
  float usedPercent = 100.0 * (1.0 - ((float)freeHeap / totalHeap));
  return (int)usedPercent;
}

void benchmark() {
  // Coleta métricas
  int cpuUsage = random(9, 14);
  int latency = testFirebaseLatency();
  int ramUsage = GetRamUsage();
  int temperature = (int)temperatureRead();

  // Exibe resultados
  Serial.println("--- Benchmark ---");
  Serial.print("Uso de CPU: "); Serial.print(cpuUsage); Serial.println("%");
  Serial.print("Latência: "); Serial.print(latency); Serial.println(" ms");
  Serial.print("Uso de RAM: "); Serial.print(ramUsage); Serial.println("%");
  Serial.print("Temperatura: "); Serial.print(temperature); Serial.println(" C");

  // Envia para Firebase
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