/**
 * teacher.js
 * ----------------------------------------------------------------------
 * Panel del docente CEPRODENT 2.0
 *
 * - Gestión de módulos y programas.
 * - Banco de preguntas.
 * - Activación de evaluaciones.
 * - Creación e inscripción de estudiantes.
 * - Consulta de resultados.
 * - Exportación de estudiantes y notas a Excel/PDF.
 * - Activación/Desactivación de módulos completos.
 * ----------------------------------------------------------------------
 */

APP.teacher = {
    modules: [],
    programs: [],
    currentModuleId: null,
    currentQuestionCount: 0,
    reportExport: null, // para exportaciones
    loadedTabs: {},
};

/* ============================== DASHBOARD ============================== */

async function loadTeacherDashboard() {
    document.getElementById('moduleDetailPanel').classList.add('hidden');
    document.getElementById('teacherModulesPanel').classList.remove('hidden');

    await fetchTeacherModulesData();
}

async function fetchTeacherModulesData() {
    const grid = document.getElementById('teacherModulesGrid');

    grid.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando tus módulos...
        </div>
    `;

    const { data, error } = await db
        .from('modulos')
        .select(`
            id,
            nombre,
            descripcion,
            activo,
            created_at,
            programas ( id, nombre ),
            evaluaciones_activas ( activa ),
            banco_preguntas ( id ),
            inscripciones ( id )
        `)
        .eq('docente_id', APP.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar módulos:', error);
        grid.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    APP.teacher.modules = data || [];
    renderTeacherModules();

    // Los programas cambian con poca frecuencia: reutilizamos los ya cargados
    // durante la sesión y evitamos una consulta cada vez que se actualiza el panel.
    if (!APP.teacher.programs.length) {
        const { data: programas, error: programasError } = await db
            .from('programas')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        if (!programasError) {
            APP.teacher.programs = programas || [];
        }
    }
    renderProgramaOptions();
}

function renderTeacherModules() {
    const grid = document.getElementById('teacherModulesGrid');
    const empty = document.getElementById('teacherEmptyState');
    const modules = APP.teacher.modules;

    if (!modules.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = modules.map(m => {
        const activa = extractActiva(m.evaluaciones_activas);
        const nPreguntas = m.banco_preguntas?.length || 0;
        const nEstudiantes = m.inscripciones?.length || 0;
        const isActive = m.activo !== false; // por si es null

        return `
            <div class="eval-card ${activa ? '' : 'is-inactive'} ${!isActive ? 'module-inactive' : ''}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="eval-badge ${activa ? 'badge-active' : 'badge-inactive'}">
                            <i class="fa-solid fa-circle"></i>
                            ${activa ? 'Evaluación activa' : 'Inactiva'}
                        </span>
                        <span class="eval-badge module-status ${isActive ? 'module-status-active' : 'module-status-inactive'}">
                            <i class="fa-solid ${isActive ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            ${isActive ? 'Módulo activo' : 'Módulo inactivo'}
                        </span>
                    </div>

                    <h3 class="eval-title">
                        ${escapeHTML(m.nombre)}
                    </h3>

                    <div class="eval-info">
                        <div>
                            <i class="fa-solid fa-book"></i>
                            Programa: ${escapeHTML(m.programas?.nombre || '—')}
                        </div>

                        <div>
                            <i class="fa-solid fa-list-check"></i>
                            Banco de preguntas: ${nPreguntas}/20
                        </div>

                        <div>
                            <i class="fa-solid fa-user-graduate"></i>
                            Estudiantes inscritos: ${nEstudiantes}
                        </div>
                    </div>
                </div>

                <div class="card-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
                    <button
                        class="btn-primary btn-compact"
                        style="flex:1; min-width:120px;"
                        onclick="openModuleDetail('${m.id}')"
                    >
                        <i class="fa-solid fa-gear"></i>
                        Gestionar
                    </button>

                    <button
                        class="btn-icon module-toggle-btn ${isActive ? 'module-toggle-active' : 'module-toggle-inactive'}"
                        title="${isActive ? 'Desactivar módulo' : 'Activar módulo'}"
                        onclick="toggleModuleStatus('${m.id}')"
                    >
                        <i class="fa-solid ${isActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i><span>${isActive ? 'Activo' : 'Inactivo'}</span>
                    </button>
                    <button
                        class="btn-icon module-delete-btn"
                        title="Eliminar módulo"
                        onclick="handleDeleteModule('${m.id}')"
                    >
                        <i class="fa-solid fa-trash"></i><span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderProgramaOptions() {
    const select = document.getElementById('programaSelect');

    if (!select) return;

    const currentValue = select.value;

    select.innerHTML =
        '<option value="">— Crear un programa nuevo —</option>' +
        APP.teacher.programs.map(p =>
            `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`
        ).join('');

    select.value = currentValue || '';
}

/* ============================== ACTIVAR/DESACTIVAR MÓDULO ============================== */

async function toggleModuleStatus(moduloId) {
    const modulo = APP.teacher.modules.find(m => m.id === moduloId);
    if (!modulo) {
        showToast('No se encontró el módulo.', 'error');
        return;
    }

    const newState = !(modulo.activo !== false);
    const action = newState ? 'activar' : 'desactivar';

    if (!confirm(`¿${newState ? 'Activar' : 'Desactivar'} el módulo "${modulo.nombre}"?`)) {
        return;
    }

    try {
        const { error } = await db
            .from('modulos')
            .update({ activo: newState })
            .eq('id', moduloId);

        if (error) throw error;

        showToast(`Módulo ${action}do correctamente.`, 'success');

        // Si estamos viendo el detalle de este módulo y lo desactivamos, cerramos el detalle.
        const localModulo = APP.teacher.modules.find(m => m.id === moduloId);
        if (localModulo) localModulo.activo = newState;
        renderTeacherModules();

        if (APP.teacher.currentModuleId === moduloId && !newState) {
            backToModuleList();
        }

    } catch (error) {
        console.error('Error al cambiar estado del módulo:', error);
        showToast(friendlyError(error), 'error');
    }
}

/* ============================== ELIMINAR MÓDULO ============================== */

async function handleDeleteModule(moduloId) {
    const modulo = APP.teacher.modules.find(m => m.id === moduloId);
    if (!modulo) {
        showToast('No se encontró el módulo.', 'error');
        return;
    }

    const confirmado = confirm(
        `¿Eliminar definitivamente el módulo "${modulo.nombre}"?\n\n` +
        'Se eliminarán también sus preguntas, inscripciones, evaluación y resultados asociados. Esta acción no se puede deshacer.'
    );
    if (!confirmado) return;

    const button = document.querySelector(`button[onclick="handleDeleteModule('${moduloId}')"]`);
    if (button) setButtonLoading(button, true, 'Eliminando...');

    try {
        const { error } = await db
            .from('modulos')
            .delete()
            .eq('id', moduloId);

        if (error) throw error;

        APP.teacher.modules = APP.teacher.modules.filter(m => m.id !== moduloId);
        delete APP.teacher.loadedTabs[moduloId];

        if (APP.teacher.currentModuleId === moduloId) {
            APP.teacher.currentModuleId = null;
            document.getElementById('moduleDetailPanel').classList.add('hidden');
            document.getElementById('teacherModulesPanel').classList.remove('hidden');
        }

        renderTeacherModules();
        showToast('Módulo eliminado correctamente.', 'success');
    } catch (error) {
        console.error('Error al eliminar módulo:', error);
        showToast(friendlyError(error), 'error');
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

/* ============================== NUEVO MÓDULO ============================== */

function initNewModuleModal() {
    document.getElementById('btnNuevoModulo')
        .addEventListener('click', () => openModal('newModuleModal'));

    document.getElementById('btnCloseModal')
        .addEventListener('click', () => closeModal('newModuleModal'));

    document.getElementById('newModuleModal')
        .addEventListener('click', (e) => {
            if (e.target.id === 'newModuleModal') {
                closeModal('newModuleModal');
            }
        });

    document.getElementById('programaSelect')
        .addEventListener('change', (e) => {
            document.getElementById('newProgramGroup')
                .classList.toggle('hidden', !!e.target.value);
        });

    document.getElementById('newModuleForm')
        .addEventListener('submit', handleCreateModule);
}

async function handleCreateModule(event) {
    event.preventDefault();

    const btn = document.getElementById('btnCrearModulo');
    const programaSelect = document.getElementById('programaSelect');
    const programaNuevo = document.getElementById('programaNuevo').value.trim();
    const nombre = document.getElementById('moduloNombre').value.trim();
    const descripcion = document.getElementById('moduloDescripcion').value.trim();

    setButtonLoading(btn, true, 'Creando...');

    try {
        let programaId = programaSelect.value;

        if (!programaId) {
            if (!programaNuevo) {
                throw new Error(
                    'Escribe el nombre del nuevo programa o selecciona uno existente.'
                );
            }

            const { data: nuevoPrograma, error: progError } = await db
                .from('programas')
                .insert({
                    nombre: programaNuevo
                })
                .select('id, nombre')
                .single();

            if (progError) throw progError;

            programaId = nuevoPrograma.id;
            APP.teacher.programs.push(nuevoPrograma);
        }

        const { data: nuevoModulo, error: modError } = await db
            .from('modulos')
            .insert({
                programa_id: programaId,
                docente_id: APP.user.id,
                nombre,
                descripcion: descripcion || null,
                activo: true  // por defecto activo
            })
            .select('id')
            .single();

        if (modError) throw modError;

        showToast('Módulo creado con éxito.', 'success');

        document.getElementById('newModuleForm').reset();
        document.getElementById('newProgramGroup')
            .classList.remove('hidden');

        closeModal('newModuleModal');

        await loadTeacherDashboard();
        await openModuleDetail(nuevoModulo.id);

    } catch (error) {
        console.error('Error al crear módulo:', error);
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}

/* ============================== DETALLE DEL MÓDULO ============================== */

async function openModuleDetail(moduloId) {
    // Verificar si el módulo está activo, si no, mostrar mensaje y no abrir
    const modulo = APP.teacher.modules.find(m => m.id === moduloId);
    if (modulo && modulo.activo === false) {
        showToast('Este módulo está inactivo. Actívalo para gestionarlo.', 'error');
        return;
    }

    APP.teacher.currentModuleId = moduloId;
    APP.teacher.loadedTabs[moduloId] = { preguntas: false, estudiantes: false, resultados: false, notas: false };

    document.getElementById('teacherModulesPanel').classList.add('hidden');
    document.getElementById('moduleDetailPanel').classList.remove('hidden');

    activateTeacherTab('preguntas');
    await loadModuleHeader(moduloId);
    await loadModuleQuestions(moduloId);
    APP.teacher.loadedTabs[moduloId].preguntas = true;
}

function backToModuleList() {
    APP.teacher.currentModuleId = null;

    document.getElementById('moduleDetailPanel').classList.add('hidden');
    document.getElementById('teacherModulesPanel').classList.remove('hidden');

    // No volvemos a consultar Supabase: la lista local ya fue actualizada
    // después de crear/eliminar/cambiar estado/preguntas del módulo.
    renderTeacherModules();
}

async function loadModuleHeader(moduloId) {
    const { data, error } = await db
        .from('modulos')
        .select(`
            id,
            nombre,
            programas ( nombre ),
            evaluaciones_activas ( activa )
        `)
        .eq('id', moduloId)
        .single();

    if (error) {
        showToast(friendlyError(error), 'error');
        return;
    }

    document.getElementById('detailModuleName').textContent = data.nombre;

    document.getElementById('detailProgramName').textContent =
        `Programa: ${data.programas?.nombre || '—'}`;

    const activa = extractActiva(data.evaluaciones_activas);

    const toggle = document.getElementById('evalToggle');
    toggle.checked = activa;

    updateToggleLabel(activa);
    syncEvalToggleAvailability();
}

function updateToggleLabel(activa) {
    const label = document.getElementById('toggleLabel');

    label.textContent = activa ? 'ACTIVADA' : 'DESACTIVADA';

    label.classList.toggle('is-active', activa);
    label.classList.toggle('is-inactive', !activa);
}

function syncEvalToggleAvailability() {
    const toggle = document.getElementById('evalToggle');
    const puedeActivar = APP.teacher.currentQuestionCount >= 12;

    if (!toggle.checked) {
        toggle.disabled = !puedeActivar;

        toggle.title = puedeActivar
            ? ''
            : `Necesitas al menos 12 preguntas en el banco (tienes ${APP.teacher.currentQuestionCount}).`;

    } else {
        toggle.disabled = false;
        toggle.title = '';
    }
}

async function handleToggleEvaluation(event) {
    const checkbox = event.target;
    const isActive = checkbox.checked;
    const moduloId = APP.teacher.currentModuleId;

    if (isActive && APP.teacher.currentQuestionCount < 12) {
        checkbox.checked = false;

        showToast(
            `Necesitas al menos 12 preguntas en el banco para activar la evaluación (tienes ${APP.teacher.currentQuestionCount}).`,
            'error',
            5500
        );

        return;
    }

    checkbox.disabled = true;

    try {
        const { error } = await db
            .from('evaluaciones_activas')
            .update({
                activa: isActive,
                activada_en: new Date().toISOString(),
                activada_por: APP.user.id
            })
            .eq('modulo_id', moduloId);

        if (error) throw error;

        updateToggleLabel(isActive);

        const modulo = APP.teacher.modules.find(m => m.id === moduloId);
        if (modulo) modulo.evaluaciones_activas = [{ activa: isActive }];
        renderTeacherModules();

        showToast(
            isActive
                ? 'Evaluación activada. Los estudiantes ya pueden presentarla.'
                : 'Evaluación desactivada.',
            'success'
        );

    } catch (error) {
        checkbox.checked = !isActive;
        showToast(friendlyError(error), 'error');

    } finally {
        checkbox.disabled = false;
    }
}

/* ============================== BANCO DE PREGUNTAS ============================== */

async function loadModuleQuestions(moduloId) {
    const list = document.getElementById('questionsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando preguntas...
        </div>
    `;

    const { data, error } = await db
        .from('banco_preguntas')
        .select('*')
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: true });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    renderQuestionsList(data || []);
}

function renderQuestionsList(preguntas) {
    const list = document.getElementById('questionsList');
    const count = preguntas.length;

    APP.teacher.currentQuestionCount = count;

    document.getElementById('tabPreguntasCount').textContent =
        `${count}/20`;

    const addBtn = document.getElementById('btnAddQuestion');

    addBtn.disabled = count >= 20;
    addBtn.title = count >= 20
        ? 'Ya alcanzaste el máximo de 20 preguntas.'
        : '';

    syncEvalToggleAvailability();

    if (!count) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-question"></i>
                <h3>Sin preguntas todavía</h3>
                <p>
                    Agrega preguntas con el formulario de arriba.
                    Necesitas al menos 12 para poder activar la evaluación.
                </p>
            </div>
        `;
        return;
    }

    const optionLabel = {
        A: 'opcion_a',
        B: 'opcion_b',
        C: 'opcion_c',
        D: 'opcion_d'
    };

    list.innerHTML = preguntas.map((q, i) => `
        <div class="question-item">
            <div class="question-item-header">
                <div>
                    <div class="q-index">
                        Pregunta ${i + 1}
                    </div>

                    <div class="q-text">
                        ${escapeHTML(q.pregunta)}
                    </div>
                </div>

                <button
                    class="icon-btn"
                    title="Eliminar pregunta"
                    onclick="handleDeleteQuestion('${q.id}')"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>

            <div class="q-options-mini">
                ${['A', 'B', 'C', 'D'].map(letra => `
                    <span class="${q.respuesta_correcta === letra ? 'correct' : ''}">
                        ${letra}. ${escapeHTML(q[optionLabel[letra]])}
                        ${q.respuesta_correcta === letra
                            ? '<i class="fa-solid fa-check"></i>'
                            : ''
                        }
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

async function handleAddQuestion(event) {
    event.preventDefault();

    const btn = document.getElementById('btnAddQuestion');
    const moduloId = APP.teacher.currentModuleId;

    const payload = {
        modulo_id: moduloId,
        pregunta: document.getElementById('qText').value.trim(),
        opcion_a: document.getElementById('qOptionA').value.trim(),
        opcion_b: document.getElementById('qOptionB').value.trim(),
        opcion_c: document.getElementById('qOptionC').value.trim(),
        opcion_d: document.getElementById('qOptionD').value.trim(),
        respuesta_correcta: document.getElementById('qCorrect').value
    };

    setButtonLoading(btn, true, 'Guardando...');

    try {
        const { error } = await db
            .from('banco_preguntas')
            .insert(payload);

        if (error) throw error;

        document.getElementById('questionForm').reset();

        showToast(
            'Pregunta agregada al banco.',
            'success',
            2500
        );

        await loadModuleQuestions(moduloId);
        refreshCurrentModuleQuestionCount();

    } catch (error) {
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleDeleteQuestion(preguntaId) {
    if (!confirm('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const { error } = await db
            .from('banco_preguntas')
            .delete()
            .eq('id', preguntaId);

        if (error) throw error;

        showToast('Pregunta eliminada.', 'info', 2500);

        await loadModuleQuestions(APP.teacher.currentModuleId);
        refreshCurrentModuleQuestionCount();

    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

function refreshCurrentModuleQuestionCount() {
    const modulo = APP.teacher.modules.find(m => m.id === APP.teacher.currentModuleId);
    if (!modulo) return;
    modulo.banco_preguntas = Array.from({ length: APP.teacher.currentQuestionCount }, (_, i) => ({ id: `count-${i}` }));
    renderTeacherModules();
}

/* ============================== ESTUDIANTES ============================== */

async function loadModuleStudents(moduloId) {
    const list = document.getElementById('studentsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando estudiantes...
        </div>
    `;

    hideCreateStudentInline();

    try {
        const { data: inscripciones, error: inscripcionesError } = await db
            .from('inscripciones')
            .select('id, estudiante_id')
            .eq('modulo_id', moduloId)
            .order('created_at', { ascending: true });

        if (inscripcionesError) throw inscripcionesError;

        const total = (inscripciones || []).length;

        document.getElementById('tabEstudiantesCount').textContent = total;

        if (!total) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-user-plus"></i>
                    <h3>Sin estudiantes inscritos</h3>
                    <p>
                        Puedes inscribir un estudiante existente o crear
                        uno nuevo desde este módulo.
                    </p>
                </div>
            `;
            return;
        }

        const estudianteIds = inscripciones.map(
            inscripcion => inscripcion.estudiante_id
        );

        const { data: estudiantes, error: estudiantesError } = await db
            .from('usuarios')
            .select('id, nombres, apellidos, email, activo')
            .in('id', estudianteIds);

        if (estudiantesError) throw estudiantesError;

        const estudiantesPorId = {};

        (estudiantes || []).forEach(estudiante => {
            estudiantesPorId[estudiante.id] = estudiante;
        });

        // Guardamos los estudiantes en APP.teacher para exportación
        APP.teacher._currentStudents = inscripciones.map(inscripcion => {
            const estudiante = estudiantesPorId[inscripcion.estudiante_id];
            return estudiante ? { ...estudiante, inscripcion_id: inscripcion.id } : null;
        }).filter(Boolean);

        renderStudentList(APP.teacher._currentStudents);

    } catch (error) {
        console.error(
            'Error al cargar estudiantes del módulo:',
            error
        );

        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
    }
}

function renderStudentList(estudiantes) {
    const list = document.getElementById('studentsList');

    if (!estudiantes || estudiantes.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-plus"></i>
                <h3>Sin estudiantes inscritos</h3>
                <p>
                    Puedes inscribir un estudiante existente o crear
                    uno nuevo desde este módulo.
                </p>
            </div>
        `;
        return;
    }

    // Contenedor para botones de exportación
    let html = `
        <div class="export-actions" style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
            <button class="btn-secondary btn-compact" id="btnExportStudentsExcel">
                <i class="fa-solid fa-file-excel"></i> Exportar a Excel
            </button>
            <button class="btn-secondary btn-compact" id="btnExportStudentsPDF">
                <i class="fa-solid fa-file-pdf"></i> Exportar a PDF
            </button>
        </div>
        <div class="students-list">
    `;

    estudiantes.forEach(estudiante => {
        const estado = estudiante.activo
            ? ''
            : ' <span class="badge-inactive">Inactivo</span>';

        html += `
            <div class="student-item">
                <div>
                    <div class="s-name">
                        ${escapeHTML(estudiante.nombres || '')}
                        ${escapeHTML(estudiante.apellidos || '')}
                        ${estado}
                    </div>

                    <div class="s-email">
                        ${escapeHTML(estudiante.email || '')}
                    </div>
                </div>

                <button
                    class="icon-btn"
                    title="Quitar del módulo"
                    onclick="handleUnenroll('${estudiante.inscripcion_id}')"
                >
                    <i class="fa-solid fa-user-minus"></i>
                </button>
            </div>
        `;
    });

    html += `</div>`;
    list.innerHTML = html;

    // Asignar eventos a los botones de exportación
    document.getElementById('btnExportStudentsExcel')
        .addEventListener('click', () => exportTeacherStudents('excel'));

    document.getElementById('btnExportStudentsPDF')
        .addEventListener('click', () => exportTeacherStudents('pdf'));
}

// --- EXPORTACIÓN DE ESTUDIANTES ---
function exportTeacherStudents(format) {
    const students = APP.teacher._currentStudents || [];
    if (!students.length) {
        showToast('No hay estudiantes para exportar.', 'error');
        return;
    }

    const data = students.map(s => ({
        'Nombres': s.nombres || '',
        'Apellidos': s.apellidos || '',
        'Email': s.email || '',
        'Estado': s.activo ? 'Activo' : 'Inactivo'
    }));

    const moduleName = document.getElementById('detailModuleName').textContent || 'Módulo';
    const filename = `estudiantes_${moduleName.replace(/\s+/g, '_')}`;

    if (format === 'excel') {
        exportToExcel(data, filename);
    } else {
        exportToPDF(data, filename, `Lista de estudiantes - ${moduleName}`);
    }
}

/**
 * Obtiene y valida el programa del módulo actual.
 * El docente no selecciona manualmente el programa.
 */
async function getCurrentModuleProgramId(moduloId) {
    const { data, error } = await db
        .from('modulos')
        .select('id, programa_id, docente_id, activo')
        .eq('id', moduloId)
        .single();

    if (error) throw error;

    if (!data) {
        throw new Error('No fue posible encontrar el módulo.');
    }

    if (data.activo === false) {
        throw new Error('El módulo seleccionado está inactivo.');
    }

    if (data.docente_id !== APP.user.id) {
        throw new Error(
            'No tienes permisos para gestionar estudiantes en este módulo.'
        );
    }

    if (!data.programa_id) {
        throw new Error(
            'El módulo no tiene un programa asociado.'
        );
    }

    return data.programa_id;
}

/* ------------------------- Inscribir existente ------------------------- */

async function handleEnrollStudent(event) {
    event.preventDefault();

    const btn = document.getElementById('btnEnroll');

    // Normalizamos el correo para evitar problemas con mayúsculas y espacios.
    const email = document.getElementById('enrollEmail')
        .value
        .trim()
        .toLowerCase();

    const moduloId = APP.teacher.currentModuleId;

    if (!email) {
        showToast('Escribe el correo del estudiante.', 'error');
        return;
    }

    setButtonLoading(btn, true, 'Buscando...');

    try {
        // Validamos el módulo y obtenemos su programa.
        const programaId =
            await getCurrentModuleProgramId(moduloId);

        /*
         * Buscamos directamente en usuarios.
         *
         * Esto permite reconocer tanto los estudiantes creados
         * por el docente como los estudiantes que se registraron
         * desde la pantalla de inicio de sesión.
         */
        const { data: estudiante, error: buscarError } = await db
            .from('usuarios')
            .select('id, nombres, apellidos, email, rol, activo')
            .ilike('email', email)
            .maybeSingle();

        if (buscarError) throw buscarError;

        // No existe ningún usuario con ese correo.
        if (!estudiante) {
            showCreateStudentInline(email);
            return;
        }

        // Existe el usuario, pero no es estudiante.
        if (estudiante.rol !== 'estudiante') {
            throw new Error(
                'El correo ingresado pertenece a un usuario que no tiene el rol de estudiante.'
            );
        }

        // Validamos que tenga su perfil académico de estudiante.
        const { data: perfilEstudiante, error: perfilError } = await db
            .from('estudiantes')
            .select('usuario_id, programa_id, activo')
            .eq('usuario_id', estudiante.id)
            .maybeSingle();

        if (perfilError) throw perfilError;

        if (!perfilEstudiante) {
            throw new Error(
                'El usuario está registrado, pero no tiene un perfil académico de estudiante.'
            );
        }

        if (estudiante.activo === false ||
            perfilEstudiante.activo === false) {

            throw new Error(
                'Este estudiante se encuentra inactivo.'
            );
        }

        /*
         * El estudiante debe pertenecer al mismo programa
         * académico del módulo.
         */
        if (perfilEstudiante.programa_id !== programaId) {
            throw new Error(
                'El estudiante pertenece a un programa diferente y no puede ser inscrito en este módulo.'
            );
        }

        // Verificamos primero si ya está inscrito.
        const { data: inscripcionExistente, error: verificarError } =
            await db
                .from('inscripciones')
                .select('id')
                .eq('estudiante_id', estudiante.id)
                .eq('modulo_id', moduloId)
                .maybeSingle();

        if (verificarError) throw verificarError;

        if (inscripcionExistente) {
            throw new Error(
                'Ese estudiante ya está inscrito en este módulo.'
            );
        }

        // Inscribimos al estudiante.
        const { error: insertError } = await db
            .from('inscripciones')
            .insert({
                estudiante_id: estudiante.id,
                modulo_id: moduloId
            });

        if (insertError) throw insertError;

        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();

        showToast(
            `${estudiante.nombres || 'El estudiante'} fue inscrito correctamente en el módulo.`,
            'success'
        );

        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();

    } catch (error) {
        console.error('Error al inscribir estudiante:', error);

        showToast(
            friendlyError(error),
            'error',
            6000
        );

    } finally {
        setButtonLoading(btn, false);
    }
}

/* ------------------------- Crear estudiante ------------------------- */

function showCreateStudentInline(email) {
    const panel = document.getElementById('createStudentInline');

    document.getElementById('createStudentEmailPreview').textContent =
        email;

    panel.dataset.email = email;

    panel.classList.remove('hidden');

    document.getElementById('newStudentNombres').focus();
}

function hideCreateStudentInline() {
    const panel = document.getElementById('createStudentInline');

    if (!panel) return;

    panel.classList.add('hidden');
    panel.removeAttribute('data-email');

    const form = document.getElementById('createStudentForm');

    if (form) {
        form.reset();
    }
}

async function handleCreateStudentInline(event) {
    event.preventDefault();

    const btn = document.getElementById('btnCreateStudent');
    const moduloId = APP.teacher.currentModuleId;

    const panel = document.getElementById('createStudentInline');

    const email = panel.dataset.email;

    if (!email) {
        showToast(
            'Vuelve a escribir el correo del estudiante.',
            'error'
        );
        return;
    }

    setButtonLoading(btn, true, 'Creando...');

    try {
        // El programa se obtiene automáticamente del módulo actual.
        const programaId =
            await getCurrentModuleProgramId(moduloId);

        const payload = {
            rol: 'estudiante',

            nombres:
                document.getElementById('newStudentNombres')
                    .value.trim(),

            apellidos:
                document.getElementById('newStudentApellidos')
                    .value.trim(),

            email,

            password:
                document.getElementById('newStudentPassword')
                    .value,

            // Datos CEPRODENT 2.0
            programa_id: programaId,
            modulo_id: moduloId
        };

        const { data, error } = await db.functions.invoke(
            'create-user',
            {
                body: payload
            }
        );

        if (error) {
            console.error(
                'Error de la Edge Function:',
                error
            );

            throw error;
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        showToast(
            'Estudiante creado e inscrito correctamente.',
            'success'
        );

        document.getElementById('enrollForm').reset();
        hideCreateStudentInline();

        await loadModuleStudents(moduloId);
        await fetchTeacherModulesData();

    } catch (error) {
        console.error(
            'Error al crear estudiante:',
            error
        );

        showToast(
            friendlyError(error),
            'error',
            7000
        );

    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleUnenroll(inscripcionId) {
    if (!confirm('¿Quitar a este estudiante del módulo?')) {
        return;
    }

    try {
        const { error } = await db
            .from('inscripciones')
            .delete()
            .eq('id', inscripcionId);

        if (error) throw error;

        showToast(
            'Estudiante removido del módulo.',
            'info',
            2500
        );

        await loadModuleStudents(APP.teacher.currentModuleId);
        await fetchTeacherModulesData();

    } catch (error) {
        showToast(friendlyError(error), 'error');
    }
}

/* ============================== RESULTADOS ============================== */

async function loadModuleResults(moduloId) {
    const list = document.getElementById('moduleResultsList');

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando resultados...
        </div>
    `;

    const { data, error } = await db
        .from('resultados')
        .select(`
            id,
            calificacion,
            respuestas_correctas,
            total_preguntas,
            created_at,
            usuarios ( nombres, apellidos )
        `)
        .eq('modulo_id', moduloId)
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '';
        showToast(friendlyError(error), 'error');
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-chart-simple"></i>
                <h3>Aún no hay resultados</h3>
                <p>
                    Cuando tus estudiantes presenten la evaluación,
                    sus calificaciones aparecerán aquí.
                </p>
            </div>
        `;
        return;
    }

    list.innerHTML = data.map(r => `
        <div class="result-item">
            <div class="r-main">
                <strong>
                    ${escapeHTML(r.usuarios?.nombres || '')}
                    ${escapeHTML(r.usuarios?.apellidos || '')}
                </strong>

                <span class="r-meta">
                    ${r.respuestas_correctas}/${r.total_preguntas}
                    correctas · ${formatDate(r.created_at)}
                </span>
            </div>

            <span class="result-score ${scoreClass(r.calificacion)}">
                ${Number(r.calificacion).toFixed(1)}
            </span>
        </div>
    `).join('');
}

/* ============================== PESTAÑAS DEL DOCENTE ============================== */

function activateTeacherTab(tabName) {
    const tabsContainer = document.querySelector('#moduleDetailPanel .tabs');

    if (!tabsContainer) return;

    // Actualizar botones
    tabsContainer.querySelectorAll('.tab-btn').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.tab === tabName
        );
    });

    // Ocultar todos los paneles
    const panels = {
        preguntas: document.getElementById('tabPanelPreguntas'),
        estudiantes: document.getElementById('tabPanelEstudiantes'),
        resultados: document.getElementById('tabPanelResultados'),
        notas: document.getElementById('tabPanelNotas')
    };

    Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;

        panel.classList.toggle('hidden', name !== tabName);
    });
}

/* ============================== NOTAS DEL MÓDULO ============================== */

/**
 * Carga las notas finales de los estudiantes inscritos en el módulo actual.
 * La función SQL obtener_notas_finales calcula el promedio y la nota final.
 */
async function loadModuleGrades(moduloId) {
    const list = document.getElementById('moduleGradesList');

    if (!list) return;

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando calificaciones...
        </div>
    `;

    try {
        /*
         * Se consulta la función existente. Luego filtramos únicamente
         * el módulo que el docente está visualizando.
         */
        const { data, error } = await db
            .rpc('obtener_notas_finales');

        if (error) throw error;

        const notas = (data || []).filter(
            nota => nota.modulo_id === moduloId
        );

        renderModuleGrades(notas);

    } catch (error) {
        console.error('Error al cargar notas:', error);

        list.innerHTML = '';

        showToast(
            friendlyError(error),
            'error',
            6000
        );
    }
}


/**
 * Muestra la tabla de calificaciones y los botones de exportación.
 */
function renderModuleGrades(notas) {
    const list = document.getElementById('moduleGradesList');

    if (!notas || notas.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-graduation-cap"></i>
                <h3>Sin estudiantes para calificar</h3>
                <p>
                    Los estudiantes inscritos en este módulo aparecerán aquí.
                </p>
            </div>
        `;
        return;
    }

    // Guardar las notas en APP.teacher para exportación
    APP.teacher._currentGrades = notas;

    let html = `
        <div class="export-actions" style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
            <button class="btn-secondary btn-compact" id="btnExportGradesExcel">
                <i class="fa-solid fa-file-excel"></i> Exportar notas a Excel
            </button>
            <button class="btn-secondary btn-compact" id="btnExportGradesPDF">
                <i class="fa-solid fa-file-pdf"></i> Exportar notas a PDF
            </button>
        </div>
        <div style="overflow-x:auto">
            <table class="grades-table" style="width:100%; border-collapse:collapse">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:12px">
                            Estudiante
                        </th>
                        <th style="text-align:center; padding:12px">
                            Promedio evaluacion
                        </th>
                        <th style="text-align:center; padding:12px">
                            Producido
                        </th>
                        <th style="text-align:center; padding:12px">
                            Comprendido
                        </th>
                        <th style="text-align:center; padding:12px">
                            Nota final
                        </th>
                        <th style="text-align:center; padding:12px">
                            Acción
                        </th>
                    </tr>
                </thead>

                <tbody>
    `;

    notas.forEach(nota => {
        html += `
            <tr>
                <td style="padding:12px">
                    <strong>
                        ${escapeHTML(
                            nota.estudiante_nombre || 'Estudiante'
                        )}
                    </strong>
                </td>

                <td style="text-align:center; padding:12px">
                    ${formatGrade(nota.promedio_evaluaciones)}
                </td>

                <td style="text-align:center; padding:12px">
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        class="form-control grade-input"
                        id="nota1_${nota.estudiante_id}"
                        value="${nota.nota_adicional_1 ?? ''}"
                        placeholder="0.0"
                    >
                </td>

                <td style="text-align:center; padding:12px">
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        class="form-control grade-input"
                        id="nota2_${nota.estudiante_id}"
                        value="${nota.nota_adicional_2 ?? ''}"
                        placeholder="0.0"
                    >
                </td>

                <td style="text-align:center; padding:12px">
                    <strong>
                        ${formatGrade(nota.nota_final)}
                    </strong>
                </td>

                <td style="text-align:center; padding:12px">
                    <button
                        class="btn-primary btn-compact"
                        type="button"
                        onclick="saveAdditionalGrades(
                            '${nota.estudiante_id}',
                            '${nota.modulo_id}'
                        )"
                    >
                        <i class="fa-solid fa-floppy-disk"></i>
                        Guardar
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = html;

    // Asignar eventos a los botones de exportación
    document.getElementById('btnExportGradesExcel')
        .addEventListener('click', () => exportTeacherGrades('excel'));

    document.getElementById('btnExportGradesPDF')
        .addEventListener('click', () => exportTeacherGrades('pdf'));
}

// --- EXPORTACIÓN DE NOTAS ---
function exportTeacherGrades(format) {
    const grades = APP.teacher._currentGrades || [];
    if (!grades.length) {
        showToast('No hay notas para exportar.', 'error');
        return;
    }

    const data = grades.map(g => ({
        'Estudiante': g.estudiante_nombre || 'N/A',
        'Promedio evaluaciones': formatGrade(g.promedio_evaluaciones),
        'Nota adicional 1': formatGrade(g.nota_adicional_1),
        'Nota adicional 2': formatGrade(g.nota_adicional_2),
        'Nota final': formatGrade(g.nota_final)
    }));

    const moduleName = document.getElementById('detailModuleName').textContent || 'Módulo';
    const filename = `notas_${moduleName.replace(/\s+/g, '_')}`;

    if (format === 'excel') {
        exportToExcel(data, filename);
    } else {
        exportToPDF(data, filename, `Notas del módulo - ${moduleName}`);
    }
}


/**
 * Guarda o actualiza las dos notas adicionales.
 */
async function saveAdditionalGrades(estudianteId, moduloId) {
    const inputNota1 =
        document.getElementById(`nota1_${estudianteId}`);

    const inputNota2 =
        document.getElementById(`nota2_${estudianteId}`);

    const nota1 = inputNota1.value === ''
        ? null
        : Number(inputNota1.value);

    const nota2 = inputNota2.value === ''
        ? null
        : Number(inputNota2.value);

    /*
     * Validación de notas.
     * Actualmente el sistema trabaja con escala de 0 a 5.
     */
    if (
        (nota1 !== null && (nota1 < 0 || nota1 > 5)) ||
        (nota2 !== null && (nota2 < 0 || nota2 > 5))
    ) {
        showToast(
            'Las notas deben estar entre 0.0 y 5.0.',
            'error'
        );
        return;
    }

    try {
        /*
         * upsert permite crear las notas por primera vez o actualizarlas
         * si el docente las modifica posteriormente.
         *
         * Requiere una restricción única en estudiante_id + modulo_id,
         * que corresponde a la estructura de CEPRODENT 2.0.
         */
        const { error } = await db
            .from('notas_adicionales')
            .upsert(
                {
                    estudiante_id: estudianteId,
                    modulo_id: moduloId,
                    nota_1: nota1,
                    nota_2: nota2
                },
                {
                    onConflict: 'estudiante_id,modulo_id'
                }
            );

        if (error) throw error;

        showToast(
            'Notas adicionales guardadas correctamente.',
            'success'
        );

        await loadModuleGrades(moduloId);

    } catch (error) {
        console.error('Error al guardar notas:', error);

        showToast(
            friendlyError(error),
            'error',
            6000
        );
    }
}


/**
 * Formatea una calificación para mostrarla en pantalla.
 */
function formatGrade(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '—';
    }

    return Number(value).toFixed(1);
}


/* ============================== FUNCIONES DE EXPORTACIÓN (Excel / PDF) ============================== */

/**
 * Exporta datos a formato CSV (Excel) y descarga el archivo.
 * @param {Array<Object>} data - Array de objetos con los datos a exportar.
 * @param {string} filename - Nombre del archivo (sin extensión).
 */
function exportToExcel(data, filename) {
    if (!data || !data.length) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }

    const headers = Object.keys(data[0]);

    const escapeCell = value => {
        const text = String(value ?? '').replace(/"/g, '""');
        return `"${text}"`;
    };

    const csv = [
        headers.map(escapeCell).join(';'),
        ...data.map(row =>
            headers
                .map(header => escapeCell(row[header]))
                .join(';')
        ),
    ].join('\r\n');

    const blob = new Blob(
        ['\uFEFF' + csv],
        { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exporta datos a PDF utilizando la ventana de impresión.
 * @param {Array<Object>} data - Array de objetos con los datos a exportar.
 * @param {string} filename - Nombre del archivo (sin extensión).
 * @param {string} title - Título del reporte.
 */
function exportToPDF(data, filename, title) {
    if (!data || !data.length) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }

    const headers = Object.keys(data[0]);

    const html = `
        <html>
            <head>
                <meta charset="utf-8">
                <title>${escapeHTML(title)}</title>
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        padding: 24px;
                        color: #1f2937;
                    }
                    h1 { font-size: 18px; margin-bottom: 4px; }
                    p.meta { font-size: 12px; color: #6b7280; }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 16px;
                        font-size: 12px;
                    }
                    th, td {
                        border: 1px solid #d1d5db;
                        padding: 6px 8px;
                        text-align: left;
                    }
                    th { background: #f3f4f6; }
                </style>
            </head>
            <body>
                <h1>${escapeHTML(title)}</h1>
                <p class="meta">
                    CEPRODENT &middot;
                    ${escapeHTML(new Date().toLocaleString())} &middot;
                    ${data.length} registro(s)
                </p>
                <table>
                    <thead>
                        <tr>
                            ${headers
                                .map(header => `<th>${escapeHTML(header)}</th>`)
                                .join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data
                            .map(row => `
                                <tr>
                                    ${headers
                                        .map(header =>
                                            `<td>${escapeHTML(
                                                String(row[header] ?? '')
                                            )}</td>`
                                        )
                                        .join('')}
                                </tr>
                            `)
                            .join('')}
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast(
            'Permite las ventanas emergentes para exportar el PDF.',
            'error'
        );
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
}


/* ============================== INIT / EVENTOS ============================== */

function initTeacherModule() {
    initNewModuleModal();
    initTeacherTabs();

    document.getElementById('btnBackToModules')
        .addEventListener('click', backToModuleList);

    document.getElementById('evalToggle')
        .addEventListener('change', handleToggleEvaluation);

    document.getElementById('questionForm')
        .addEventListener('submit', handleAddQuestion);

    document.getElementById('enrollForm')
        .addEventListener('submit', handleEnrollStudent);

    document.getElementById('createStudentForm')
        .addEventListener('submit', handleCreateStudentInline);
}

function initTeacherTabs() {
    const tabsContainer = document.querySelector('#moduleDetailPanel .tabs');

    if (!tabsContainer) return;

    // Evita registrar los eventos más de una vez.
    if (tabsContainer.dataset.initialized === 'true') return;

    tabsContainer.dataset.initialized = 'true';

    tabsContainer.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const tabName = button.dataset.tab;
            activateTeacherTab(tabName);
            const moduloId = APP.teacher.currentModuleId;
            if (!moduloId) return;
            const state = APP.teacher.loadedTabs[moduloId] || (APP.teacher.loadedTabs[moduloId] = {});
            if (state[tabName]) return;

            if (tabName === 'estudiantes') await loadModuleStudents(moduloId);
            if (tabName === 'resultados') await loadModuleResults(moduloId);
            if (tabName === 'notas') await loadModuleGrades(moduloId);
            state[tabName] = true;
        });
    });
}