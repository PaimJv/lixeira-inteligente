const firebaseConfig = {
    apiKey: "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0",
    authDomain: "lixeira-inteligente-esp32.firebaseapp.com",
    databaseURL: "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com",
    projectId: "lixeira-inteligente-esp32",
    storageBucket: "lixeira-inteligente-esp32.firebasestorage.app",
    messagingSenderId: "14562674613",
    appId: "1:14562674613:web:c42a81951431c6f70b7bfc"
  };
  
  // Credenciais do usuário
  const email = "lixeira1@gmail.com"; // Exemplo: "seuemail@example.com"
  const password = "lixeira123"; // Sua senha real
  
  // Inicializa o Firebase
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  const sistemaStatus = document.getElementById("ledStatus");
  const toggleSwitch = document.getElementById("toggleSwitch");
  const ativacaoManualBtn = document.getElementById("ativacaoManualBtn");
  const alturaInput = document.getElementById("userInput");
  
  // Autenticação com email e senha
  firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
          const user = userCredential.user;
          console.log("Autenticado com sucesso como:", user.email, "UID:", user.uid);
  
          // Leitura em tempo real
          database.ref("sensor/ativacaoManual").on("value", (snapshot) => {
              const estado = snapshot.val();
              console.log("Valor de /sensor/ativacaoManual:", estado);
              if (estado === true) {
                  sistemaStatus.textContent = "Sistema ativado";
                  toggleSwitch.classList.add("on");
              } else {
                  sistemaStatus.textContent = "Sistema desativado";
                  toggleSwitch.classList.remove("on");
              }
          });
  
          // Leitura em tempo real de sensor/volume
          database.ref("sensor/volume").on("value", (snapshot) => {
              const volume = snapshot.val();
              console.log("Valor de /sensor/volume:", volume);
              document.getElementById("volumeValue").textContent = `${volume}%`;
          });
      })
      .catch((error) => {
          console.error("Erro na autenticação:", error.code, error.message);
      });
  
  // Função para ativação manual (1 segundo)
  function ativacaoManual() {
      database.ref("sensor/ativacaoManual").set(true)
          .then(() => {
              console.log("Ativação manual: true");
              setTimeout(() => {
                  database.ref("sensor/ativacaoManual").set(false)
                      .then(() => {
                          console.log("Ativação manual: false");
                      })
                      .catch((error) => {
                          console.error("Erro ao desativar:", error);
                      });
              }, 1000);
          })
          .catch((error) => {
              console.error("Erro ao ativar:", error);
          });
  }
  
  // Função para definir a altura no Firebase
  function definirAltura() {
      const alturaInput = document.getElementById("userInput").value;
      const alturaValue = parseFloat(alturaInput);
  
      if (isNaN(alturaValue) || alturaInput.trim() === "") {
          alert("Por favor, digite um número válido para a altura.");
          return;
      }
  
      database.ref("sensor/altura").set(alturaValue)
          .then(() => {
              console.log("Altura definida com sucesso: " + alturaValue);
              alert("Altura definida com sucesso: " + alturaValue + " cm");
              document.getElementById("userInput").value = "";
          })
          .catch((error) => {
              console.error("Erro ao definir altura: ", error);
              alert("Erro ao definir altura: " + error.message);
          });
  }
  
  // Evento para o botão de ativação manual
  ativacaoManualBtn.addEventListener("click", ativacaoManual);
  
  // Evento para pressionar Enter no campo de input
  alturaInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
          event.preventDefault(); // Evita comportamento padrão (ex.: submit de formulário)
          definirAltura();
      }
  });