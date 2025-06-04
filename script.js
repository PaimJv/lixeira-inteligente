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

    // Variáveis para cálculos e controle
    let esvaziamentoTempos = []; // Para calcular tempo até esvaziamento (máximo 5 tempos)
    let ultimoVolume = 0; // Último volume registrado
    let inicioEsvaziamentoTimestamp = null; // Timestamp quando o volume sai de 0%
    let isFirstLoad = true; // Flag para identificar a primeira leitura após o carregamento
    let alerta90Exibido = false; // Flag para controlar a exibição única do alerta de 90%
    let mensagemWhatsAppEnviada = false; // Flag para controlar o envio único da mensagem WhatsApp

    // Configurações para o CallMeBot
    const callMeBotApiKey = "3113566"; // Sua API Key do CallMeBot
    const numeroWhatsApp = "+557592230180"; // Seu número de destino no formato internacional

    // Função para enviar mensagem via WhatsApp usando CallMeBot
    function enviarMensagemWhatsApp(mensagem) {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${numeroWhatsApp}&text=${encodeURIComponent(mensagem)}&apikey=${callMeBotApiKey}`;
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro ao enviar mensagem WhatsApp: ${response.statusText}`);
                }
                console.log("Mensagem WhatsApp enviada com sucesso!");
            })
            .catch(error => {
                console.error("Erro ao enviar mensagem WhatsApp:", error);
            });
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

    // Função para atualizar o histórico na interface e calcular o Volume Médio
    function atualizarHistoricoEVolumeMedio(historico) {
        historicoList.innerHTML = "";
        const volumeMedicoes = historico.filter(entry => entry.type === "volume").slice(0, 10);
        const volumeMedio = volumeMedicoes.length > 0
            ? (volumeMedicoes.reduce((sum, v) => sum + parseFloat(v.volume), 0) / volumeMedicoes.length).toFixed(1)
            : 0;

        if (historico.length === 0) {
            historicoList.innerHTML = '<li class="list-group-item text-center">Nenhum registro encontrado</li>';
        } else {
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
        }

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
        tempoMedioProgress.textContent = ""; // Remover o texto da barra
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

        // Redefinir altura usando novaLixeira e forçar volume para 0
        firebase.database().ref("sensor/novaLixeira").set(true)
            .then(() => {
                console.log("novaLixeira definido como true");
                // Forçar volume para 0 para garantir que o esvaziamento seja detectado
                return firebase.database().ref("sensor/volume").set(0);
            })
            .then(() => {
                console.log("Volume redefinido para 0 no Firebase");
                alturaValue.textContent = "0 cm";

                // Acionar ativação manual para recalcular altura
                firebase.database().ref("sensor/ativacaoManual").set(true)
                    .then(() => {
                        console.log("Ativação manual para recalcular altura: ATIVADO por 1 segundo");
                        sistemaStatus.textContent = "Ativado";
                        sistemaStatus.className = "badge bg-success";

                        setTimeout(() => {
                            firebase.database().ref("sensor/novaLixeira").set(false);
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
                        }, 2000);
                    })
                    .catch((error) => {
                        console.error("Erro ao ativar para recalcular altura:", error);
                        alert("Erro ao restaurar lixeira: " + error.message);
                    });
            })
            .catch((error) => {
                console.error("Erro ao redefinir altura ou volume:", error);
                alert("Erro ao restaurar lixeira: " + error.message);
            });
    }

    // Função para inicializar a interface após carregar os dados
    function inicializarInterface() {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase inicializado com sucesso");
        const database = firebase.database();

        return firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Autenticado com sucesso como:", userCredential.user.email);

                // Carregar dados iniciais em paralelo
                const volumePromise = database.ref("sensor/volume").once("value");
                const historicoPromise = database.ref("historico").once("value");
                const esvaziamentosPromise = database.ref("esvaziamentos").once("value");

                return Promise.all([volumePromise, historicoPromise, esvaziamentosPromise])
                    .then(([volumeSnapshot, historicoSnapshot, esvaziamentosSnapshot]) => {
                        // Inicializar volume
                        ultimoVolume = volumeSnapshot.val() || 0;
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

                        // Inicializar histórico
                        const historicoData = historicoSnapshot.val() || {};
                        const historico = Object.values(historicoData).sort((a, b) => b.timestamp - a.timestamp);
                        atualizarHistoricoEVolumeMedio(historico);

                        // Inicializar tempos de esvaziamento
                        const esvaziamentoData = esvaziamentosSnapshot.val() || {};
                        esvaziamentoTempos = Object.values(esvaziamentoData).map(item => item.tempo).slice(0, 5);
                        const tempoMedio = esvaziamentoTempos.length > 0
                            ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                            : 0;
                        updateTempoMedioDisplay(tempoMedio);

                        // Inicializar inicioEsvaziamentoTimestamp com base no volume inicial
                        if (ultimoVolume > 1) {
                            const ultimaMedicao = historico.filter(entry => entry.type === "volume").slice(0, 1)[0];
                            if (ultimaMedicao) {
                                inicioEsvaziamentoTimestamp = ultimaMedicao.timestamp;
                                console.log("Ciclo de esvaziamento iniciado com base no volume inicial. Timestamp:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
                            } else {
                                inicioEsvaziamentoTimestamp = Date.now();
                                console.log("Nenhuma medição de volume no histórico, usando timestamp atual:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
                            }
                        } else {
                            console.log("Volume inicial <= 1, ciclo de esvaziamento não iniciado.");
                        }

                        // Configurar listeners em tempo real
                        database.ref("sensor/volume").on("value", (snapshot) => {
                            const volume = snapshot.val() || 0;
                            const currentTimestamp = Date.now();
                            console.log("Volume recebido:", volume, "Timestamp:", new Date(currentTimestamp).toLocaleString("pt-BR"));

                            volumeValue.textContent = `${volume.toFixed(1)}%`;
                            if (volume >= 90) {
                                volumeValue.className = "badge bg-danger";
                                if (!alerta90Exibido) {
                                    alert("Atenção! O volume da lixeira atingiu ou ultrapassou 90%. Por favor, esvazie a lixeira.");
                                    alerta90Exibido = true; // Marca o alerta como exibido
                                }
                                if (!mensagemWhatsAppEnviada) {
                                    const mensagem = `🚨 *Alerta de Lixeira Cheia!* 🚨\n\nA lixeira atingiu ${volume.toFixed(1)}% de ocupação. Por favor, esvazie a lixeira o quanto antes!\n\nData/Hora: ${new Date(currentTimestamp).toLocaleString("pt-BR")}`;
                                    enviarMensagemWhatsApp(mensagem);
                                    mensagemWhatsAppEnviada = true; // Marca a mensagem como enviada
                                }
                            } else if (volume >= 70) {
                                volumeValue.className = "badge bg-warning";
                                alerta90Exibido = false; // Reseta o flag se o volume voltar abaixo de 90%
                                mensagemWhatsAppEnviada = false; // Reseta o flag para permitir novo envio
                            } else {
                                volumeValue.className = "badge bg-success";
                                alerta90Exibido = false; // Reseta o flag se o volume voltar abaixo de 70%
                                mensagemWhatsAppEnviada = false; // Reseta o flag para permitir novo envio
                            }

                            atualizarCorPreenchimento(volume);
                            preenchimento.style.height = `${volume}%`;

                            if (isFirstLoad) {
                                console.log("Primeira leitura após carregamento, apenas atualizando interface.");
                                isFirstLoad = false;
                                return;
                            }

                            if (volume > 1 && ultimoVolume <= 1 && inicioEsvaziamentoTimestamp === null) {
                                inicioEsvaziamentoTimestamp = currentTimestamp;
                                console.log("Início do ciclo de esvaziamento detectado. Timestamp:", new Date(inicioEsvaziamentoTimestamp).toLocaleString("pt-BR"));
                            }

                            if (volume <= 2 && inicioEsvaziamentoTimestamp !== null) {
                                console.log("Possível esvaziamento detectado: volume =", volume, "inicioEsvaziamentoTimestamp =", inicioEsvaziamentoTimestamp);
                                const diffMilissegundos = currentTimestamp - inicioEsvaziamentoTimestamp;
                                const tempoDecorrido = Math.floor(diffMilissegundos / (1000 * 60));
                                console.log("Esvaziamento confirmado: volume =", volume, "Tempo decorrido (min) =", tempoDecorrido);

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
                                } else {
                                    console.log("Tempo decorrido inválido para esvaziamento:", tempoDecorrido);
                                }

                                inicioEsvaziamentoTimestamp = null;
                            } else {
                                console.log("Esvaziamento não detectado: volume =", volume, "inicioEsvaziamentoTimestamp =", inicioEsvaziamentoTimestamp);
                            }

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

                        database.ref("sensor/ativacaoManual").on("value", (snapshot) => {
                            const estado = snapshot.val();
                            console.log("Estado atual da ativação manual:", estado);
                            sistemaStatus.textContent = estado ? "Ativado" : "Desativado";
                            sistemaStatus.className = `badge bg-${estado ? "success" : "danger"}`;
                            console.log("Interface atualizada - Status:", estado ? "Ativado" : "Desativado");
                        });

                        database.ref("sensor/altura").on("value", (snapshot) => {
                            const altura = snapshot.val() || "N/D";
                            console.log("Altura recebida:", altura);
                            alturaValue.textContent = altura !== "N/D" ? `${Math.round(altura)} cm` : "N/D";
                        });

                        database.ref("historico").on("child_added", () => {
                            database.ref("historico").once("value").then((snap) => {
                                const historico = Object.values(snap.val() || {}).sort((a, b) => b.timestamp - a.timestamp);
                                atualizarHistoricoEVolumeMedio(historico);
                            }).catch((error) => {
                                console.error("Erro ao atualizar histórico:", error);
                                alert("Erro ao atualizar histórico: Verifique as permissões do Firebase.");
                            });
                        });
                    });
            });
    }

    // Eventos
    novaLeituraBtn.addEventListener("click", realizarNovaLeitura);
    restaurarLixeiraBtn.addEventListener("click", restaurarLixeira);

    // Iniciar o sistema ao carregar a página
    inicializarInterface()
        .catch((error) => {
            console.error("Erro na inicialização:", error);
            alert("Erro ao inicializar a aplicação: " + error.message);
        });

    // Inicializar os tooltips do Bootstrap
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
});