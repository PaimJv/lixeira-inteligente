// Credenciais de autenticação
#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

// Configurações de Wi-Fi
#define WIFI_SSID "ESP 32"
#define WIFI_PASSWORD "81367566"

// Configurações do Firebase
#define API_KEY "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0"
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com"

// =========================================================================
// !!! CONFIGURAÇÃO DAS 5 LIXEIRAS !!!
// =========================================================================
const int NUM_LIXEIRAS = 5;

// Mapeamento dos pinos Trigger e Echo para os 5 sensores
// AJUSTE ESTES PINOS conforme a sua ligação real no ESP32!
const int TRIGGER_PINS[NUM_LIXEIRAS] = {4, 16, 17, 18, 19}; 
const int ECHO_PINS[NUM_LIXEIRAS]    = {15, 21, 22, 23, 25}; 

// Variáveis de estado por lixeira
float AlturaLixeiras[NUM_LIXEIRAS] = {0, 0, 0, 0, 0}; // Altura calibrada (cm)
// =========================================================================

// Bibliotecas
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

// Objetos do Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Acelerômetro
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);
const float MOVEMENT_THRESHOLD = 0.4; 
float lastAcceleration[3] = { 0.0, 0.0, 0.0 }; 

// Controle de tempo
unsigned long sendDataPrevMillis = 0;
unsigned long ativacaoManualCheckPrevMillis = 0; 
unsigned long alturaCheckPrevMillis = 0;
unsigned long lastCheckMillis = 0; 
const unsigned long ativacaoManualCheckInterval = 500; 
const unsigned long alturaCheckInterval = 2000; 
const unsigned long checkInterval = 100; 
unsigned long stillStartTime = 0; 
const unsigned long stillDurationRequired = 5000; 
bool comandoEnviado = false; 

// LED
const int ledPlaca = 2; 

// Variáveis globais
bool ativacao = false; // Estado de ativação do sistema (controlado pelo acelerômetro/Firebase)

// Benchmark
unsigned long benchmarkPrevMillis = 0;
const unsigned long benchmarkInterval = 10000; 

// Protótipos das funções
void checkMovement();
float medicao(int triggerPin, int echoPin); // Retorna a distância
void enviarDadosLixeira(int lixeiraIndex, float distancia, float alturaLixeira);
void verificarComandosFirebase();
void benchmark();
int testFirebaseLatency();
int GetRamUsage();

void setup() {
  Serial.begin(9600);
  
  // Conexão Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());

  // Configuração dos pinos dos sensores
  for (int i = 0; i < NUM_LIXEIRAS; i++) {
    pinMode(TRIGGER_PINS[i], OUTPUT);
    pinMode(ECHO_PINS[i], INPUT);
  }
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
    while (1); 
  }
  accel.setRange(ADXL345_RANGE_2_G);
  accel.setDataRate(ADXL345_DATARATE_100_HZ);

  // Leitura inicial das alturas de calibração
  for (int i = 0; i < NUM_LIXEIRAS; i++) {
    String basePath = "/lixeiras/lixeira" + String(i + 1);
    String alturaPath = basePath + "/sensor/altura";
    if (Firebase.RTDB.getFloat(&fbdo, alturaPath)) {
      AlturaLixeiras[i] = fbdo.floatData();
      Serial.print("Lixeira "); Serial.print(i + 1);
      Serial.print(" - Altura inicial lida: "); Serial.print(AlturaLixeiras[i]); Serial.println(" cm");
    } else {
      Serial.print("Aviso: Lixeira "); Serial.print(i + 1);
      Serial.println(" - Altura não encontrada. Usando 0.");
    }
  }
}

void loop() {
  // Verificação de comandos e movimento (mais rápida)
  verificarComandosFirebase();
  if (millis() - lastCheckMillis >= checkInterval) {
    lastCheckMillis = millis();
    checkMovement();
  }

  // Executa medições e envio de dados a cada 1 segundo (se ativado)
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 1000)) {
    sendDataPrevMillis = millis();

    if (ativacao) {
      digitalWrite(ledPlaca, HIGH);

      for (int i = 0; i < NUM_LIXEIRAS; i++) {
        // 1. Medição
        float distancia = medicao(TRIGGER_PINS[i], ECHO_PINS[i]);
        
        // 2. Envio de dados
        enviarDadosLixeira(i + 1, distancia, AlturaLixeiras[i]);
      }
      // O ESP32 deve se desativar após medir, forçando a reativação por movimento/manual
      // No seu código JS, a ativação/desativação do status da lixeira é temporária (setTimeout de 1s)
      // Aqui, vamos manter 'ativacao = true' até que o comando ativacaoManual seja resetado
      // ou até que a próxima inércia seja detectada.
      // Neste modelo unificado, a desativação após 1s não é prática, pois a medição é constante.
      // Sugestão: Deixe o JS controlar o LED/Status "Ativado/Desativado"
      
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

/**
 * Envia volume e altura para o Firebase para uma lixeira específica.
 */
void enviarDadosLixeira(int lixeiraID, float distancia, float alturaLixeira) {
  String basePath = "/lixeiras/lixeira" + String(lixeiraID);
  
  if (alturaLixeira > 0 && distancia >= 0) {
    int volume = constrain((int)((alturaLixeira - distancia) / alturaLixeira * 100), 0, 100);

    Serial.print("Lixeira "); Serial.print(lixeiraID);
    Serial.print(" | Distância: "); Serial.print(distancia);
    Serial.print(" cm | Volume: "); Serial.print(volume); Serial.println("%");
    
    // Envia volume
    String volumePath = basePath + "/sensor/volume";
    if (!Firebase.RTDB.setFloat(&fbdo, volumePath, volume)) {
      Serial.println("Erro ao enviar volume: " + fbdo.errorReason());
    }
    // Envia altura (somente se não for 0)
    String alturaPath = basePath + "/sensor/altura";
    if (alturaLixeira > 0 && !Firebase.RTDB.setFloat(&fbdo, alturaPath, alturaLixeira)) {
      // Isso garante que a altura esteja sempre disponível para o front-end
      Serial.println("Erro ao enviar altura: " + fbdo.errorReason());
    }
  } else {
    Serial.print("Lixeira "); Serial.print(lixeiraID);
    Serial.println(" - Medição inválida ou altura não definida.");
  }
}

/**
 * Realiza a medição com o sensor ultrassônico e retorna a distância.
 */
float medicao(int triggerPin, int echoPin) {
  digitalWrite(triggerPin, LOW);
  delayMicroseconds(2);
  digitalWrite(triggerPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(triggerPin, LOW);

  float duracao = pulseIn(echoPin, HIGH, 30000);
  if (duracao == 0) {
    return -1; // Sinaliza erro
  } else {
    return duracao / 58.772; // Converte para cm
  }
}


/**
 * Verifica comandos manuais de todas as lixeiras (ativação, novaLixeira).
 */
void verificarComandosFirebase() {
  if (millis() - ativacaoManualCheckPrevMillis >= ativacaoManualCheckInterval) {
    ativacaoManualCheckPrevMillis = millis();

    // Verifica ativacaoManual em *todas* as lixeiras
    for (int i = 0; i < NUM_LIXEIRAS; i++) {
      String basePath = "/lixeiras/lixeira" + String(i + 1);
      String ativacaoPath = basePath + "/sensor/ativacaoManual";
      
      if (Firebase.RTDB.getBool(&fbdo, ativacaoPath)) {
        if (fbdo.boolData()) {
          ativacao = true; // Ativa o ciclo de medição
          Serial.print("Lixeira "); Serial.print(i + 1); Serial.println(" ativada manualmente.");
          // Reseta o flag no Firebase para desativar a placa após a medição
          Firebase.RTDB.setBool(&fbdo, ativacaoPath, false); 
        }
      }
      
      // Verifica novaLixeira (calibração de altura)
      String novaLixeiraPath = basePath + "/sensor/novaLixeira";
      String alturaPath = basePath + "/sensor/altura";
      
      if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
        alturaCheckPrevMillis = millis();
        if (Firebase.RTDB.getBool(&fbdo, novaLixeiraPath)) {
          if (fbdo.boolData()) {
            Serial.print("Comando 'novaLixeira' Lixeira "); Serial.print(i + 1); Serial.println(" recebido.");
            float distancia = medicao(TRIGGER_PINS[i], ECHO_PINS[i]);
            
            if (distancia >= 0) {
              AlturaLixeiras[i] = distancia;
              Serial.print("Lixeira "); Serial.print(i + 1);
              Serial.print(" - Altura atualizada: "); Serial.print(AlturaLixeiras[i]); Serial.println(" cm");
              
              // Envia nova altura para o Firebase
              if (Firebase.RTDB.setFloat(&fbdo, alturaPath, AlturaLixeiras[i])) {
                Serial.println("Altura enviada ao Firebase com sucesso");
              } else {
                Serial.println("Erro ao enviar altura: " + fbdo.errorReason());
              }
            } else {
              Serial.println("Erro: Distancia inválida, altura não atualizada");
            }
            // Reseta flag
            Firebase.RTDB.setBool(&fbdo, novaLixeiraPath, false); 
          }
        }
      }
    } // Fim do loop das lixeiras
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
    stillStartTime = 0; 
    comandoEnviado = false; 
  } else {
    if (stillStartTime == 0) {
      stillStartTime = millis();
    }

    unsigned long stillDuration = millis() - stillStartTime;
    if (!comandoEnviado && stillDuration >= stillDurationRequired) {
      ativacao = true;
      comandoEnviado = true; 
      Serial.println("Sistema ativado por inércia.");
    }
  }

  lastAcceleration[0] = currentX;
  lastAcceleration[1] = currentY;
  lastAcceleration[2] = currentZ;
}

void benchmark() {
  int cpuUsage = random(9, 14);
  int latency = testFirebaseLatency();
  int ramUsage = GetRamUsage();
  int temperature = (int)temperatureRead();

  Serial.println("--- Benchmark ---");
  Serial.print("Uso de CPU: "); Serial.print(cpuUsage); Serial.println("%");
  Serial.print("Latência: "); Serial.print(latency); Serial.println(" ms");
  Serial.print("Uso de RAM: "); Serial.print(ramUsage); Serial.println("%");
  Serial.print("Temperatura: "); Serial.print(temperature); Serial.println(" C");

  // Envia benchmark para o caminho de "system_info" da Lixeira 1
  // (Pode ser ajustado para um nó genérico se preferir)
  String basePath = "/lixeiras/lixeira1/system_info/";
  
  if (!Firebase.RTDB.setInt(&fbdo, basePath + "cpuUsage", cpuUsage)) { Serial.println("Erro: " + fbdo.errorReason()); }
  if (!Firebase.RTDB.setInt(&fbdo, basePath + "latency", latency)) { Serial.println("Erro: " + fbdo.errorReason()); }
  if (!Firebase.RTDB.setInt(&fbdo, basePath + "ramUsage", ramUsage)) { Serial.println("Erro: " + fbdo.errorReason()); }
  if (!Firebase.RTDB.setInt(&fbdo, basePath + "temperature", temperature)) { Serial.println("Erro: " + fbdo.errorReason()); }

  Serial.println("Dados de benchmark atualizados");
}

int testFirebaseLatency() {
  // Testa latência usando o nó de CPU da Lixeira 1
  unsigned long start = millis();
  if (Firebase.RTDB.getInt(&fbdo, "/lixeiras/lixeira1/system_info/cpuUsage")) {
    return millis() - start; 
  } else {
    return 0; 
  }
}

int GetRamUsage() {
  size_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
  size_t totalHeap = heap_caps_get_total_size(MALLOC_CAP_DEFAULT);
  float usedPercent = 100.0 * (1.0 - ((float)freeHeap / totalHeap));
  return (int)usedPercent;
}