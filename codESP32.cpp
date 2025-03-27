/* 4. Defina o email e senha do usuário já registrado ou adicionado ao seu projeto */
#define USER_EMAIL "lixeira1@gmail.com"
#define USER_PASSWORD "lixeira123"

/*
SISTEMA DE MONITORAMENTO DE LIXEIRA - ESP32

Principal:
	Implementar a coleta da distância através de interrupção
	Converter a distância para porcentagem
	Enviar a porcentagem para o banco de dados
	
Secundário:
	Implementar lógica para detectar abertura da tampa e só contabilizar após 15s de inércia
	Monitorar porcentagem da bateria através do voltímetro
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

/* 1. Defina as credenciais do WiFi */
#define WIFI_SSID "R&J VEICULOS"
#define WIFI_PASSWORD "81367566"

/* 2. Defina a chave da API */
#define API_KEY "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0"

/* 3. Defina a URL do RTDB (Realtime Database) */
#define DATABASE_URL "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com"


// Define o objeto de dados do Firebase
FirebaseData fbdo;

FirebaseAuth auth;
FirebaseConfig config;

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

const int trigger = 4;
const int echo = 15;
const int ledPlaca = 2;

float distancia = -1;  // Inicializado como -1 para indicar valor inválido
float altura;
int volume;
bool inercia = false;
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
}

void loop() {
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 1000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    ativarSistema();

    if (ativacao) {
      medicao();

      if (altura >= distancia) {
        volume = (altura - distancia)/altura*100;
      }

      if (volume >= 0) {  // Verifica se a medição é válida

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
      // Serial.print("AtivacaoManual lida do Firebase: ");
      // Serial.println(ativacaoManual);

      // Define ativacao com base em ativacaoManual
      ativacao = ativacaoManual;
    } else {
      Serial.println("Erro ao ler ativacaoManual: " + fbdo.errorReason());
    }
  }

  // Só verifica inercia e altura se ativacao for true
  if (ativacao) {
    // Verifica /sensor/inercia
    if (millis() - inerciaCheckPrevMillis >= inerciaCheckInterval) {
      inerciaCheckPrevMillis = millis();  // Atualiza o tempo anterior

      if (Firebase.RTDB.getInt(&fbdo, "/sensor/inercia")) {
        int inerciaValue = fbdo.intData();
        bool newInercia = (inerciaValue == 1);  // Converte 1 para true, 0 para false
        // Serial.print("Inercia lida do Firebase: ");
        // Serial.println(newInercia);

        if (newInercia != inercia) {
          if (newInercia) {
            inerciaStartTime = millis();
            Serial.println("Inercia ativada, começando contagem");
          } else {
            inerciaStartTime = 0;
            Serial.println("Inercia desativada");
          }
          inercia = newInercia;
        }

        // Verifica se inercia está ativa por aproximadamente 1,5 segundos
        if (inercia && inerciaStartTime > 0) {
          unsigned long inerciaDuration = millis() - inerciaStartTime;
          if (inerciaDuration >= (inerciaDurationRequired - 500) && inerciaDuration <= (inerciaDurationRequired + 500)) {
            ativacao = true;  // Mantém ativacao true
            Serial.println("Inercia ativa por ~1,5 segundos, ativacao = true");
          }
        }
      } else {
        Serial.println("Erro ao ler inercia: " + fbdo.errorReason());
      }
    }

    // Verifica /sensor/altura
    if (millis() - alturaCheckPrevMillis >= alturaCheckInterval) {
      alturaCheckPrevMillis = millis();  // Atualiza o tempo anterior

      if (Firebase.RTDB.getFloat(&fbdo, "/sensor/altura")) {
        altura = fbdo.floatData();
        Serial.print("Altura lida do Firebase: ");
        Serial.println(altura);
      } else {
        Serial.println("Erro ao ler altura: " + fbdo.errorReason());
      }
    }
  }
}