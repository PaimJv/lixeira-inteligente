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

    // Credenciais do usuário para o Firebase
    const email = "lixeira1@gmail.com";
    const password = "lixeira123";

    // Elementos da tela do sistema
    const sistemaStatus = document.getElementById("ledStatus");
    const volumeValue = document.getElementById("volumeValue");
    const alturaValue = document.getElementById("alturaValue");
    const novaLeituraBtn = document.getElementById("novaLeituraBtn");
    const restaurarLixeiraBtn = document.getElementById("restaurarLixeiraBtn");
    const historicoList = document.getElementById("historicoList");
    const preenchimento = document.getElementById("preenchimento");
    const volumeMedioDisplay = document.getElementById("volumeMedio");
    const volumeMedioText = document.getElementById("volumeMedioText");
    const tempoMedioProgress = document.getElementById("tempoMedioProgress");
    const tempoMedioValue = document.getElementById("tempoMedioValue");

    // Variáveis para cálculos
    let esvaziamentoTempos = []; // Para calcular tempo até esvaziamento (máximo 5 tempos)
    let ultimoVolume = 0; // Último volume registrado
    let inicioEsvaziamentoTimestamp = null; // Timestamp quando o volume sai de 0%
    let isFirstLoad = true; // Flag para identificar a primeira leitura após o carregamento

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

    // Função para atualizar o histórico na interface e calcular o Volume Médio
    function atualizarHistoricoEVolumeMedio(historico) {
        historicoList.innerHTML = "";
        const volumeMedicoes = historico.filter(entry => entry.type === "volume").slice(0, 10);
        const volumeMedio = volumeMedicoes.length > 0
            ? (volumeMedicoes.reduce((sum, v) => sum + parseFloat(v.volume), 0) / volumeMedicoes.length).toFixed(1)
            : 0;

        // Exibir as últimas 10 entradas do histórico, independentemente do tipo
        historico.slice(0, 10).forEach((entry) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            let badgeClass = "";
            let badgeText = "";

            if (entry.type === "volume") {
                li.innerHTML = `
                    <div>
                        <strong>Medição: ${entry.volume}% de ocupação</strong>
                        <small class="text-muted d-block">${new Date(entry.timestamp).toLocaleString("pt-BR")}</small>
                    </div>`;
                badgeClass = "bg-warning";
                badgeText = "Medição";
            } else if (entry.type === "ativação") {
                li.innerHTML = `
                    <div>
                        <strong>Sistema Ativado</strong>
                        <small class="text-muted d-block">${new Date(entry.timestamp).toLocaleString("pt-BR")}</small>
                    </div>`;
                badgeClass = "bg-success";
                badgeText = "Ativo";
            } else if (entry.type === "esvaziamento") {
                li.innerHTML = `
                    <div>
                        <strong>Esvaziamento (Tempo: ${entry.tempo} min)</strong>
                        <small class="text-muted d-block">${new Date(entry.timestamp).toLocaleString("pt-BR")}</small>
                    </div>`;
                badgeClass = "bg-info";
                badgeText = "Esvaziamento";
            } else if (entry.type === "restaurar") {
                li.innerHTML = `
                    <div>
                        <strong>Lixeira Restaurada</strong>
                        <small class="text-muted d-block">${new Date(entry.timestamp).toLocaleString("pt-BR")}</small>
                    </div>`;
                badgeClass = "bg-warning";
                badgeText = "Restaurar";
            }

            const badge = document.createElement("span");
            badge.className = `badge ${badgeClass} rounded-pill`;
            badge.textContent = badgeText;
            li.appendChild(badge);
            historicoList.appendChild(li);
        });

        volumeMedioDisplay.style.width = `${volumeMedio}%`;
        volumeMedioDisplay.setAttribute("aria-valuenow", volumeMedio);
        volumeMedioDisplay.textContent = `${volumeMedio}%`;
        volumeMedioText.textContent = `${volumeMedio}%`;
        console.log("Volume médio calculado a partir do histórico:", volumeMedio, "Medições:", volumeMedicoes);
        console.log("Histórico exibido na interface:", historico.slice(0, 10));
    }

    // Função para atualizar a exibição do tempo médio
    function updateTempoMedioDisplay(tempoMedio) {
        const normalizedTempo = isNaN(tempoMedio) || tempoMedio <= 0 ? 0 : Math.round(tempoMedio);
        const progressWidth = Math.min((normalizedTempo / 10) * 100, 100); // Escala de 0 a 10 minutos
        tempoMedioProgress.style.width = `${progressWidth}%`;
        tempoMedioProgress.setAttribute("aria-valuenow", normalizedTempo);
        tempoMedioProgress.textContent = `${normalizedTempo} min`;
        tempoMedioValue.textContent = `${normalizedTempo} minutos`;
        console.log("Tempo médio exibido:", normalizedTempo, "Progresso:", progressWidth);
    }

    // Função para realizar nova leitura
    function realizarNovaLeitura() {
        console.log("Iniciando nova leitura...");
        const timestamp = Date.now();
        const historicoEntry = { type: "ativação", timestamp };

        firebase.database().ref("historico").push(historicoEntry)
            .then(() => console.log("Ativação manual salva no histórico"))
            .catch((error) => console.error("Erro ao salvar ativação no histórico:", error));

        firebase.database().ref("sensor/ativacaoManual").set(true)
            .then(() => {
                console.log("Ativação manual: ATIVADO por 1 segundo");
                sistemaStatus.textContent = "Ativado";
                sistemaStatus.className = "badge bg-success";

                setTimeout(() => {
                    firebase.database().ref("sensor/ativacaoManual").set(false)
                        .then(() => {
                            console.log("Ativação manual: DESATIVADO após 1 segundo");
                            sistemaStatus.textContent = "Desativado";
                            sistemaStatus.className = "badge bg-danger";
                        })
                        .catch((error) => {
                            console.error("Erro ao desativar após 1 segundo:", error);
                            alert("Erro ao desativar após leitura: " + error.message);
                        });
                }, 1000);
            })
            .catch((error) => {
                console.error("Erro ao ativar leitura:", error);
                alert("Erro ao realizar nova leitura: " + error.message);
            });
    }

    // Função para restaurar lixeira
    function restaurarLixeira() {
        console.log("Iniciando restauração da lixeira...");
        const timestamp = Date.now();
        const historicoEntry = { type: "restaurar", timestamp };

        firebase.database().ref("historico").push(historicoEntry)
            .then(() => console.log("Restauração salva no histórico"))
            .catch((error) => console.error("Erro ao salvar restauração no histórico:", error));

        // Redefinir altura para 0 (ou outro valor padrão)
        firebase.database().ref("sensor/altura").set(0)
            .then(() => {
                console.log("Altura redefinida para 0");
                alturaValue.textContent = "0 cm";

                // Acionar ativação manual para recalcular altura
                firebase.database().ref("sensor/ativacaoManual").set(true)
                    .then(() => {
                        console.log("Ativação manual para recalcular altura: ATIVADO por 1 segundo");
                        sistemaStatus.textContent = "Ativado";
                        sistemaStatus.className = "badge bg-success";

                        setTimeout(() => {
                            firebase.database().ref("sensor/ativacaoManual").set(false)
                                .then(() => {
                                    console.log("Ativação manual para recalcular altura: DESATIVADO após 1 segundo");
                                    sistemaStatus.textContent = "Desativado";
                                    sistemaStatus.className = "badge bg-danger";
                                })
                                .catch((error) => {
                                    console.error("Erro ao desativar após recalcular altura:", error);
                                    alert("Erro ao desativar após restauração: " + error.message);
                                });
                        }, 1000);
                    })
                    .catch((error) => {
                        console.error("Erro ao ativar para recalcular altura:", error);
                        alert("Erro ao restaurar lixeira: " + error.message);
                    });
            })
            .catch((error) => {
                console.error("Erro ao redefinir altura:", error);
                alert("Erro ao restaurar lixeira: " + error.message);
            });
    }

    // Inicializa o sistema
    function iniciarSistema() {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase inicializado com sucesso");
        const database = firebase.database();

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Autenticado com sucesso como:", userCredential.user.email);

                // Carregar o valor inicial do sensor/volume para inicializar ultimoVolume
                database.ref("sensor/volume").once("value").then((snapshot) => {
                    ultimoVolume = snapshot.val() || 0;
                    volumeValue.textContent = `${ultimoVolume.toFixed(1)}%`;
                    if (ultimoVolume >= 90) {
                        volumeValue.className = "badge bg-danger";
                    } else if (ultimoVolume >= 70) {
                        volumeValue.className = "badge bg-warning";
                    } else {
                        volumeValue.className = "badge bg-success";
                    }
                    atualizarCorPreenchimento(ultimoVolume);
                    preenchimento.style.height = `${ultimoVolume}%`;

                    // Carregar histórico do Firebase para preencher a interface e calcular o Volume Médio
                    database.ref("historico").once("value").then((snapshot) => {
                        const historicoData = snapshot.val() || {};
                        const historico = Object.values(historicoData).sort((a, b) => b.timestamp - a.timestamp);
                        atualizarHistoricoEVolumeMedio(historico);

                        // Inicializar o inicioEsvaziamentoTimestamp com base no histórico
                        const ultimaMedicao = historico.filter(entry => entry.type === "volume").slice(0, 1)[0];
                        if (ultimaMedicao && parseFloat(ultimaMedicao.volume) > 1) {
                            inicioEsvaziamentoTimestamp = ultimaMedicao.timestamp;
                            console.log("Ciclo de esvaziamento iniciado com base no histórico. Timestamp:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
                        }
                    }).catch((error) => {
                        console.error("Erro ao carregar histórico inicial:", error);
                        alert("Erro ao carregar histórico: Verifique as permissões do Firebase.");
                    });

                    // Escutar mudanças no histórico
                    database.ref("historico").on("child_added", () => {
                        database.ref("historico").once("value").then((snap) => {
                            const historico = Object.values(snap.val() || {}).sort((a, b) => b.timestamp - a.timestamp);
                            atualizarHistoricoEVolumeMedio(historico);
                        }).catch((error) => {
                            console.error("Erro ao atualizar histórico:", error);
                            alert("Erro ao atualizar histórico: Verifique as permissões do Firebase.");
                        });
                    });

                    // Carregar tempos de esvaziamento do Firebase
                    database.ref("esvaziamentos").once("value").then((snapshot) => {
                        const esvaziamentoData = snapshot.val() || {};
                        esvaziamentoTempos = Object.values(esvaziamentoData).map(item => item.tempo).slice(0, 5);
                        const tempoMedio = esvaziamentoTempos.length > 0
                            ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                            : 0;
                        updateTempoMedioDisplay(tempoMedio);
                        console.log("Tempos de esvaziamento iniciais carregados:", esvaziamentoTempos, "Média:", tempoMedio);
                    }).catch((error) => {
                        console.error("Erro ao carregar esvaziamentos iniciais:", error);
                        alert("Erro ao carregar esvaziamentos: Verifique as permissões do Firebase.");
                    });

                    // Leitura em tempo real de sensor/ativacaoManual
                    database.ref("sensor/ativacaoManual").on("value", (snapshot) => {
                        const estado = snapshot.val();
                        console.log("Estado atual da ativação manual:", estado);
                        sistemaStatus.textContent = estado ? "Ativado" : "Desativado";
                        sistemaStatus.className = `badge bg-${estado ? "success" : "danger"}`;
                        console.log("Interface atualizada - Status:", estado ? "Ativado" : "Desativado");
                    });

                    // Leitura em tempo real de sensor/volume
                    database.ref("sensor/volume").on("value", (snapshot) => {
                        const volume = snapshot.val() || 0;
                        const currentTimestamp = Date.now();
                        console.log("Volume recebido:", volume, "Timestamp:", new Date(currentTimestamp).toLocaleString("pt-BR"));

                        // Atualizar a interface com o volume atual
                        volumeValue.textContent = `${volume.toFixed(1)}%`;
                        if (volume >= 90) {
                            volumeValue.className = "badge bg-danger";
                        } else if (volume >= 70) {
                            volumeValue.className = "badge bg-warning";
                        } else {
                            volumeValue.className = "badge bg-success";
                        }

                        atualizarCorPreenchimento(volume);
                        preenchimento.style.height = `${volume}%`;

                        // Se for a primeira leitura após o carregamento, apenas atualizamos a interface
                        if (isFirstLoad) {
                            console.log("Primeira leitura após carregamento, apenas atualizando interface.");
                            isFirstLoad = false;
                            return; // Não processa como nova medição
                        }

                        // Lógica para detectar o início do ciclo de esvaziamento
                        if (volume > 1 && ultimoVolume <= 1 && inicioEsvaziamentoTimestamp === null) {
                            inicioEsvaziamentoTimestamp = currentTimestamp;
                            console.log("Início do ciclo de esvaziamento detectado. Timestamp:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
                        }

                        // Lógica para detectar esvaziamento
                        if (volume <= 1 && inicioEsvaziamentoTimestamp !== null) {
                            const diffMilissegundos = currentTimestamp - inicioEsvaziamentoTimestamp;
                            const tempoDecorrido = Math.floor(diffMilissegundos / (1000 * 60));
                            console.log("Esvaziamento detectado: volume =", volume, "Tempo decorrido (min) =", tempoDecorrido);

                            if (tempoDecorrido > 0) {
                                esvaziamentoTempos.push(tempoDecorrido);
                                if (esvaziamentoTempos.length > 5) esvaziamentoTempos.shift();

                                const esvaziamentoEntry = { tempo: tempoDecorrido, timestamp: currentTimestamp };
                                database.ref("esvaziamentos").push(esvaziamentoEntry)
                                    .then(() => console.log("Esvaziamento salvo no Firebase:", esvaziamentoEntry))
                                    .catch((error) => {
                                        console.error("Erro ao salvar esvaziamento no Firebase:", error);
                                        alert("Erro ao salvar esvaziamento: Verifique as permissões do Firebase.");
                                    });

                                const historicoEntry = { type: "esvaziamento", timestamp: currentTimestamp, tempo: tempoDecorrido };
                                database.ref("historico").push(historicoEntry)
                                    .then(() => console.log("Esvaziamento salvo no histórico"))
                                    .catch((error) => {
                                        console.error("Erro ao salvar esvaziamento no histórico:", error);
                                        alert("Erro ao salvar esvaziamento no histórico: Verifique as permissões do Firebase.");
                                    });

                                const tempoMedio = esvaziamentoTempos.length > 0
                                    ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                                    : 0;
                                updateTempoMedioDisplay(tempoMedio);
                                console.log("Tempo médio atualizado:", tempoMedio, "Tempos:", esvaziamentoTempos);
                            }

                            inicioEsvaziamentoTimestamp = null;
                        }

                        // Só salvar no histórico se o volume mudou
                        if (volume !== ultimoVolume) {
                            const historicoEntry = { type: "volume", volume: volume.toFixed(1), timestamp: currentTimestamp };
                            database.ref("historico").push(historicoEntry)
                                .then(() => console.log("Volume salvo no histórico"))
                                .catch((error) => {
                                    console.error("Erro ao salvar volume no histórico:", error);
                                    alert("Erro ao salvar volume no histórico: Verifique as permissões do Firebase.");
                                });
                        }

                        ultimoVolume = volume;
                    });

                    // Leitura em tempo real de sensor/altura
                    database.ref("sensor/altura").on("value", (snapshot) => {
                        const altura = snapshot.val() || "N/D";
                        console.log("Altura recebida:", altura);
                        alturaValue.textContent = altura !== "N/D" ? `${altura} cm` : "N/D";
                    });
                }).catch((error) => {
                    console.error("Erro ao carregar valor inicial do sensor/volume:", error);
                    alert("Erro ao carregar valor inicial: Verifique as permissões do Firebase.");
                });
            })
            .catch((error) => {
                console.error("Erro na autenticação:", error);
                alert("Erro na autenticação: " + error.message);
            });
    }

    // Eventos
    novaLeituraBtn.addEventListener("click", realizarNovaLeitura);
    restaurarLixeiraBtn.addEventListener("click", restaurarLixeira);

    // Iniciar o sistema ao carregar a página
    iniciarSistema();
});
