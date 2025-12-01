// ================== LOGIN.JS ================== //
document.addEventListener("DOMContentLoaded", function () {

    // 🔑 Credenciais locais
    const LOGIN_CREDENCIAIS = {
        usuario: "admin",
        senha: "admin"
    };

    const loginInput = document.getElementById("loginInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");
    const loginError = document.getElementById("loginError");

    function autenticar() {
        const usuario = loginInput.value.trim();
        const senha = passwordInput.value.trim();

        if (usuario === LOGIN_CREDENCIAIS.usuario && senha === LOGIN_CREDENCIAIS.senha) {

            loginError.style.display = "none";

            localStorage.setItem("LOGADO", "true");

            // ⚠️ Redireciona AGORA para a página de Termos
            window.location.href = "terms.html";

        } else {
            loginError.style.display = "block";
        }
    }

    loginBtn.addEventListener("click", autenticar);

    passwordInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            autenticar();
        }
    });

});
