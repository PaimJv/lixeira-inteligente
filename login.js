document.addEventListener("DOMContentLoaded", function () {
    const firebaseConfig = {
        apiKey: "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0",
        authDomain: "lixeira-inteligente-esp32.firebaseapp.com",
        databaseURL: "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com",
        projectId: "lixeira-inteligente-esp32",
        storageBucket: "lixeira-inteligente-esp32.appspot.com",
        messagingSenderId: "14562674613",
        appId: "1:14562674613:web:c42a81951431c6f70b7bfc"
    };
    firebase.initializeApp(firebaseConfig);

    const loginInput = document.getElementById("loginInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    function autenticar() {
        const usuario = loginInput.value.trim();
        const senha = passwordInput.value.trim();

        if (!usuario || !senha) {
            loginError.style.display = "block";
            loginError.textContent = "Por favor, preencha todos os campos.";
            return;
        }

        firebase.auth().signInWithEmailAndPassword(usuario, senha)
            .then((userCredential) => {
                console.log('Autenticado com sucesso:', userCredential.user.email);
                loginError.style.display = "none";
                window.location.href = "home.html";
            })
            .catch((error) => {
                console.error('Erro de autenticação:', error.code, error.message);
                loginError.style.display = "block";
                loginError.textContent = "Usuário ou senha incorretos.";
            });
    }

    loginBtn.addEventListener("click", autenticar);
    passwordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            autenticar();
        }
    });
});