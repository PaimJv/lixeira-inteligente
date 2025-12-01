// ================== LOGIN.JS ================== //
document.addEventListener("DOMContentLoaded", function () {

    // 🔑 Credenciais locais (podem ser alteradas)
    const LOGIN_CREDENCIAIS = {
        usuario: "admin",
        senha: "admin"
    };

    // Elementos DOM
    const loginInput = document.getElementById("loginInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    // -------- Função de autenticação -------- //
    function autenticar() {
        const usuario = loginInput.value.trim();
        const senha = passwordInput.value.trim();

        if (usuario === LOGIN_CREDENCIAIS.usuario && senha === LOGIN_CREDENCIAIS.senha) {

            loginError.style.display = "none";

            // Salvar login para manter logado (opcional)
            localStorage.setItem("LOGADO", "true");

            // Redirecionar para o sistema
            window.location.href = "home.html";

        } else {
            loginError.style.display = "block";
        }
    }

    // Eventos de interação
    loginBtn.addEventListener("click", autenticar);

    passwordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            autenticar();
        }
    });

});
