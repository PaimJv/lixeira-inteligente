#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

#define WIFI_SSID "R&J VEICULOS"
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

// Define o objeto do acelerômetro ADXL345
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

// Pino do LED
// const int ledPlaca = 2;

// Limiar de movimento (em m/s^2)
const float MOVEMENT_THRESHOLD = 0.5;

// Armazena as últimas acelerações para comparação
float lastAcceleration[3] = { 0.0, 0.0, 0.0 };

// Variáveis globais para controle de tempo
unsigned long sendDataPrevMillis = 0;
unsigned long ativacaoManualCheckPrevMillis = 0;  // Tempo anterior para ativacaoManual
unsigned long inerciaCheckPrevMillis = 0;         // Tempo anterior para inercia
unsigned long inerciaStartTime = 0;               // Tempo em que inercia virou true
unsigned long alturaCheckPrevMillis = 0;
const unsigned long ativacaoManualCheckInterval = 500;  // Intervalo de 500 ms para ativacaoManual
const unsigned long inerciaCheckInterval = 1000;        // Intervalo de 1000 ms para inercia
const unsigned long inerciaDurationRequired = 1500;     // 1,5 segundos
const unsigned long alturaCheckInterval = 2000;         // Intervalo de 2000 ms para altura

// Variáveis para controle de tempo parado
unsigned long stillStartTime = 0;                  // Tempo em que o sensor ficou parado

// TEMPO DE SENSOR PARADO
const unsigned long stillDurationRequired = 5000;  // 3 segundos
const unsigned long stillDurationTolerance = 100;  // Tolerância de ±100 ms
bool comandoEnviado = false;                       // Flag para evitar múltiplos envios

// Variáveis para interrupção de software
unsigned long lastCheckMillis = 0;        // Última verificação
const unsigned long checkInterval = 100;  // Intervalo de verificação (100 ms)

const int trigger = 4;
const int echo = 15;
const int ledPlaca = 2;

float distancia = -1;  // Inicializado como -1 para indicar valor inválido
float altura;
int volume;
// bool inercia = false;
bool ativacao = false;  // Inicializado como false

void setup() {
  Serial.begin(9600);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  pinMode(trigger, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(ledPlaca, OUTPUT);

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }

  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());

  config.api_key = API_KEY;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.database_url = DATABASE_URL;
  Firebase.reconnectNetwork(true);
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.setResponseSize(2048);
  Firebase.begin(&config, &auth);
  Firebase.setDoubleDigits(5);  // Faltava um ponto e vírgula aqui
  config.timeout.serverResponse = 10 * 1000;

  Serial.println("Teste do Acelerômetro ADXL345 com Detecção de Movimento");

  // Configura o pino do LED como saída
  // pinMode(ledPlaca, OUTPUT);
  // digitalWrite(ledPlaca, LOW); // LED inicia apagado

  // Inicializa o sensor
  if (!accel.begin()) {
    Serial.println("Erro: ADXL345 não detectado. Verifique as conexões!");
    while (1)
      ;  // Para o programa se o sensor não for encontrado
  }

  // Configurações do sensor
  accel.setRange(ADXL345_RANGE_2_G);           // Faixa de ±2g para maior sensibilidade
  accel.setDataRate(ADXL345_DATARATE_100_HZ);  // Taxa de dados: 100 Hz

  // Exibe informações do sensor
  sensor_t sensor;
  accel.getSensor(&sensor);
  Serial.println("------------------------------------");
  Serial.print("Sensor: ");
  Serial.println(sensor.name);
  Serial.print("Versão do Driver: ");
  Serial.println(sensor.version);
  Serial.print("ID Único: ");
  Serial.println(sensor.sensor_id);
  Serial.print("Valor Máximo: ");
  Serial.print(sensor.max_value);
  Serial.println(" m/s^2");
  Serial.print("Valor Mínimo: ");
  Serial.print(sensor.min_value);
  Serial.println(" m/s^2");
  Serial.print("Resolução: ");
  Serial.print(sensor.resolution);
  Serial.println(" m/s^2");
  Serial.println("------------------------------------");

  // Exibe a faixa configurada
  Serial.print("Faixa: +/- ");
  switch (accel.getRange()) {
    case ADXL345_RANGE_16_G: Serial.println("16 g"); break;
    case ADXL345_RANGE_8_G: Serial.println("8 g"); break;
    case ADXL345_RANGE_4_G: Serial.println("4 g"); break;
    case ADXL345_RANGE_2_G: Serial.println("2 g"); break;
    default: Serial.println("?? g"); break;
  }

  // Exibe a taxa de dados configurada
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

      if (volume >= 0 && volume <= 100) {  // Verifica se a medição é válida

        Serial.print("Distância: ");
        Serial.print(distancia);
        Serial.println(" cm");
        Serial.print("Volume: ");
        Serial.print(volume);
        Serial.println("%");

        if (Firebase.RTDB.setFloat(&fbdo, "/sensor/volume", volume)) {
          // Serial.println("Volume enviado ao Firebase com sucesso");
        } else {
          Serial.println("Erro ao enviar volume: " + fbdo.errorReason());
        }

        digitalWrite(ledPlaca, HIGH);
      } else {
        Serial.println("Medição inválida");
      }
    } else {
      // Serial.println("Sistema desativado");  // Substituído por mensagem mais clara
      digitalWrite(ledPlaca, LOW);
    }
  }
}

void checkMovement() {
  // Obtém um evento do sensor
  sensors_event_t event;
  accel.getEvent(&event);

  // Obtém as acelerações atuais
  float currentX = event.acceleration.x;
  float currentY = event.acceleration.y;
  float currentZ = event.acceleration.z;

  // Verifica se houve movimento significativo
  bool isMoving = (abs(currentX - lastAcceleration[0]) >= MOVEMENT_THRESHOLD || abs(currentY - lastAcceleration[1]) >= MOVEMENT_THRESHOLD || abs(currentZ - lastAcceleration[2]) >= MOVEMENT_THRESHOLD);

  if (isMoving) {
    // Movimento detectado: acende o LED e exibe as acelerações
    // digitalWrite(ledPlaca, HIGH);
    Serial.println("Movimento detectado!");
    // Serial.print("X: "); Serial.print(currentX); Serial.print(" m/s^2 ");
    // Serial.print("Y: "); Serial.print(currentY); Serial.print(" m/s^2 ");
    // Serial.print("Z: "); Serial.print(currentZ); Serial.print(" m/s^2 ");
    // Serial.println();
    stillStartTime = 0;      // Reinicia o contador de tempo parado
    comandoEnviado = false;  // Reseta a flag de comando
  } else {
    // Sem movimento: apaga o LED
    // digitalWrite(ledPlaca, LOW);

    // Inicia a contagem de tempo parado, se ainda não iniciada
    if (stillStartTime == 0) {
      stillStartTime = millis();
    }

    // Verifica se o sistema está parado por ~3 segundos
    unsigned long stillDuration = millis() - stillStartTime;
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
    distancia = duracao / 58.772;
  }
}

void ativarSistema() {
  // Verifica /sensor/ativacaoManual para ativar o sistema
  if (millis() - ativacaoManualCheckPrevMillis >= ativacaoManualCheckInterval) {
    ativacaoManualCheckPrevMillis = millis();  // Atualiza o tempo anterior

    if (Firebase.RTDB.getBool(&fbdo, "/sensor/ativacaoManual")) {
      bool ativacaoManual = fbdo.boolData();
      // Define ativacao com base em ativacaoManual
      ativacao = ativacaoManual;
    } else {
      Serial.println("Erro ao ler ativacaoManual: " + fbdo.errorReason());
    }
  }

  // // Verifica /sensor/altura
  // if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
  //   alturaCheckPrevMillis = millis();  // Atualiza o tempo anterior

  //   if (Firebase.RTDB.getFloat(&fbdo, "/sensor/altura")) {
  //     altura = fbdo.floatData();
  //     // Serial.print("Altura lida do Firebase: ");
  //     // Serial.println(altura);
  //   } else {
  //     Serial.println("Erro ao ler altura: " + fbdo.errorReason());
  //   }
  // }

// Verifica /sensor/novaLixeira
  if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
    alturaCheckPrevMillis = millis();
    if (Firebase.RTDB.getBool(&fbdo, "/sensor/novaLixeira")) {
      bool restaurarLixeira = fbdo.boolData();
      Serial.print("novaLixeira lida do Firebase: ");
      Serial.println(restaurarLixeira);
      if (restaurarLixeira) {
        medicao();
        Serial.print("Medição realizada, distancia: ");
        Serial.print(distancia);
        Serial.println(" cm");
        if (distancia >= 0) {
          altura = distancia;
          Serial.print("Altura atualizada: ");
          Serial.print(altura);
          Serial.println(" cm");
          // Envia altura para /sensor/altura
          if (Firebase.RTDB.setFloat(&fbdo, "/sensor/altura", altura)) {
            Serial.println("Altura enviada ao Firebase com sucesso");
          } else {
            Serial.println("Erro ao enviar altura: " + fbdo.errorReason());
          }
          // Reseta novaLixeira para false
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


  // Verifica se é hora de executar a "interrupção" de software
  if (millis() - lastCheckMillis >= checkInterval) {
    lastCheckMillis = millis();
    checkMovement();
  }
}
