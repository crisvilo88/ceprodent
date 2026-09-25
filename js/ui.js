/**
 * ui.js
 * ----------------------------------------------------------------------
 * Utilidades genéricas de interfaz compartidas por toda la aplicación:
 * cambio de vistas, notificaciones (toasts), pestañas, modal y helpers.
 * ----------------------------------------------------------------------
 */

const APP_VIEWS = ['authView', 'studentView', 'teacherView', 'adminView', 'quizView', 'resultView'];

/** Muestra una vista principal y oculta las demás. */
function switchView(viewId) {
    APP_VIEWS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== viewId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Escapa texto antes de insertarlo como HTML (previene inyección de markup). */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ---------------------------- Toasts ---------------------------- */

const ICONS_BY_TYPE = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
};

function showToast(message, type = 'info', duration = 4200) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${ICONS_BY_TYPE[type] || ICONS_BY_TYPE.info}"></i><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.25s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

/** Traduce errores comunes de Supabase/Postgres a mensajes legibles en español. */
function friendlyError(error) {
    if (!error) return 'Ocurrió un error inesperado.';
    const msg = error.message || String(error);

    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (msg.includes('already registered')) return 'Ese correo ya está registrado.';
    if (msg.toLowerCase().includes('duplicate key')) return 'Ese registro ya existe.';
    return msg;
}

/* ------------------------- Botón con spinner ------------------------- */

function setButtonLoading(button, isLoading, loadingText = 'Procesando...') {
    if (!button) return;
    if (isLoading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner"></span><span>${loadingText}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
}

/* ------------------------------ Tabs ------------------------------ */

function initTabs(container) {
    const tabButtons = container.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.dataset.tab;
            container.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', panel.id !== `tabPanel${capitalize(target)}`);
            });
        });
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ------------------------------ Modal ------------------------------ */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

/* ------------------- Helper para relaciones 1 a 1 de Supabase ------------------- */
/**
 * PostgREST puede devolver una relación "uno a uno" (FK con UNIQUE) como
 * objeto o como arreglo de un elemento según la versión. Esta función
 * normaliza ambos casos para leer el campo "activa" de evaluaciones_activas.
 */
function extractActiva(evalRelation) {
    if (!evalRelation) return false;
    if (Array.isArray(evalRelation)) return !!(evalRelation[0]?.activa);
    return !!evalRelation.activa;
}

/* --------------------------- Formato notas --------------------------- */

function scoreClass(score) {
    if (score >= 7) return '';
    if (score >= 5) return 'mid';
    return 'low';
}

function formatDate(isoString) {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return isoString;
    }
}
