#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// =======================
// CONFIGURAÇÕES
// =======================

// Firebase
#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"
#define API_KEY "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0"
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com/"

// Wi-Fi
#define WIFI_SSID "ESP 32"
#define WIFI_PASSWORD "81367566"

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// =======================
// PINOS DAS 5 LIXEIRAS
// =======================
const int TRIGGER_PINS[5] = {5, 12, 14, 27, 26};
const int ECHO_PINS[5]    = {18, 19, 21, 22, 23};

// Altura máxima em cm
float alturaMaxima[5] = {30, 30, 30, 30, 30};

// Leituras
float alturas[5];
int volumes[5];

// ===================================
// FUNÇÃO: medir distância (ultrassom)
// ===================================
float medirDistancia(int trigger, int echo) {
  digitalWrite(trigger, LOW);
  delayMicroseconds(4);
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);

  long duracao = pulseIn(echo, HIGH, 30000);
  float distancia = duracao * 0.034 / 2;

  if (distancia <= 0 || distancia > 400) return -1;
  return distancia;
}

// ===================================
// FUNÇÃO: registrar evento no histórico
// ===================================
void registrarHistorico(int index, String tipoEvento) {
  String path = "/lixeiras/lixeira" + String(index + 1) + "/historico";

  // Criar nó automático
  if (Firebase.RTDB.push(&fbdo, path, "")) {

    String id = fbdo.pushName();  // id gerado automaticamente

    // Gravar timestamp
    Firebase.RTDB.setInt(&fbdo, path + "/" + id + "/timestamp", millis());

    // Gravar tipo do evento
    Firebase.RTDB.setString(&fbdo, path + "/" + id + "/type", tipoEvento);

    Serial.println("Histórico registrado para lixeira " + String(index + 1) + " | " + tipoEvento);
  }
}

// ===================================
// FUNÇÃO: criar estrutura inicial
// ===================================
void inicializarEstruturaFirebase() {
  for (int i = 0; i < 5; i++) {
    String sensorPath = "/lixeiras/lixeira" + String(i + 1) + "/sensor";

    Firebase.RTDB.setFloat(&fbdo, sensorPath + "/altura", 0);
    Firebase.RTDB.setInt(&fbdo, sensorPath + "/volume", 0);
    Firebase.RTDB.setBool(&fbdo, sensorPath + "/ativacaoManual", false);
    Firebase.RTDB.setBool(&fbdo, sensorPath + "/novaLixeira", false);

    registrarHistorico(i, "inicialização");
  }
}

// ===================================
// SETUP
// ===================================
void setup() {
  Serial.begin(115200);

  // Configurar pinos
  for (int i = 0; i < 5; i++) {
    pinMode(TRIGGER_PINS[i], OUTPUT);
    pinMode(ECHO_PINS[i], INPUT);
  }

  // Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nWiFi conectado!");

  // Firebase config
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Criar estrutura no Firebase
  inicializarEstruturaFirebase();
}

// ===================================
// LOOP PRINCIPAL
// ===================================
void loop() {

  for (int i = 0; i < 5; i++) {

    // Ler sensor
    float distancia = medirDistancia(TRIGGER_PINS[i], ECHO_PINS[i]);
    alturas[i] = distancia;

    if (distancia < 0) {
      volumes[i] = 0;
    } else {
      float preenchimento = alturaMaxima[i] - distancia;
      if (preenchimento < 0) preenchimento = 0;

      volumes[i] = (preenchimento / alturaMaxima[i]) * 100.0;
      if (volumes[i] > 100) volumes[i] = 100;
    }

    String sensorPath = "/lixeiras/lixeira" + String(i + 1) + "/sensor";

    // Atualizar Firebase
    Firebase.RTDB.setFloat(&fbdo, sensorPath + "/altura", alturas[i]);
    Firebase.RTDB.setInt(&fbdo, sensorPath + "/volume", volumes[i]);

    // Ler comandos
    bool ativManual = false;
    bool novaLix = false;

    Firebase.RTDB.getBool(&fbdo, sensorPath + "/ativacaoManual");
    ativManual = fbdo.boolData();

    Firebase.RTDB.getBool(&fbdo, sensorPath + "/novaLixeira");
    novaLix = fbdo.boolData();

    // Evento: ativação manual
    if (ativManual) {
      Firebase.RTDB.setBool(&fbdo, sensorPath + "/ativacaoManual", false);
      registrarHistorico(i, "ativação");
    }

    // Evento: redefinir lixeira
    if (novaLix) {
      Firebase.RTDB.setBool(&fbdo, sensorPath + "/novaLixeira", false);
      Firebase.RTDB.setInt(&fbdo, sensorPath + "/volume", 0);
      registrarHistorico(i, "reset");
    }

    delay(200);
  }

  delay(1000);
}
