const firebaseConfig = {
    apiKey: "AIzaSyDay7Mjm7dzdeVnXvF_z7vOj8jwhVmVTe0",
    authDomain: "lixeira-inteligente-esp32.firebaseapp.com",
    databaseURL: "https://lixeira-inteligente-esp32-default-rtdb.firebaseio.com",
    projectId: "lixeira-inteligente-esp32",
    storageBucket: "lixeira-inteligente-esp32.firebasestorage.app",
    messagingSenderId: "14562674613",
    appId: "1:14562674613:web:c42a81951431c6f70b7bfc"
};

// Credenciais do usuário
const email = "lixeira1@gmail.com";
const password = "lixeira123";

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const sistemaStatus = document.getElementById("ledStatus");
const volumeValue = document.getElementById("volumeValue");
const alturaValue = document.getElementById("alturaValue");
const ativacaoManualBtn = document.getElementById("ativacaoManualBtn");
const alturaInput = document.getElementById("userInput");
const historicoList = document.getElementById("historicoList");
const preenchimento = document.getElementById("preenchimento");

// Configuração dos gráficos
const volumeCtx = document.getElementById("volumeChart").getContext("2d");
const volumeChart = new Chart(volumeCtx, {
    type: "bar",
    data: {
        labels: [],
        datasets: [{
            label: "Volume Médio (%)",
            data: [],
            backgroundColor: "#4CAF50",
            borderColor: "#388E3C",
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: "Porcentagem (%)"
                }
            },
            x: {
                title: {
                    display: true,
                    text: "Intervalo de Tempo"
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    }
});

const esvaziamentoCtx = document.getElementById("esvaziamentoChart").getContext("2d");
const esvaziamentoChart = new Chart(esvaziamentoCtx, {
    type: "bar",
    data: {
        labels: ["Últimas Retiradas"],
        datasets: [{
            label: "Tempo Médio (dias)",
            data: [0],
            backgroundColor: "#007bff",
            borderColor: "#0056b3",
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                max: 10, // Escala até 10 dias
                title: {
                    display: true,
                    text: "Dias"
                },
                ticks: {
                    stepSize: 1, // Apenas números inteiros
                    precision: 0 // Sem decimais
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    }
});

// Histórico de medições e eventos
let historico = [];
let volumeHistorico = []; // Para calcular volume médio
let esvaziamentoTempos = []; // Para calcular tempo até esvaziamento
let ultimoVolumeCritico = null; // Timestamp do último volume ≥ 90%

// Autenticação com email e senha
firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
        console.log("Autenticado com sucesso como:", userCredential.user.email);

        // Leitura em tempo real de sensor/ativacaoManual
        database.ref("sensor/ativacaoManual").on("value", (snapshot) => {
            const estado = snapshot.val();
            sistemaStatus.textContent = estado ? "Ativado" : "Desativado";
            sistemaStatus.className = `badge bg-${estado ? "success" : "danger"}`;
            if (estado) {
                const timestamp = new Date().toLocaleString("pt-BR");
                historico.unshift({ type: "ativação", timestamp });
                if (historico.length > 10) historico.pop();
                atualizarHistorico();
            }
        });

        // Leitura em tempo real de sensor/volume
        database.ref("sensor/volume").on("value", (snapshot) => {
            const volume = snapshot.val() || 0;
            volumeValue.textContent = `${volume.toFixed(1)}%`;

            // Atualizar cor do badge e preenchimento
            if (volume >= 90) {
                volumeValue.className = "badge bg-danger";
                preenchimento.style.backgroundColor = "#dc3545";
                if (!ultimoVolumeCritico) {
                    ultimoVolumeCritico = new Date();
                }
            } else if (volume >= 70) {
                volumeValue.className = "badge bg-warning";
                preenchimento.style.backgroundColor = "#ffc107";
            } else {
                volumeValue.className = "badge bg-info";
                preenchimento.style.backgroundColor = "#28a745";
            }

            // Detectar esvaziamento (volume volta a 0 após ≥ 90%)
            if (volume === 0 && ultimoVolumeCritico) {
                const agora = new Date();
                const tempoDecorrido = Math.round((agora - ultimoVolumeCritico) / (1000 * 60 * 60 * 24)); // Dias inteiros
                esvaziamentoTempos.push(tempoDecorrido);
                if (esvaziamentoTempos.length > 5) esvaziamentoTempos.shift(); // Últimos 5 esvaziamentos
                ultimoVolumeCritico = null;

                // Atualizar gráfico de esvaziamento
                const tempoMedio = esvaziamentoTempos.length > 0
                    ? Math.round(esvaziamentoTempos.reduce((a, b) => a + b, 0) / esvaziamentoTempos.length)
                    : 0;
                esvaziamentoChart.data.datasets[0].data = [tempoMedio];
                esvaziamentoChart.update();

                // Adicionar ao histórico
                historico.unshift({ type: "esvaziamento", timestamp: agora.toLocaleString("pt-BR"), tempo: tempoDecorrido });
                if (historico.length > 10) historico.pop();
            }

            // Atualizar preenchimento da lixeira
            preenchimento.style.height = `${volume}%`;

            // Adicionar ao histórico de volume para cálculo de média
            const timestamp = new Date().toLocaleString("pt-BR");
            volumeHistorico.push({ volume, timestamp });
            if (volumeHistorico.length > 50) volumeHistorico.shift(); // Últimas 50 medições

            // Calcular volume médio (ex.: por hora)
            const agora = new Date();
            const umaHoraAtras = new Date(agora - 60 * 60 * 1000);
            const volumesRecentes = volumeHistorico.filter(v => new Date(v.timestamp) >= umaHoraAtras);
            const volumeMedio = volumesRecentes.length > 0
                ? (volumesRecentes.reduce((sum, v) => sum + v.volume, 0) / volumesRecentes.length).toFixed(1)
                : 0;

            // Atualizar gráfico de volume médio
            volumeChart.data.labels.push(timestamp);
            volumeChart.data.datasets[0].data.push(volumeMedio);
            if (volumeChart.data.labels.length > 10) {
                volumeChart.data.labels.shift();
                volumeChart.data.datasets[0].data.shift();
            }
            volumeChart.update();

            // Adicionar ao histórico
            historico.unshift({ type: "volume", volume: volume.toFixed(1), timestamp });
            if (historico.length > 10) historico.pop();
            atualizarHistorico();
        });

        // Leitura em tempo real de sensor/altura
        database.ref("sensor/altura").on("value", (snapshot) => {
            const altura = snapshot.val() || "N/D";
            alturaValue.textContent = altura !== "N/D" ? `${altura} cm` : "N/D";
        });
    })
    .catch((error) => {
        console.error("Erro na autenticação:", error.code, error.message);
        alert("Erro na autenticação: " + error.message);
    });

// Função para atualizar o histórico
function atualizarHistorico() {
    historicoList.innerHTML = "";
    historico.forEach((entry) => {
        const li = document.createElement("li");
        li.className = "list-group-item";
        if (entry.type === "volume") {
            li.textContent = `${entry.timestamp}: Volume ${entry.volume}%`;
        } else if (entry.type === "ativação") {
            li.textContent = `${entry.timestamp}: Ativação Manual`;
        } else if (entry.type === "esvaziamento") {
            li.textContent = `${entry.timestamp}: Esvaziamento (Tempo: ${entry.tempo} dia${entry.tempo !== 1 ? 's' : ''})`;
        }
        historicoList.appendChild(li);
    });
}

// Função para ativação manual (1 segundo)
function ativacaoManual() {
    database.ref("sensor/ativacaoManual").set(true)
        .then(() => {
            console.log("Ativação manual: true");
            setTimeout(() => {
                database.ref("sensor/ativacaoManual").set(false)
                    .then(() => console.log("Ativação manual: false"))
                    .catch((error) => console.error("Erro ao desativar:", error));
            }, 1000);
        })
        .catch((error) => {
            console.error("Erro ao ativar:", error);
            alert("Erro ao ativar: " + error.message);
        });
}

// // Função para definir a altura no Firebase
// function definirAltura() {
//     const alturaInputValue = alturaInput.value;
//     const alturaValue = parseFloat(alturaInputValue);

//     if (isNaN(alturaValue) || alturaInputValue.trim() === "") {
//         alert("Por favor, digite um número válido para a altura.");
//         return;
//     }

//     database.ref("sensor/altura").set(alturaValue)
//         .then(() => {
//             console.log("Altura definida com sucesso: " + alturaValue);
//             alert("Altura definida com sucesso: " + alturaValue + " cm");
//             alturaInput.value = "";
//         })
//         .catch((error) => {
//             console.error("Erro ao definir altura: ", error);
//             alert("Erro ao definir altura: " + error.message);
//         });
// }

// Função para ativação manual (1 segundo)
function definirAltura() {
    database.ref("sensor/novaLixeira").set(true)
        .then(() => {
            console.log("Leitura da lixeira: true");
            setTimeout(() => {
                database.ref("sensor/novaLixeira").set(false)
                    .then(() => console.log("Leitura da lixeira: false"))
                    .catch((error) => console.error("Erro ao desativar:", error));
            }, 1000);
        })
        .catch((error) => {
            console.error("Erro ao ativar:", error);
            alert("Erro ao ativar: " + error.message);
        });
}

// Eventos
ativacaoManualBtn.addEventListener("click", ativacaoManual);
alturaInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        definirAltura();
    }
});
