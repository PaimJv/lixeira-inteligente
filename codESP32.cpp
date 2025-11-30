#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Helpers (obrigatórios para gerar tokens)
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ============================
// CONFIGURAÇÕES DE LOGIN
// ============================
#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

// ============================
// CONFIGURAÇÕES DO WIFI
// ============================
#define WIFI_SSID "ESP 32"
#define WIFI_PASSWORD "81367566"

// ============================
// CONFIGURAÇÃO DO FIREBASE
// ============================
#define API_KEY "SUA_API_KEY_AQUI"
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com"

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ============================
// Pinos dos sensores ultrassônicos
// ============================
const int TRIGGER_PINS[5] = {5, 12, 14, 27, 26};
const int ECHO_PINS[5]    = {18, 19, 21, 22, 23};

// Alturas máximas de cada lixeira
float alturaMaxima[5] = {30, 30, 30, 30, 30};

// Valores calculados
float alturas[5];
int volumes[5];

// ============================
// Função de medição
// ============================
float medirDistancia(int trigger, int echo) {
  digitalWrite(trigger, LOW);
  delayMicroseconds(4);
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);

  long duracao = pulseIn(echo, HIGH, 30000);
  float distancia = duracao * 0.034 / 2;

  if (distancia <= 0 || distancia > 400)
    return -1;

  return distancia;
}

// ============================
// SETUP
// ============================
void setup() {
  Serial.begin(115200);

  // Configura pinos dos sensores
  for (int i = 0; i < 5; i++) {
    pinMode(TRIGGER_PINS[i], OUTPUT);
    pinMode(ECHO_PINS[i], INPUT);
  }

  // Conexão Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado!");

  // Configuração Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  // Inicializa o Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

// ============================
// LOOP PRINCIPAL
// ============================
void loop() {

  for (int i = 0; i < 5; i++) {

    // =======================
    // Medição
    // =======================
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

    // Caminho no Firebase
    String base = "/lixeiras/lixeira" + String(i + 1) + "/sensor";

    // =======================
    // Envia dados
    // =======================
    Firebase.RTDB.setFloat(&fbdo, base + "/altura", alturas[i]);
    Firebase.RTDB.setInt(&fbdo, base + "/volume", volumes[i]);

    // =======================
    // Lê comandos
    // =======================
    bool ativacaoManual = false;
    bool novaLixeira = false;

    if (Firebase.RTDB.getBool(&fbdo, base + "/ativacaoManual"))
      ativacaoManual = fbdo.boolData();

    if (Firebase.RTDB.getBool(&fbdo, base + "/novaLixeira"))
      novaLixeira = fbdo.boolData();

    // Comando: nova leitura manual
    if (ativacaoManual) {
      Firebase.RTDB.setBool(&fbdo, base + "/ativacaoManual", false);
      Serial.println("Leitura manual na lixeira " + String(i + 1));
    }

    // Comando: reset da lixeira
    if (novaLixeira) {
      Firebase.RTDB.setBool(&fbdo, base + "/novaLixeira", false);
      Firebase.RTDB.setInt(&fbdo, base + "/volume", 0);
      Serial.println("Lixeira restaurada: " + String(i + 1));
    }

    delay(300);
  }

  delay(1000);
}
