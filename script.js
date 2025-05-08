const firebaseConfig = {
    apiKey: "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0",
    authDomain: "lixeira-inteligente-esp32.firebaseapp.com",
    databaseURL: "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com",
    projectId: "lixeira-inteligente-esp32",
    storageBucket: "lixeira-inteligente-esp32.firebasestorage.app",
    messagingSenderId: "14562674613",
    appId: "1:14562674613:web:c42a81951431c6f70b7bfc"
  };

  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  const inerciaStatus = document.getElementById("ledStatus");
  const toggleSwitch = document.getElementById("toggleSwitch");
  
  // Credenciais do usuário
  const email = "lixeira1@gmail.com";
  const password = "lixeira123";
  
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
              inerciaStatus.textContent = "Sistema ativado";
              toggleSwitch.classList.add("on");
          } else {
              inerciaStatus.textContent = "Sistema desativado";
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
      // Define como true
      database.ref("sensor/ativacaoManual").set(true)
          .then(() => {
              console.log("Ativação manual: true");
              // Após 1 segundo, define como false
              setTimeout(() => {
                  database.ref("sensor/ativacaoManual").set(false)
                      .then(() => {
                          console.log("Ativação manual: false");
                      })
                      .catch((error) => {
                          console.error("Erro ao desativar:", error);
                      });
              }, 1000); // 1000 ms = 1 segundo
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
  
  ativacaoManualBtn.addEventListener("click", ativacaoManual); // Evento do botão