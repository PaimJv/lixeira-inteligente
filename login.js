document.addEventListener("DOMContentLoaded", function () {
    // Inicializar Firebase
    const firebaseConfig = {
        // Substitua com sua configuração do Firebase
        apiKey: "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0",
        authDomain: "lixeira-inteligente-esp32.firebaseapp.com",
        databaseURL: "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com",
        projectId: "lixeira-inteligente-esp32",
        storageBucket: "lixeira-inteligente-esp32.appspot.com",
        messagingSenderId: "14562674613",
        appId: "1:14562674613:web:c42a81951431c6f70b7bfc"
    };
    firebase.initializeApp(firebaseConfig);

    // Elementos da tela de login
    const loginInput = document.getElementById("loginInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    // Função para autenticar com Firebase
    function autenticar() {
        const usuario = loginInput.value.trim();
        const senha = passwordInput.value.trim();

        firebase.auth().signInWithEmailAndPassword(usuario, senha)
            .then((userCredential) => {
                loginError.style.display = "none";
                // Redirecionar para a página do sistema
                window.location.href = "home.html";
            })
            .catch((error) => {
                loginError.style.display = "block";
                loginError.textContent = "Erro: " + error.message;
            });
    }

    // Eventos
    loginBtn.addEventListener("click", autenticar);
    passwordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            autenticar();
        }
    });
});