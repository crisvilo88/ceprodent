/**
 * quiz.js
 * ----------------------------------------------------------------------
 * Presentación del examen por parte del estudiante:
 *   - Solicita 12 preguntas aleatorias del pool de 20 vía RPC (el
 *     servidor nunca envía la respuesta correcta al navegador).
 *   - Navegación pregunta por pregunta con barra de progreso y temporizador.
 *   - Envía las respuestas a la función calificar_examen(), que califica
 *     en el servidor y guarda el resultado en Supabase.
 * ----------------------------------------------------------------------
 */

const QUIZ_DURATION_SECONDS = 15 * 60; // 15 minutos por evaluación

APP.quiz = {
    moduloId: null,
    moduloNombre: '',
    questions: [],
    currentIndex: 0,
    answers: {},      // { pregunta_id: 'A' | 'B' | 'C' | 'D' }
    secondsLeft: 0,
    timerId: null,
};

async function startQuiz(moduloId, moduloNombre) {
    try {
        const { data, error } = await db.rpc('obtener_preguntas_examen', { p_modulo_id: moduloId });
        if (error) throw error;

        if (!data || data.length === 0) {
            showToast('Este módulo aún no tiene suficientes preguntas para presentar el examen.', 'error', 5000);
            return;
        }

        APP.quiz.moduloId = moduloId;
        APP.quiz.moduloNombre = moduloNombre;
        APP.quiz.questions = data;
        APP.quiz.currentIndex = 0;
        APP.quiz.answers = {};
        APP.quiz.secondsLeft = QUIZ_DURATION_SECONDS;

        document.getElementById('quizModuleName').textContent = moduloNombre;
        switchView('quizView');
        renderQuizQuestion();
        renderQuizDots();
        startQuizTimer();
    } catch (error) {
        showToast(friendlyError(error), 'error', 6000);
    }
}

function renderQuizQuestion() {
    const { questions, currentIndex, answers } = APP.quiz;
    const q = questions[currentIndex];
    const selected = answers[q.id];

    document.getElementById('quizProgress').textContent = `Pregunta ${currentIndex + 1} de ${questions.length}`;
    document.getElementById('quizProgressFill').style.width = `${((currentIndex + 1) / questions.length) * 100}%`;

    const opciones = [
        { letra: 'A', texto: q.opcion_a },
        { letra: 'B', texto: q.opcion_b },
        { letra: 'C', texto: q.opcion_c },
        { letra: 'D', texto: q.opcion_d },
    ];

    document.getElementById('quizBody').innerHTML = `
        <div class="quiz-question-text">${currentIndex + 1}. ${escapeHTML(q.pregunta)}</div>
        <div class="quiz-options">
            ${opciones.map(o => `
                <button type="button" class="quiz-option-btn ${selected === o.letra ? 'selected' : ''}" onclick="selectQuizAnswer('${o.letra}')">
                    <span class="opt-letter">${o.letra}</span>
                    <span>${escapeHTML(o.texto)}</span>
                </button>
            `).join('')}
        </div>
    `;

    updateQuizNavButtons();
}

function renderQuizDots() {
    const { questions, currentIndex, answers } = APP.quiz;
    document.getElementById('quizDots').innerHTML = questions.map((q, i) => {
        let cls = '';
        if (i === currentIndex) cls = 'current';
        else if (answers[q.id]) cls = 'answered';
        return `<span class="quiz-dot ${cls}"></span>`;
    }).join('');
}

function selectQuizAnswer(letra) {
    const q = APP.quiz.questions[APP.quiz.currentIndex];
    APP.quiz.answers[q.id] = letra;
    renderQuizQuestion();
    renderQuizDots();
}

function updateQuizNavButtons() {
    const { questions, currentIndex } = APP.quiz;
    const btnPrev = document.getElementById('btnPrevQuestion');
    const btnNext = document.getElementById('btnNextQuestion');

    btnPrev.disabled = currentIndex === 0;

    if (currentIndex === questions.length - 1) {
        btnNext.innerHTML = 'Finalizar examen <i class="fa-solid fa-check-double"></i>';
    } else {
        btnNext.innerHTML = 'Siguiente <i class="fa-solid fa-arrow-right"></i>';
    }
}

function goPrevQuestion() {
    if (APP.quiz.currentIndex > 0) {
        APP.quiz.currentIndex--;
        renderQuizQuestion();
        renderQuizDots();
    }
}

function goNextOrSubmit() {
    const { questions, currentIndex } = APP.quiz;
    if (currentIndex < questions.length - 1) {
        APP.quiz.currentIndex++;
        renderQuizQuestion();
        renderQuizDots();
    } else {
        submitQuiz();
    }
}

/* ------------------------------ Temporizador ------------------------------ */

function startQuizTimer() {
    clearInterval(APP.quiz.timerId);
    updateTimerDisplay();

    APP.quiz.timerId = setInterval(() => {
        APP.quiz.secondsLeft--;
        updateTimerDisplay();

        if (APP.quiz.secondsLeft <= 0) {
            clearInterval(APP.quiz.timerId);
            showToast('Se acabó el tiempo. Enviando tus respuestas...', 'info', 3500);
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const total = Math.max(APP.quiz.secondsLeft, 0);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    document.getElementById('quizTimerText').textContent = `${mm}:${ss}`;
    document.getElementById('quizTimer').classList.toggle('is-low', total <= 60);
}

/* ------------------------------ Envío / calificación ------------------------------ */

async function submitQuiz() {
    clearInterval(APP.quiz.timerId);

    const { questions, answers, moduloId } = APP.quiz;
    const sinResponder = questions.filter(q => !answers[q.id]).length;

    if (sinResponder > 0 && APP.quiz.secondsLeft > 0) {
        const continuar = confirm(`Tienes ${sinResponder} pregunta(s) sin responder. ¿Deseas finalizar de todas formas?`);
        if (!continuar) {
            startQuizTimer(); // reanuda el conteo si decide seguir respondiendo
            return;
        }
    }

    const btnNext = document.getElementById('btnNextQuestion');
    setButtonLoading(btnNext, true, 'Calificando...');

    const respuestas = questions.map(q => ({ pregunta_id: q.id, opcion: answers[q.id] || null }));

    try {
        const { data, error } = await db.rpc('calificar_examen', {
            p_modulo_id: moduloId,
            p_respuestas: respuestas,
        });
        if (error) throw error;

        const resultado = Array.isArray(data) ? data[0] : data;
        showQuizResult(resultado);
    } catch (error) {
        showToast(friendlyError(error), 'error', 6000);
        switchView('studentView');
        loadStudentDashboard();
    } finally {
        setButtonLoading(btnNext, false);
    }
}

function showQuizResult(resultado) {
    const nota = Number(resultado.calificacion).toFixed(1);
    document.getElementById('scoreNumber').textContent = nota;
    document.getElementById('resultTitle').textContent = resultado.calificacion >= 6
        ? '¡Evaluación aprobada!'
        : 'Evaluación finalizada';
    document.getElementById('resultDetail').textContent =
        `Respondiste correctamente ${resultado.correctas} de ${resultado.total} preguntas. Tu calificación ha sido registrada.`;

    switchView('resultView');
}

function initQuizModule() {
    document.getElementById('btnPrevQuestion').addEventListener('click', goPrevQuestion);
    document.getElementById('btnNextQuestion').addEventListener('click', goNextOrSubmit);
    document.getElementById('btnBackToDashboard').addEventListener('click', () => {
        switchView('studentView');
        loadStudentDashboard();
    });
}
