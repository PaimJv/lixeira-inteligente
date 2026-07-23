document.addEventListener("DOMContentLoaded", function () {
    // ========== 1. CONFIGURAÇÃO FIREBASE E  AUTENTICAÇÃO ==========
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

    // ========== CREDENCIAIS TELEGRAM ==========
    const telegramBotToken = "8882849745:AAHohj7tRtZ-HRwtzcVYf4daEaG8xZhc0-4"; // Coloque o token do BotFather
    const telegramChatId = "-1003996173255"; // Coloque o seu ID numérico

    // // Configurações para o CallMeBot
    // const callMeBotApiKey = "3113566"; // Sua API Key do CallMeBot

    // ========== 2. ELEMENTOS DA INTERFACE ==========
    // Título dinâmico
    const lixeiraTitle = document.getElementById('lixeiraTitle');

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
    const cpuUsage = document.getElementById("cpuUsage");
    const latency = document.getElementById("latency");
    const ramUsage = document.getElementById("ramUsage");
    const temperature = document.getElementById("temperature");
    const alertaCritico = document.getElementById("alertaCritico"); // Faltava no seu JS original, mas estava no meu

    // ========== 3. VARIÁVEIS GLOBAIS DE ESTADO E CONTROLE ==========
    // ID da lixeira sendo exibida no momento
    let currentLixeiraId = 'lixeira1';
    let database; // Referência global para o DB do Firebase

    // Referências aos 'listeners' do Firebase
    let refVolume, refAltura, refAtivacao, refSystemInfo;

    // Variáveis de estado (serão resetadas a cada troca de lixeira)
    let esvaziamentoTempos = [];
    let ultimoVolume = 0;
    let inicioEsvaziamentoTimestamp = null;
    let isFirstLoad = true;
    let alerta70Exibido = false;
    let alerta80Exibido = false;
    // let mensagemWhatsAppEnviada = false;
    let mensagemTelegram70Enviada = false;
    let mensagemTelegram80Enviada = false;    
    let ultimoRegistroTimestamp = 0;
    let historicoLocal = [];

    // ========== 4. FUNÇÕES AUXILIARES (CallMeBot, UI) ==========
    // Função para enviar mensagem via WhatsApp (Sua função original)
    // function enviarMensagemWhatsApp(mensagem) {
    //     const url = `https://api.callmebot.com/whatsapp.php?phone=${numeroWhatsApp}&text=${encodeURIComponent(mensagem)}&apikey=${callMeBotApiKey}`;
    //     fetch(url)
    //         .then(response => {
    //             if (!response.ok) {
    //                 throw new Error(`Erro ao enviar mensagem WhatsApp: ${response.statusText}`);
    //             }
    //             console.log("Mensagem WhatsApp enviada com sucesso!");
    //         })
    //         .catch(error => {
    //             console.error("Erro ao enviar mensagem WhatsApp:", error);
    //         });
    // }

    // ========== 4. FUNÇÕES AUXILIARES (UI e API) ==========
    
    // Nova função para enviar mensagem via API oficial do Telegram
    function enviarMensagemTelegram(mensagem) {
        const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        
        // Monta o pacote de dados (payload)
        const data = {
            chat_id: telegramChatId,
            text: mensagem,
            parse_mode: "Markdown" // Permite o uso de *negrito* no alerta
        };

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro ao enviar mensagem Telegram: ${response.statusText}`);
            }
            console.log("Mensagem Telegram enviada com sucesso!");
        })
        .catch(error => {
            console.error("Erro ao enviar mensagem via Telegram:", error);
        });
    }

    // Função para atualizar as cores do preenchimento (Sua função original)
    function atualizarCorPreenchimento(volume) {
        preenchimento.style.background = "";
        preenchimento.style.backgroundColor = "";
        preenchimento.style.backgroundImage = "";

        if (volume >= 90) {
            preenchimento.style.background = "linear-gradient(0deg, #dc3545 0%, #c82333 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #c82333 0%, #b02a30 100%)');
        } else if (volume >= 70) {
            preenchimento.style.background = "linear-gradient(0deg, #ffc107 0%, #e0a800 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #e0a800 0%, #cc9900 100%)');
        } else {
            preenchimento.style.background = "linear-gradient(0deg, #28a745 0%, #218838 100%)";
            preenchimento.style.setProperty('--before-gradient', 'linear-gradient(0deg, #218838 0%, #1e7e34 100%)');
        }
    }

    // Função para atualizar o histórico localmente (Sua função original)
    function atualizarHistoricoLocal(novoEntry) {
        const entradaExistente = historicoLocal.find(entry =>
            entry.type === novoEntry.type &&
            Math.abs(entry.timestamp - novoEntry.timestamp) < 3000 &&
            (entry.type !== "volume" || Math.abs(entry.volume - novoEntry.volume) < 0.1)
        );

        if (!entradaExistente) {
            historicoLocal.unshift(novoEntry);
            if (historicoLocal.length > 50) {
                historicoLocal = historicoLocal.slice(0, 50);
            }
            atualizarHistoricoEVolumeMedio(historicoLocal);
            console.log("Histórico local atualizado:", novoEntry);
        } else {
            console.log("Entrada duplicada ignorada:", novoEntry);
        }
    }

    // Função para atualizar o histórico na interface e calcular o Volume Médio (Sua função original)
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
                let entryHtml = "";

                if (entry.type === "volume") {
                    entryHtml = `<strong>Medição: ${entry.volume}% de ocupação</strong>`;
                    badgeClass = "bg-warning";
                    badgeText = "Medição";
                } else if (entry.type === "ativação") {
                    entryHtml = `<strong>Leitura Ativada</strong>`;
                    badgeClass = "bg-success";
                    badgeText = "Ativo";
                } else if (entry.type === "esvaziamento") {
                    entryHtml = `<strong>Esvaziamento (Tempo: ${entry.tempo} min)</strong>`;
                    badgeClass = "bg-info";
                    badgeText = "Esvaziamento";
                } else if (entry.type === "restaurar") {
                    entryHtml = `<strong>Lixeira Restaurada</strong>`;
                    badgeClass = "bg-warning";
                    badgeText = "Restaurar";
                }

                li.innerHTML = `
                    <div>
                        ${entryHtml}
                        <small class="text-muted d-block">${new Date(entry.timestamp).toLocaleString("pt-BR")}</small>
                    </div>`;
                
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
    }

    // Função para atualizar a exibição do tempo médio (Sua função original)
    function updateTempoMedioDisplay(tempoMedio) {
        const normalizedTempo = isNaN(tempoMedio) || tempoMedio <= 0 ? 0 : Math.round(tempoMedio);
        const progressWidth = Math.min((normalizedTempo / 10) * 100, 100); // Escala de 0 a 10 minutos
        tempoMedioProgress.style.width = `${progressWidth}%`;
        tempoMedioProgress.setAttribute("aria-valuenow", normalizedTempo);
        tempoMedioProgress.textContent = ""; // Remover o texto da barra
        tempoMedioValue.textContent = `${normalizedTempo} minutos`;
    }

    // ========== 5. FUNÇÕES DE CONTROLE (Modificadas) ==========
    
    // Função para realizar nova leitura
    function realizarNovaLeitura() {
        console.log(`Iniciando nova leitura para ${currentLixeiraId}...`);
        const timestamp = Date.now();
        const historicoEntry = { type: "ativação", timestamp };

        // Caminho do Firebase agora é dinâmico
        const baseRef = database.ref(`lixeiras/${currentLixeiraId}`);

        baseRef.child("historico").push(historicoEntry)
            .then(() => {
                console.log("Ativação manual salva no histórico");
                atualizarHistoricoLocal(historicoEntry);
            })
            .catch((error) => console.error("Erro ao salvar ativação no histórico:", error));

        baseRef.child("sensor/ativacaoManual").set(true)
            .then(() => {
                console.log("Sinal de ativação enviado. Desligando em 3 segundos...");
                
                // Retorno da lógica de Timer: Garante que a medição será pontual e não contínua
                setTimeout(() => {
                    baseRef.child("sensor/ativacaoManual").set(false)
                        .then(() => console.log("ativacaoManual resetada para false com sucesso."))
                        .catch(err => console.error("Erro ao resetar ativacaoManual:", err));
                }, 3000); 
            })
            .catch((error) => {
                console.error("Erro ao ativar leitura:", error);
                alert("Erro ao realizar nova leitura: " + error.message);
            });
    }

   
    // Função para restaurar lixeira
    function restaurarLixeira() {
        console.log(`Iniciando restauração da lixeira ${currentLixeiraId}...`);
        const timestamp = Date.now();
        const historicoEntry = { type: "restaurar", timestamp };

        // Caminho do Firebase agora é dinâmico
        const baseRef = database.ref(`lixeiras/${currentLixeiraId}`);

        baseRef.child("historico").push(historicoEntry)
            .then(() => {
                console.log("Restauração salva no histórico");
                atualizarHistoricoLocal(historicoEntry);
            })
            .catch((error) => console.error("Erro ao salvar restauração no histórico:", error));

        baseRef.child("sensor/novaLixeira").set(true)
            .then(() => {
                console.log("novaLixeira definido como true");
                return baseRef.child("sensor/volume").set(0);
            })
            .then(() => {
                console.log("Volume redefinido para 0 no Firebase");
                return baseRef.child("sensor/ativacaoManual").set(true);
            })
            .then(() => {
                console.log("Ativado para recalcular altura. Desligando flags em 5 segundos...");
                
                // Lógica de Timer Expandida: Desliga a ativação E a flag de calibração
                setTimeout(() => {
                    // Desliga a ativação manual normalmente
                    baseRef.child("sensor/ativacaoManual").set(false)
                        .catch(err => console.error("Erro ao resetar ativacaoManual:", err));
                    
                    // FAIL-SAFE: Garante que a flag de nova lixeira não fique presa em 'true'
                    // Caso o ESP32 já tenha alterado para 'false' com sucesso, isso apenas sobrescreve com 'false', sem impacto.
                    baseRef.child("sensor/novaLixeira").set(false)
                        .then(() => console.log("novaLixeira resetada para false pela proteção do sistema web."))
                        .catch(err => console.error("Erro ao resetar novaLixeira:", err));

                }, 5000); // 5 segundos dão ao ESP32 tempo para executar as rotinas de anti-ruído
            })
            .catch((error) => {
                console.error("Erro ao redefinir altura ou volume:", error);
                alert("Erro ao restaurar lixeira: " + error.message);
            });
    }
    
    // ========== 6. LÓGICA PRINCIPAL DE CARREGAMENTO (Nova Estrutura) ==========
    /**
     * Reseta o estado e a UI para "carregando"
     */
    function resetUIState() {
        console.log("Resetando UI e estado...");
        // Resetar variáveis de estado
        esvaziamentoTempos = [];
        ultimoVolume = 0;
        inicioEsvaziamentoTimestamp = null;
        isFirstLoad = true;
        ultimoRegistroTimestamp = 0;
        historicoLocal = [];

        // Resetar variáveis de alerta
        alerta70Exibido = false;
        alerta80Exibido = false;
        mensagemTelegram70Enviada = false;
        mensagemTelegram80Enviada = false;

        // Resetar UI
        sistemaStatus.textContent = "Carregando...";
        sistemaStatus.className = "badge bg-secondary";
        volumeValue.textContent = "0%";
        volumeValue.className = "badge bg-info";
        alturaValue.textContent = "...";
        preenchimento.style.height = "0%";
        atualizarCorPreenchimento(0);
        alertaCritico.innerHTML = ""; // Limpar alerta
        historicoList.innerHTML = '<li class="list-group-item text-center">Carregando...</li>';
        cpuUsage.textContent = "0%";
        latency.textContent = "0 ms";
        ramUsage.textContent = "0%";
        temperature.textContent = "0°C";
        volumeMedioDisplay.style.width = "0%";
        volumeMedioDisplay.setAttribute("aria-valuenow", 0);
        volumeMedioDisplay.textContent = "0%";
        volumeMedioText.textContent = "0%";
        updateTempoMedioDisplay(0);
    }

    /**
     * Desliga todos os listeners ativos do Firebase
     */
    function detachAllListeners() {
        try {
            if (refVolume && typeof refVolume.off === 'function') refVolume.off();
            if (refAltura && typeof refAltura.off === 'function') refAltura.off();
            if (refAtivacao && typeof refAtivacao.off === 'function') refAtivacao.off();
            if (refSystemInfo && typeof refSystemInfo.off === 'function') refSystemInfo.off();
            console.log('Listeners antigos desligados.');
        } catch (err) {
            console.warn('Erro ao tentar desligar listeners:', err);
        }
    }

    /**
     * Função principal: Carrega todos os dados da lixeira selecionada
     * @param {string} lixeiraId (ex: "lixeira1")
     */
    function loadLixeiraData(lixeiraId) {
        console.log(`Carregando dados para: ${lixeiraId}`);
        currentLixeiraId = lixeiraId; // Atualiza o ID global

        // Atualiza o título da página: tenta pegar o texto do menu lateral pelo data-lixeira-id
        const sidebarLink = document.querySelector(`#sidebar .nav-link[data-lixeira-id="${lixeiraId}"]`);
        if (sidebarLink && sidebarLink.textContent && sidebarLink.textContent.trim() !== '') {
            lixeiraTitle.textContent = sidebarLink.textContent.trim();
        } else {
            // fallback: mantém o comportamento anterior (ex: "Lixeira 1")
            const lixeiraName = lixeiraId.charAt(0).toUpperCase() + lixeiraId.slice(1);
            lixeiraTitle.textContent = lixeiraName;
        }

        // 1. Desliga todos os 'listeners' antigos
        detachAllListeners();

        // 2. Limpa a UI e reseta variáveis de estado
        resetUIState();

        // 3. Cria o caminho de referência base para a lixeira no Firebase
        const baseRef = database.ref(`lixeiras/${lixeiraId}`);

        // 4. Carregar dados iniciais (lógica da sua função `inicializarInterface`)
        const volumePromise = baseRef.child("sensor/volume").once("value");
        const historicoPromise = baseRef.child("historico").once("value");
        const esvaziamentosPromise = baseRef.child("esvaziamentos").once("value");
        const systemInfoPromise = database.ref("system_info").once("value");
        const alturaPromise = baseRef.child("sensor/altura").once("value");

        Promise.all([volumePromise, historicoPromise, esvaziamentosPromise, systemInfoPromise, alturaPromise])
            .then(([volumeSnapshot, historicoSnapshot, esvaziamentosSnapshot, systemInfoSnapshot, alturaSnapshot]) => {
                console.log("Dados iniciais carregados via .once()");

                // Inicializar histórico
                const historicoData = historicoSnapshot.val() || {};
                historicoLocal = Object.values(historicoData).sort((a, b) => b.timestamp - a.timestamp);
                atualizarHistoricoEVolumeMedio(historicoLocal);

                // Inicializar volume
                ultimoVolume = volumeSnapshot.val() || 0;
                volumeValue.textContent = `${Math.round(ultimoVolume)}%`;
                if (ultimoVolume >= 80) {
                    volumeValue.className = "badge bg-danger";
                } else if (ultimoVolume >= 70) {
                    volumeValue.className = "badge bg-warning";
                } else {
                    volumeValue.className = "badge bg-success";
                }
                atualizarCorPreenchimento(ultimoVolume);
                preenchimento.style.height = `${ultimoVolume}%`;

                // Inicializar tempos de esvaziamento
                const esvaziamentoData = esvaziamentosSnapshot.val() || {};
                esvaziamentoTempos = Object.values(esvaziamentoData).map(item => item.tempo).slice(0, 5);
                const tempoMedio = esvaziamentoTempos.length > 0
                    ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                    : 0;
                updateTempoMedioDisplay(tempoMedio);

                // Inicializar system_info
                const systemInfo = systemInfoSnapshot.val() || {};
                cpuUsage.textContent = `${systemInfo.cpuUsage || 0}%`;
                latency.textContent = `${systemInfo.latency || 0} ms`;
                ramUsage.textContent = `${systemInfo.ramUsage || 0}%`;
                temperature.textContent = `${systemInfo.temperature || 0}°C`;

                // Inicializar altura
                const altura = alturaSnapshot.val() || "N/D";
                alturaValue.textContent = altura !== "N/D" ? `${Math.round(altura)} cm` : "N/D";

                // Inicializar inicioEsvaziamentoTimestamp
                if (ultimoVolume > 1) {
                    const ultimaMedicao = historicoLocal.filter(entry => entry.type === "volume").slice(0, 1)[0];
                    inicioEsvaziamentoTimestamp = ultimaMedicao ? ultimaMedicao.timestamp : Date.now();
                } else {
                    inicioEsvaziamentoTimestamp = null;
                }
                
                // 5. Configurar listeners em tempo real (Sua lógica original, agora com refs dinâmicas)

                // Listener para Volume
                refVolume = baseRef.child("sensor/volume");
                refVolume.on("value", (snapshot) => {
                    const volume = snapshot.val() || 0;
                    const currentTimestamp = Date.now();
                    console.log("Volume recebido:", volume);

                    // (Sua lógica de "Ativada/Desativada" ao receber volume)
                    sistemaStatus.textContent = "Ativada";
                    sistemaStatus.className = "badge bg-success";
                    setTimeout(() => {
                        sistemaStatus.textContent = "Desativada";
                        sistemaStatus.className = "badge bg-danger";
                    }, 1000);

                    // Atualizar UI
                    volumeValue.textContent = `${Math.round(volume)}%`;
                    preenchimento.style.height = `${volume}%`;
                    atualizarCorPreenchimento(volume);
                    
                    // // Lógica de Alerta (WhatsApp e Alert)
                    // if (volume >= 80) {
                    //     volumeValue.className = "badge bg-danger";
                    //     // Alerta visual crítico
                    //     alertaCritico.innerHTML = `
                    //         <div class="alert alert-danger d-flex align-items-center" role="alert">
                    //             <div>
                    //                 <strong>NÍVEL CRÍTICO!</strong> A lixeira (${lixeiraTitle.textContent}) atingiu ${Math.round(volume)}% e precisa ser esvaziada.
                    //             </div>
                    //         </div>`;
                        
                    //     if (!alerta80Exibido) {
                    //         alert(`Atenção! O volume da lixeira (${lixeiraTitle.textContent}) atingiu ou ultrapassou 80%. Por favor, esvazie a lixeira.`);
                    //         alerta80Exibido = true;
                    //     }
                    //     if (!mensagemWhatsAppEnviada) {
                    //         const mensagem = `🚨 *Alerta de Lixeira Cheia!* 🚨\n\nA lixeira *${lixeiraTitle.textContent}* atingiu ${Math.round(volume)}% de ocupação. Por favor, esvazie-a!\n\nData/Hora: ${new Date(currentTimestamp).toLocaleString("pt-BR")}`;
                    //         enviarMensagemWhatsApp(mensagem);
                    //         mensagemWhatsAppEnviada = true;
                    //     }
                    // } else if (volume >= 70) {
                    //     volumeValue.className = "badge bg-warning";
                    //     alerta80Exibido = false;
                    //     mensagemWhatsAppEnviada = false;
                    //     alertaCritico.innerHTML = ""; // Limpa alerta
                    // } else {
                    //     volumeValue.className = "badge bg-success";
                    //     alerta80Exibido = false;
                    //     mensagemWhatsAppEnviada = false;
                    //     alertaCritico.innerHTML = ""; // Limpa alerta
                    // }

                    // Lógica de Alerta (Telegram e Alert em 2 Estágios)
                    if (volume >= 80) {
                        volumeValue.className = "badge bg-danger";
                        
                        // Alerta visual crítico na interface
                        alertaCritico.innerHTML = `
                            <div class="alert alert-danger d-flex align-items-center" role="alert">
                                <div>
                                    <strong>🚨 NÍVEL CRÍTICO!</strong> A lixeira (${lixeiraTitle.textContent}) atingiu ${Math.round(volume)}% e precisa ser esvaziada.
                                </div>
                            </div>`;
                        
                        // Garante que o de 70% não seja engatilhado se o lixo baixar para 75%
                        alerta70Exibido = true;
                        mensagemTelegram70Enviada = true; 

                        // 1º PASSO: ENVIO PARA O TELEGRAM (Sem bloqueios)
                        if (!mensagemTelegram80Enviada) {
                            const mensagem80 = `🚨 *NÍVEL CRÍTICO!* 🚨\n\nA lixeira *${lixeiraTitle.textContent}* atingiu *${Math.round(volume)}%* de ocupação. Por favor, realizar o esvaziamento imediatamente.\n\n📅 Data/Hora: ${new Date(currentTimestamp).toLocaleString("pt-BR")}`;
                            enviarMensagemTelegram(mensagem80);
                            mensagemTelegram80Enviada = true; 
                        }

                        // 2º PASSO: ALERTA DE NAVEGADOR (Assíncrono)
                        if (!alerta80Exibido) {
                            alerta80Exibido = true;
                            setTimeout(() => {
                                alert(`NÍVEL CRÍTICO! O volume da lixeira (${lixeiraTitle.textContent}) atingiu ou ultrapassou 80%. Por favor, esvazie a lixeira.`);
                            }, 500); // 500ms de atraso garante que o fetch do Telegram já saiu da máquina
                        }

                    } else if (volume >= 70) {
                        volumeValue.className = "badge bg-warning";
                        
                        // Alerta visual de Atenção na interface
                        alertaCritico.innerHTML = `
                            <div class="alert alert-warning d-flex align-items-center" role="alert">
                                <div>
                                    <strong>⚠️ Atenção!</strong> A lixeira (${lixeiraTitle.textContent}) está em ${Math.round(volume)}%.
                                </div>
                            </div>`;

                        // Libera o alerta de 80% para disparar se o volume subir
                        alerta80Exibido = false;
                        mensagemTelegram80Enviada = false;

                        // 1º PASSO: ENVIO PARA O TELEGRAM (Sem bloqueios)
                        if (!mensagemTelegram70Enviada) {
                            const mensagem70 = `⚠️ *Atenção!* A lixeira *${lixeiraTitle.textContent}* está em *${Math.round(volume)}%*.\n\n📅 Data/Hora: ${new Date(currentTimestamp).toLocaleString("pt-BR")}`;
                            enviarMensagemTelegram(mensagem70);
                            mensagemTelegram70Enviada = true;
                        }

                        // 2º PASSO: ALERTA DE NAVEGADOR (Assíncrono)
                        if (!alerta70Exibido) {
                            alerta70Exibido = true;
                            setTimeout(() => {
                                alert(`Atenção! A lixeira (${lixeiraTitle.textContent}) está em ${Math.round(volume)}%.`);
                            }, 500);
                        }

                    } else {
                        // Volume abaixo de 70% (Lixeira esvaziada)
                        volumeValue.className = "badge bg-success";
                        alertaCritico.innerHTML = ""; // Limpa os alertas de tela
                        
                        // Rearma TODOS os gatilhos para o próximo ciclo
                        alerta70Exibido = false;
                        alerta80Exibido = false;
                        mensagemTelegram70Enviada = false;
                        mensagemTelegram80Enviada = false; 
                    }

                    if (isFirstLoad) {
                        isFirstLoad = false;
                        ultimoVolume = volume;
                        return;
                    }

                    const diferencaVolume = Math.abs(volume - ultimoVolume);
                    const tempoSuficiente = currentTimestamp - ultimoRegistroTimestamp > 5000;

                    // Lógica de esvaziamento
                    if (volume > 1 && ultimoVolume <= 1 && inicioEsvaziamentoTimestamp === null) {
                        inicioEsvaziamentoTimestamp = currentTimestamp;
                        console.log("Início do ciclo de esvaziamento detectado.");
                    }

                    if (volume <= 2 && inicioEsvaziamentoTimestamp !== null) {
                        const diffMilissegundos = currentTimestamp - inicioEsvaziamentoTimestamp;
                        const tempoDecorrido = Math.floor(diffMilissegundos / (1000 * 60));
                        console.log("Esvaziamento confirmado (min):", tempoDecorrido);

                        if (tempoDecorrido > 0) {
                            esvaziamentoTempos.push(tempoDecorrido);
                            if (esvaziamentoTempos.length > 5) esvaziamentoTempos.shift();

                            const esvaziamentoEntry = { tempo: tempoDecorrido, timestamp: currentTimestamp };
                            baseRef.child("esvaziamentos").push(esvaziamentoEntry);

                            const historicoEntry = { type: "esvaziamento", timestamp: currentTimestamp, tempo: tempoDecorrido };
                            baseRef.child("historico").push(historicoEntry)
                                .then(() => atualizarHistoricoLocal(historicoEntry));

                            const tempoMedio = esvaziamentoTempos.length > 0
                                ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                                : 0;
                            updateTempoMedioDisplay(tempoMedio);
                        }
                        inicioEsvaziamentoTimestamp = null;
                    }

                    // Salvar no histórico
                    if ((diferencaVolume >= 0.5 || tempoSuficiente) && (diferencaVolume > 0 || tempoSuficiente)) {
                        const historicoEntry = {
                            type: "volume",
                            volume: parseFloat(volume.toFixed(1)),
                            timestamp: currentTimestamp
                        };
                        baseRef.child("historico").push(historicoEntry)
                            .then(() => {
                                ultimoRegistroTimestamp = currentTimestamp;
                                atualizarHistoricoLocal(historicoEntry);
                            });
                    }
                    ultimoVolume = volume;
                });

                // Listener para system_info
                refSystemInfo = database.ref("system_info");
                refSystemInfo.on("value", (snapshot) => {
                    const systemInfo = snapshot.val() || {};
                    cpuUsage.textContent = `${systemInfo.cpuUsage || 0}%`;
                    latency.textContent = `${systemInfo.latency || 0} ms`;
                    ramUsage.textContent = `${systemInfo.ramUsage || 0}%`;
                    temperature.textContent = `${systemInfo.temperature || 0}°C`;
                });

                // Listener para ativacaoManual
                refAtivacao = baseRef.child("sensor/ativacaoManual");
                refAtivacao.on("value", (snapshot) => {
                    const estado = snapshot.val();
                    sistemaStatus.textContent = estado ? "Ativada" : "Desativada";
                    sistemaStatus.className = `badge bg-${estado ? "success" : "danger"}`;
                });

                // Listener para altura
                refAltura = baseRef.child("sensor/altura");
                refAltura.on("value", (snapshot) => {
                    const altura = snapshot.val() || "N/D";
                    alturaValue.textContent = altura !== "N/D" ? `${Math.round(altura)} cm` : "N/D";
                });

            })
            .catch((error) => {
                console.error(`Erro ao carregar dados iniciais para ${lixeiraId}:`, error);
                alert("Erro ao carregar dados da lixeira: " + error.message);
            });
    }

    // ========== 7. INICIALIZAÇÃO DO APP ==========
    // Inicializa o Firebase
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado");
    database = firebase.database();

    // Inicializa os tooltips do Bootstrap
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Adiciona 'listeners' de clique nos botões do menu lateral
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#sidebar .nav-link').forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');

            // ❗️ Correção: atualiza o título com o texto do item do menu (ex: "Papel")
            if (e.target && e.target.textContent) {
                lixeiraTitle.textContent = e.target.textContent.trim();
            }

            const lixeiraId = e.target.getAttribute('data-lixeira-id');
            loadLixeiraData(lixeiraId);
        });
    });

    // Adiciona eventos aos botões de controle
    if (novaLeituraBtn) novaLeituraBtn.addEventListener("click", realizarNovaLeitura);
    if (restaurarLixeiraBtn) restaurarLixeiraBtn.addEventListener("click", restaurarLixeira);

    // Autentica e carrega os dados da Lixeira 1
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Autenticado com sucesso como:", userCredential.user.email);

            // Marca no menu lateral a lixeira atual (se existir) e define o título corretamente
            const initialLink = document.querySelector(`#sidebar .nav-link[data-lixeira-id="${currentLixeiraId}"]`);
            if (initialLink) {
                document.querySelectorAll('#sidebar .nav-link').forEach(nav => nav.classList.remove('active'));
                initialLink.classList.add('active');
                if (initialLink.textContent) lixeiraTitle.textContent = initialLink.textContent.trim();
            }

            // Carrega os dados da primeira lixeira ("lixeira1") ao iniciar a página
            loadLixeiraData(currentLixeiraId);
        })
        .catch((error) => {
            console.error("Erro na autenticação:", error);
            alert("Erro ao autenticar: " + error.message);
        });

});
