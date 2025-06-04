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

    // Elementos da tela do sistema
    const sistemaStatus = document.getElementById("ledStatus");
    const volumeValue = document.getElementById("volumeValue");
    const alturaValue = document.getElementById("alturaValue");
    const ativacaoManualBtn = document.getElementById("ativacaoManualBtn");
    const alturaInput = document.getElementById("userInput");
    const historicoList = document.getElementById("historicoList");
    const preenchimento = document.getElementById("preenchimento");
    const volumeMedioDisplay = document.getElementById("volumeMedio");
    const tempoMedioProgress = document.getElementById("tempoMedioProgress");
    const tempoMedioValue = document.getElementById("tempoMedioValue");
    const logoutBtn = document.getElementById("logoutBtn");

    // Depuração: Verificar se o botão foi encontrado
    console.log('Botão de logout encontrado:', logoutBtn);

    // Variáveis para cálculos
    let volumeHistorico = [];
    let esvaziamentoTempos = [];
    let ultimoVolume = 0;
    let inicioEsvaziamentoTimestamp = null;

    // Verifica autenticação
    firebase.auth().onAuthStateChanged(user => {
        console.log('Usuário Firebase:', user ? user.email : 'Nenhum usuário');
        if (!user) {
            console.log('Nenhum usuário autenticado, redirecionando para login.html');
            window.location.href = '/login.html';
        } else {
            iniciarSistema();
        }
    });

    // Evento de logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            console.log('Botão de logout clicado');
            firebase.auth().signOut()
                .then(() => {
                    console.log("Usuário deslogado com sucesso");
                    window.location.href = "/login.html";
                })
                .catch((error) => {
                    console.error("Erro ao deslogar:", error.code, error.message);
                    alert("Erro ao deslogar: " + error.message);
                });
        });
    } else {
        console.error('Elemento logoutBtn não encontrado no DOM');
    }

    // Função para atualizar as cores do preenchimento
    function atualizarCorPreenchimento(volume) {
        preenchimento.style.background = "";
        preenchimento.style.backgroundColor = "";
        preenchimento.style.backgroundImage = "";

        if (volume >= 90) {
            preenchimento.style.background = "linear-gradient(0deg, #dc3545 0%, #c82333 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #c82333 0%, #b02a30 100%)');
            console.log("Volume >= 90%, Cor: Vermelho");
        } else if (volume >= 70) {
            preenchimento.style.background = "linear-gradient(0deg, #ffc107 0%, #e0a800 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #e0a800 0%, #cc9900 100%)');
            console.log("Volume 70-89.9%, Cor: Amarelo");
        } else {
            preenchimento.style.background = "linear-gradient(0deg, #28a745 0%, #218838 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #218838 0%, #1e7e34 100%)');
            console.log("Volume < 70%, Cor: Verde");
        }
    }

    // Função para atualizar o histórico na interface
    function atualizarHistorico(historico) {
        historicoList.innerHTML = "";
        historico.slice(0, 10).forEach((entry) => {
            const li = document.createElement("li");
            li.className = "list-group-item";
            if (entry.type === "volume") {
                li.textContent = `${new Date(entry.timestamp).toLocaleString("pt-BR")}: Volume ${entry.volume}%`;
            } else if (entry.type === "ativação") {
                li.textContent = `${new Date(entry.timestamp).toLocaleString("pt-BR")}: Ativação Manual`;
            } else if (entry.type === "esvaziamento") {
                li.textContent = `${new Date(entry.timestamp).toLocaleString("pt-BR")}: Esvaziamento (Tempo: ${entry.tempo} minutos)`;
            } else if (entry.type === "desativação") {
                li.textContent = `${new Date(entry.timestamp).toLocaleString("pt-BR")}: Desativação Manual`;
            }
            historicoList.appendChild(li);
        });
        console.log("Histórico atualizado na interface:", historico.slice(0, 10));
    }

    // Inicializa o sistema
    function iniciarSistema() {
        const database = firebase.database();

        database.ref("historico").once("value").then((snapshot) => {
            console.log("Snapshot recebido:", snapshot.val());
            const historicoData = snapshot.val() || {};
            const historico = Object.values(historicoData).sort((a, b) => b.timestamp - a.timestamp);
            atualizarHistorico(historico);
            console.log("Histórico inicial carregado:", historico);
        }).catch((error) => {
            console.error("Erro ao carregar histórico inicial:", error.code, error.message);
            alert("Erro ao carregar histórico: Verifique as permissões do Firebase.");
        });

        database.ref("historico").on("child_added", (snapshot) => {
            const historico = [];
            database.ref("historico").once("value").then((snap) => {
                Object.values(snap.val() || {}).forEach(item => historico.push(item));
                historico.sort((a, b) => b.timestamp - a.timestamp);
                atualizarHistorico(historico);
            }).catch((error) => {
                console.error("Erro ao atualizar histórico:", error.code, error.message);
                alert("Erro ao atualizar histórico: Verifique as permissões do Firebase.");
            });
        });

        database.ref("esvaziamentos").once("value").then((snapshot) => {
            const esvaziamentoData = snapshot.val() || {};
            esvaziamentoTempos = Object.values(esvaziamentoData).map(item => item.tempo).slice(0, 5);
            const tempoMedio = esvaziamentoTempos.length > 0
                ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                : 0;
            updateTempoMedioDisplay(tempoMedio);
            console.log("Tempos de esvaziamento iniciais carregados:", esvaziamentoTempos, "Média:", tempoMedio);
        }).catch((error) => {
            console.error("Erro ao carregar esvaziamentos iniciais:", error.code, error.message);
            alert("Erro ao carregar esvaziamentos: Verifique as permissões do Firebase.");
        });

        database.ref("sensor/ativacaoManual").on("value", (snapshot) => {
            const estado = snapshot.val();
            console.log("Estado atual da ativação manual:", estado);
            sistemaStatus.textContent = estado ? "Ativado" : "Desativado";
            sistemaStatus.className = `badge bg-${estado ? "success" : "danger"}`;
            console.log("Interface atualizada - Status:", estado ? "Ativado" : "Desativado");
        });

        database.ref("sensor/volume").on("value", (snapshot) => {
            const volume = snapshot.val() || 0;
            const currentTimestamp = Date.now();
            console.log("Volume recebido:", volume, "Timestamp:", new Date(currentTimestamp).toLocaleString("pt-BR"));

            volumeValue.textContent = `${volume.toFixed(1)}%`;

            if (volume >= 90) {
                volumeValue.className = "badge bg-danger";
            } else if (volume >= 70) {
                volumeValue.className = "badge bg-warning";
            } else {
                volumeValue.className = "badge bg-success";
            }

            atualizarCorPreenchimento(volume);

            if (volume > 1 && ultimoVolume <= 1 && inicioEsvaziamentoTimestamp === null) {
                inicioEsvaziamentoTimestamp = currentTimestamp;
                console.log("Início do ciclo de esvaziamento detectado. Timestamp:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
            }

            if (volume <= 1 && inicioEsvaziamentoTimestamp !== null) {
                const diffMilissegundos = currentTimestamp - inicioEsvaziamentoTimestamp;
                const tempoDecorrido = Math.floor(diffMilissegundos / (1000 * 60));
                console.log("Esvaziamento detectado: volume =", volume, "Tempo decorrido (ms) =", diffMilissegundos, "Tempo (min) =", tempoDecorrido);

                if (tempoDecorrido > 0) {
                    esvaziamentoTempos.push(tempoDecorrido);
                    if (esvaziamentoTempos.length > 5) esvaziamentoTempos.shift();

                    const esvaziamentoEntry = { tempo: tempoDecorrido, timestamp: currentTimestamp };
                    database.ref("esvaziamentos").push(esvaziamentoEntry)
                        .then(() => console.log("Esvaziamento salvo no Firebase:", esvaziamentoEntry))
                        .catch((error) => {
                            console.error("Erro ao salvar esvaziamento:", error);
                            alert("Erro ao salvar esvaziamento: " + error.message);
                        });

                    const tempoMedio = esvaziamentoTempos.length > 0
                        ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                        : 0;
                    updateTempoMedioDisplay(tempoMedio);
                    console.log("Tempo médio atualizado:", tempoMedio, "Tempos:", esvaziamentoTempos);

                    const historicoEntry = { type: "esvaziamento", timestamp: currentTimestamp, tempo: tempoDecorrido };
                    database.ref("historico").push(historicoEntry)
                        .then(() => console.log("Esvaziamento salvo no histórico"))
                        .catch((error) => {
                            console.error("Erro ao salvar esvaziamento no histórico:", error);
                            alert("Erro ao salvar esvaziamento no histórico: " + error.message);
                        });
                }
                inicioEsvaziamentoTimestamp = null;
            }

            preenchimento.style.height = `${volume}%`;

            volumeHistorico.push({ volume, timestamp: currentTimestamp });
            if (volumeHistorico.length > 10) volumeHistorico.shift();
            console.log("Volume histórico (últimas 10):", volumeHistorico);

            const volumeMedio = volumeHistorico.length > 0
                ? (volumeHistorico.reduce((sum, v) => sum + v.volume, 0) / volumeHistorico.length).toFixed(1)
                : 0;
            console.log("Volume médio calculado (últimas 10):", volumeMedio);
            volumeMedioDisplay.style.width = `${volumeMedio}%`;
            volumeMedioDisplay.setAttribute("aria-valuenow", volumeMedio);
            volumeMedioDisplay.textContent = `${volumeMedio}%`;
            document.getElementById("volumeMedioText").textContent = `${volumeMedio}%`;

            const historicoEntry = { type: "volume", volume: volume.toFixed(1), timestamp: currentTimestamp };
            database.ref("historico").push(historicoEntry)
                .then(() => console.log("Volume salvo no histórico"))
                .catch((error) => {
                    console.error("Erro ao salvar volume no histórico:", error);
                    alert("Erro ao salvar volume no histórico: " + error.message);
                });

            ultimoVolume = volume;
        });

        database.ref("sensor/altura").on("value", (snapshot) => {
            const altura = snapshot.val() || "N/D";
            console.log("Altura recebida:", altura);
            alturaValue.textContent = altura !== "N/D" ? `${altura} cm` : "N/D";
        });
    }

    function ativacaoManual() {
        console.log("Iniciando ativação manual...");
        const timestamp = Date.now();
        const historicoEntry = { type: "ativação", timestamp };
        firebase.database().ref("historico").push(historicoEntry)
            .then(() => console.log("Ativação salva no histórico"))
            .catch((error) => {
                console.error("Erro ao salvar ativação:", error);
                alert("Erro ao salvar ativação: " + error.message);
            });

        firebase.database().ref("sensor/ativacaoManual").set(true)
            .then(() => {
                console.log("Ativação manual: ATIVADO");
                sistemaStatus.textContent = "Ativado";
                sistemaStatus.className = "badge bg-success";
            })
            .catch((error) => {
                console.error("Erro ao ativar:", error);
                alert("Erro ao ativar: " + error.message);
            });
    }

    function desativacaoManual() {
        console.log("Iniciando desativação manual...");
        const timestamp = Date.now();
        const historicoEntry = { type: "desativação", timestamp };
        firebase.database().ref("historico").push(historicoEntry)
            .then(() => console.log("Desativação salva no histórico"))
            .catch((error) => {
                console.error("Erro ao salvar desativação:", error);
                alert("Erro ao salvar desativação: " + error.message);
            });

        firebase.database().ref("sensor/ativacaoManual").set(false)
            .then(() => {
                console.log("Desativação manual: DESATIVADO");
                sistemaStatus.textContent = "Desativado";
                sistemaStatus.className = "badge bg-danger";
            })
            .catch((error) => {
                console.error("Erro ao desativar:", error);
                alert("Erro ao desativar: " + error.message);
            });
    }

    function definirAltura() {
        const alturaInputValue = alturaInput.value;
        const alturaValue = parseFloat(alturaInputValue);

        if (isNaN(alturaValue) || alturaInputValue.trim() === "") {
            alert("Por favor, digite um número válido para a altura.");
            return;
        }

        firebase.database().ref("sensor/altura").set(alturaValue)
            .then(() => {
                console.log("Altura definida com sucesso: " + alturaValue);
                alert("Altura definida com sucesso: " + alturaValue + " cm");
                alturaInput.value = "";
            })
            .catch((error) => {
                console.error("Erro ao definir altura:", error);
                alert("Erro ao definir altura: " + error.message);
            });
    }

    function updateTempoMedioDisplay(tempoMedio) {
        const progressWidth = (tempoMedio / 10) * 100;
        tempoMedioProgress.style.width = `${progressWidth}%`;
        tempoMedioProgress.setAttribute("aria-valuenow", tempoMedio);
        tempoMedioValue.textContent = `${tempoMedio} min`;
    }

    window.definirAltura = definirAltura;
    window.desativacaoManual = desativacaoManual;

    ativacaoManualBtn.addEventListener("click", ativacaoManual);
    alturaInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            definirAltura();
        }
    });
});