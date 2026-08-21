const firebaseConfig = {
    apiKey: "AIzaSyBez5QrHqeZn15xAAqasD_9MORZ0SAwtoE",
    authDomain: "prova-tecnico.firebaseapp.com",
    projectId: "prova-tecnico"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let provaID = null;
let respondeu = false;
let tituloAtual = "";
let tempoRestante = 0;

window.addEventListener("DOMContentLoaded", () => {
    btnAuth.onclick = authUser;
    btnCriarProva.onclick = criarProva;
    btnAddPergunta.onclick = addPergunta;
    btnEntrarProva.onclick = entrarProva;
    btnEnviar.onclick = enviar;
    btnExcel.onclick = exportarExcel;
});

async function authUser() {
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if (!email || !senha) return alert("Preencha tudo");

    try {
        const user = await auth.signInWithEmailAndPassword(email, senha);
        entrar(user.user.email);
    } catch {
        const user = await auth.createUserWithEmailAndPassword(email, senha);
        entrar(user.user.email);
    }
}

function entrar(email) {
    loginDiv.style.display = "none";

    if (email.endsWith("@escola.com")) {
        professorDiv.style.display = "block";
        carregarRespostas();
    } else {
        alunoDiv.style.display = "block";
    }
}

async function criarProva() {
    const titulo = document.getElementById("titulo").value.trim();
    const codigo = document.getElementById("codigo").value.trim();
    const tempo = Number(document.getElementById("tempo").value.trim());

    if (!titulo || !codigo || !tempo) return alert("Preencha tudo");

    const doc = await db.collection("provas").add({ titulo, codigo, tempo });
    provaID = doc.id;
    tituloAtual = titulo;

    alert("Prova criada!");
}

async function addPergunta() {
    if (!provaID) return alert("Crie a prova primeiro");

    await db.collection("provas").doc(provaID).collection("perguntas").add({
        texto: pergunta.value,
        A: a.value,
        B: b.value,
        C: c.value,
        D: d.value,
        correta: correta.value
    });

    // LIMPA CAMPOS
    pergunta.value = "";
    a.value = "";
    b.value = "";
    c.value = "";
    d.value = "";
    correta.value = "";

    alert("Pergunta adicionada");
}

async function entrarProva() {
    const cod = codigoAluno.value;

    const snap = await db.collection("provas").where("codigo", "==", cod).get();
    if (snap.empty) return alert("Código inválido");

    snap.forEach(doc => {
        provaID = doc.id;
        tituloAtual = doc.data().titulo;
        tituloProva.innerText = tituloAtual;

        tempoRestante = doc.data().tempo;
        iniciarTimer();

        db.collection("provas").doc(provaID).collection("perguntas")
            .get().then(q => {
                prova.innerHTML = "";
                q.forEach(p => {
                    const d = p.data();
                    prova.innerHTML += `
        <div class='pergunta'>
        <p><strong>${d.texto}</strong></p>
        <label><input type='radio' name='${p.id}' value='A'> ${d.A}</label><br>
        <label><input type='radio' name='${p.id}' value='B'> ${d.B}</label><br>
        <label><input type='radio' name='${p.id}' value='C'> ${d.C}</label><br>
        <label><input type='radio' name='${p.id}' value='D'> ${d.D}</label>
        </div>`;
                });
            });
    });
}

function iniciarTimer() {
    const i = setInterval(() => {
        tempoRestante--;
        timer.innerText = "Tempo: " + tempoRestante;

        if (tempoRestante <= 0) {
            clearInterval(i);
            enviar();
        }
    }, 1000);
}

async function enviar() {
    if (respondeu) return alert("Prova já finalizada");

    const perguntas = await db.collection("provas").doc(provaID).collection("perguntas").get();
    let nota = 0;
    let respostasAluno = {};

    perguntas.forEach(doc => {
        const marcada = document.querySelector(`input[name="${doc.id}"]:checked`);
        if (marcada) {
            respostasAluno[doc.id] = marcada.value;
            if (marcada.value === doc.data().correta) nota++;
        }
    });

    respondeu = true;

    await db.collection("respostas").add({
        aluno: auth.currentUser.email,
        prova: provaID,
        titulo: tituloAtual,
        nota: nota,
        respostas: respostasAluno
    });

    document.querySelectorAll("input[type=radio]").forEach(el => el.disabled = true);
    btnEnviar.disabled = true;

    alert("Prova finalizada! Nota: " + nota);
}

function carregarRespostas() {
    db.collection("respostas").onSnapshot(snap => {
        respostas.innerHTML = "";
        let labels = [];
        let valores = [];

        snap.forEach(doc => {
            const r = doc.data();
            respostas.innerHTML += `<div class='pergunta'>
      <strong>${r.aluno}</strong><br>
      Prova: ${r.titulo}<br>
      Nota: ${r.nota}
      </div>`;
            labels.push(r.aluno);
            valores.push(r.nota);
        });

        if (window.chart) window.chart.destroy();
        window.chart = new Chart(grafico, {
            type: 'bar',
            data: { labels: labels, datasets: [{ data: valores }] }
        });
    });
}

async function exportarExcel() {
    const snap = await db.collection("respostas").get();
    let dados = [];

    snap.forEach(doc => {
        const r = doc.data();
        dados.push({
            Aluno: r.aluno,
            Prova: r.titulo,
            Nota: r.nota
        });
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, "resultados.xlsx");
}