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
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

FirebaseData fbdo;

FirebaseAuth auth;
FirebaseConfig config;

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

// Acelerômetro
const float MOVEMENT_THRESHOLD = 0.5; // Limiar de movimento (em m/s^2)
float lastAcceleration[3] = { 0.0, 0.0, 0.0 }; // Armazena as últimas acelerações para comparação

// Controle de tempo para interrupções
unsigned long sendDataPrevMillis = 0;
unsigned long ativacaoManualCheckPrevMillis = 0;  // Tempo anterior para ativacaoManual
unsigned long alturaCheckPrevMillis = 0;
const unsigned long ativacaoManualCheckInterval = 500;  // Intervalo de 500 ms para ativacaoManual
const unsigned long alturaCheckInterval = 2000;         // Intervalo de 2000 ms para altura

// Controle de tempo parado
unsigned long stillStartTime = 0;                  // Tempo em que o sensor ficou parado
const unsigned long stillDurationRequired = 5000;  // Tempo de parada necessário
const unsigned long stillDurationTolerance = 100;  // Tolerância em ms
bool comandoEnviado = false;                       // Flag para evitar múltiplos envios

// Variáveis para interrupção de software
unsigned long lastCheckMillis = 0;        // Última verificação
const unsigned long checkInterval = 100;  // Intervalo de verificação 

// Sensor ultrassônico
const int trigger = 4;
const int echo = 15;

// Led
const int ledPlaca = 2;

// Variáveis globais
float distancia = -1;  // Inicia como valor inválido
float altura;
int volume;
bool ativacao = false; 

void setup() {
  // Comunicação serial
  Serial.begin(9600);
  
  // Configurações wifi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());
  
  // Configurações das portas
  pinMode(trigger, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(ledPlaca, OUTPUT);

  // Configurações firebase
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

  // Configurações do acelerômetro
  if (!accel.begin()) {
    Serial.println("Erro: ADXL345 não detectado. Verifique as conexões!");
    while (1)
      ;  // Para o programa se o sensor não for encontrado
  }

  accel.setRange(ADXL345_RANGE_2_G);           // Faixa de 2g para maior sensibilidade
  accel.setDataRate(ADXL345_DATARATE_100_HZ);  // Taxa de dados: 100 Hz

  sensor_t sensor;
  accel.getSensor(&sensor);
  Serial.println("------------------------------------");
  Serial.print("Sensor: ");  Serial.println(sensor.name);
  Serial.print("Versão do Driver: ");  Serial.println(sensor.version);
  Serial.print("ID Único: ");  Serial.println(sensor.sensor_id);
  Serial.print("Valor Máximo: ");  Serial.print(sensor.max_value);  Serial.println(" m/s^2");  
  Serial.print("Valor Mínimo: ");  Serial.print(sensor.min_value);  Serial.println(" m/s^2");
  Serial.print("Resolução: ");  Serial.print(sensor.resolution);  Serial.println(" m/s^2");  Serial.println("------------------------------------");

  // Exibir faixa de aceleração configurada
  Serial.print("Faixa: +/- ");
  switch (accel.getRange()) {
    case ADXL345_RANGE_16_G: Serial.println("16 g"); break;
    case ADXL345_RANGE_8_G: Serial.println("8 g"); break;
    case ADXL345_RANGE_4_G: Serial.println("4 g"); break;
    case ADXL345_RANGE_2_G: Serial.println("2 g"); break;
    default: Serial.println("?? g"); break;
  }

  // Exibir taxa de dados configurada
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
      if (altura >= distancia) {
        volume = (altura - distancia) / altura * 100;
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
}

void checkMovement() {
  sensors_event_t event; // Obtém um evento do sensor
  accel.getEvent(&event);

  // Obtém as acelerações em cada eixo
  float currentX = event.acceleration.x;
  float currentY = event.acceleration.y;
  float currentZ = event.acceleration.z;

  // Verifica se houve movimento significativo
  bool isMoving = (abs(currentX - lastAcceleration[0]) >= MOVEMENT_THRESHOLD || abs(currentY - lastAcceleration[1]) >= MOVEMENT_THRESHOLD || abs(currentZ - lastAcceleration[2]) >= MOVEMENT_THRESHOLD);

  if (isMoving) {
    Serial.println("Movimento detectado!");
    stillStartTime = 0;      // Reinicia o contador de tempo parado
    comandoEnviado = false;  // Reseta a flag de comando
  } else {
    if (stillStartTime == 0) {
      stillStartTime = millis();
    }

    unsigned long stillDuration = millis() - stillStartTime; // Verifica se o tempo parado é o necessário para fazer leitura
    if (!comandoEnviado && stillDuration >= (stillDurationRequired - stillDurationTolerance) && stillDuration <= (stillDurationRequired + stillDurationTolerance)) {
      ativacao = true;
      Serial.println("Sistema ativado");
    }
  }

  // Atualiza as últimas acelerações
  lastAcceleration[0] = currentX;
  lastAcceleration[1] = currentY;
  lastAcceleration[2] = currentZ;
}

void medicao() {
  digitalWrite(trigger, LOW);
  delayMicroseconds(2);  // Estado baixo antes do pulso
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);

  float duracao = pulseIn(echo, HIGH, 30000);  // Timeout de 30 ms
  if (duracao == 0) {
    distancia = -1;
    Serial.println("Erro: Sem resposta do sensor");
  } else {
    distancia = duracao / 58.772; // Calcula distancia em cm
  }
}

void ativarSistema() {
  // Verifica o estado de ativacaoManual
  if (millis() - ativacaoManualCheckPrevMillis >= ativacaoManualCheckInterval) {
    ativacaoManualCheckPrevMillis = millis();  // Atualiza o tempo anterior

    if (Firebase.RTDB.getBool(&fbdo, "/sensor/ativacaoManual")) {
      bool ativacaoManual = fbdo.boolData();
      ativacao = ativacaoManual;
    } else {
      Serial.println("Erro ao ler ativacaoManual: " + fbdo.errorReason());
    }
  }

  // Verifica o estado de novaLixeira
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
          
          // Enviar altura para /sensor/altura
          if (Firebase.RTDB.setFloat(&fbdo, "/sensor/altura", altura)) {
            Serial.println("Altura enviada ao Firebase com sucesso");
          } else {
            Serial.println("Erro ao enviar altura: " + fbdo.errorReason());
          }
          // Resetar novaLixeira para false
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

  // Verifica se é hora de executar a interrupção de software
  if (millis() - lastCheckMillis >= checkInterval) {
    lastCheckMillis = millis();
    checkMovement();
  }
}
