document.addEventListener("DOMContentLoaded", function () {
    // Credenciais de login local
    const LOGIN_CREDENCIAIS = {
        usuario: "admin",
        senha: "admin"
    };

    // Elementos da tela de login
    const loginInput = document.getElementById("loginInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    // Função para autenticar localmente e redirecionar para a página do sistema
    function autenticar() {
        const usuario = loginInput.value.trim();
        const senha = passwordInput.value.trim();

        if (usuario === LOGIN_CREDENCIAIS.usuario && senha === LOGIN_CREDENCIAIS.senha) {
            loginError.style.display = "none";
            localStorage.setItem('authToken', 'exemplo-token');
            // Redirecionar para a página do sistema
            window.location.href = "home.html";
        } else {
            loginError.style.display = "block";
        }
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