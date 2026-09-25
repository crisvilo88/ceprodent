/**
 * student.js
 * ----------------------------------------------------------------------
 * Panel del estudiante - CEPRODENT 2.0
 *
 * - Muestra únicamente los módulos donde el estudiante está inscrito.
 * - Muestra el programa y docente responsable.
 * - Permite presentar evaluaciones activas.
 * - Muestra el historial de calificaciones.
 * - Muestra las notas finales por módulo.
 * - Permite exportar historial y notas a Excel y PDF.
 * - Se actualiza cuando el docente activa o desactiva una evaluación.
 * ----------------------------------------------------------------------
 */

APP.student = {
    modules: [],
    resultsByModule: {},
    grades: [],
    realtimeChannel: null,
    _exportResults: [],   // para exportación
    _exportGrades: []     // para exportación
};

/* ============================== DASHBOARD ============================== */

async function loadStudentDashboard() {
    const grid = document.getElementById('studentModulesGrid');
    const empty = document.getElementById('studentEmptyState');

    grid.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando tus módulos...
        </div>
    `;

    if (empty) {
        empty.classList.add('hidden');
    }

    try {
        /*
         * Primero obtenemos las inscripciones del estudiante.
         */
        const { data: inscripciones, error: errInsc } = await db
            .from('inscripciones')
            .select('id, estudiante_id, modulo_id')
            .eq('estudiante_id', APP.user.id);

        if (errInsc) throw errInsc;

        if (!inscripciones || inscripciones.length === 0) {
            APP.student.modules = [];
            APP.student.resultsByModule = {};
            APP.student.grades = [];

            grid.innerHTML = '';

            if (empty) {
                empty.classList.remove('hidden');
            }

            renderStudentResults([]);
            renderStudentGrades([]);
            unsubscribeStudentRealtime();
            return;
        }

        const moduleIds = inscripciones.map(
            inscripcion => inscripcion.modulo_id
        );

        /*
         * Obtener los módulos.
         */
        const { data: modules, error: errModules } = await db
            .from('modulos')
            .select(`
                id,
                nombre,
                descripcion,
                programa_id,
                docente_id,
                activo,
                programas (
                    id,
                    nombre
                )
            `)
            .in('id', moduleIds);

        if (errModules) throw errModules;

        /*
         * Cargar los docentes responsables.
         */
        const docenteIds = [
            ...new Set(
                (modules || [])
                    .map(modulo => modulo.docente_id)
                    .filter(Boolean)
            )
        ];

        let docentesPorId = {};

        if (docenteIds.length > 0) {
            const { data: docentes, error: errDocentes } = await db
                .from('usuarios')
                .select('id, nombres, apellidos')
                .in('id', docenteIds);

            if (errDocentes) throw errDocentes;

            (docentes || []).forEach(docente => {
                docentesPorId[docente.id] = docente;
            });
        }

        /*
         * Cargar el estado de las evaluaciones.
         */
        const { data: evaluaciones, error: errEvaluaciones } = await db
            .from('evaluaciones_activas')
            .select('modulo_id, activa')
            .in('modulo_id', moduleIds);

        if (errEvaluaciones) throw errEvaluaciones;

        const evaluacionesPorModulo = {};

        (evaluaciones || []).forEach(evaluacion => {
            evaluacionesPorModulo[evaluacion.modulo_id] =
                evaluacion.activa === true;
        });

        /*
         * Construir los módulos que verá el estudiante.
         */
        APP.student.modules = (modules || [])
            .filter(modulo => modulo.activo !== false)
            .map(modulo => ({
                ...modulo,

                docente: docentesPorId[modulo.docente_id] || null,

                evaluaciones_activas: {
                    activa:
                        evaluacionesPorModulo[modulo.id] === true
                }
            }));

        /*
         * Obtener resultados del estudiante.
         */
        const { data: resultados, error: errRes } = await db
            .from('resultados')
            .select(`
                id,
                modulo_id,
                calificacion,
                respuestas_correctas,
                total_preguntas,
                created_at
            `)
            .eq('estudiante_id', APP.user.id)
            .order('created_at', { ascending: false });

        if (errRes) {
            console.error(
                'Error al cargar resultados:',
                errRes
            );
        }

        /*
         * Guardar solamente el último resultado de cada módulo.
         */
        APP.student.resultsByModule = {};

        (resultados || []).forEach(resultado => {
            if (!APP.student.resultsByModule[resultado.modulo_id]) {
                APP.student.resultsByModule[resultado.modulo_id] =
                    resultado;
            }
        });

        /*
         * Cargar las notas finales.
         */
        await loadStudentGrades();

        renderStudentModules();
        renderStudentResults(resultados || [], errRes);

        subscribeToEvaluationChanges();

    } catch (error) {
        console.error(
            'Error al cargar el dashboard del estudiante:',
            error
        );

        grid.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
        }

        showToast(
            friendlyError(error),
            'error',
            6000
        );
    }
}

/* ============================== MÓDULOS ============================== */

function renderStudentModules() {
    const grid = document.getElementById('studentModulesGrid');
    const empty = document.getElementById('studentEmptyState');
    const modules = APP.student.modules || [];

    if (!modules.length) {
        grid.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
        }

        return;
    }

    if (empty) {
        empty.classList.add('hidden');
    }

    grid.innerHTML = modules.map(modulo => {
        const activa =
            modulo.evaluaciones_activas?.activa === true;

        const resultado =
            APP.student.resultsByModule[modulo.id];

        const docenteNombre = modulo.docente
            ? `${modulo.docente.nombres || ''} ${modulo.docente.apellidos || ''}`.trim()
            : '—';

        let boton = '';

        if (resultado) {
            boton = `
                <button
                    class="btn-secondary"
                    style="width:100%"
                    disabled
                >
                    <i class="fa-solid fa-circle-check"></i>
                    Ya presentada · Nota ${Number(
                        resultado.calificacion
                    ).toFixed(1)}
                </button>
            `;

        } else if (activa) {
            boton = `
                <button
                    class="btn-primary"
                    style="width:100%"
                    onclick="startQuiz(
                        '${modulo.id}',
                        '${escapeHTML(modulo.nombre).replace(/'/g, "\\'")}'
                    )"
                >
                    <i class="fa-solid fa-pen-to-square"></i>
                    Presentar evaluación
                </button>
            `;

        } else {
            boton = `
                <button
                    class="btn-secondary"
                    style="width:100%"
                    disabled
                >
                    <i class="fa-solid fa-lock"></i>
                    Evaluación no disponible
                </button>
            `;
        }

        return `
            <div class="eval-card ${activa ? '' : 'is-inactive'}">
                <div>
                    <span class="eval-badge ${
                        activa
                            ? 'badge-active'
                            : 'badge-inactive'
                    }">
                        <i class="fa-solid ${
                            activa
                                ? 'fa-circle'
                                : 'fa-lock'
                        }"></i>
                        ${
                            activa
                                ? 'Evaluación activa'
                                : 'No disponible'
                        }
                    </span>

                    <h3 class="eval-title">
                        ${escapeHTML(modulo.nombre || 'Módulo')}
                    </h3>

                    <div class="eval-info">
                        <div>
                            <i class="fa-solid fa-book"></i>
                            Programa:
                            ${escapeHTML(
                                modulo.programas?.nombre || '—'
                            )}
                        </div>

                        <div>
                            <i class="fa-solid fa-user-tie"></i>
                            Docente:
                            ${escapeHTML(docenteNombre)}
                        </div>

                        <div>
                            <i class="fa-solid fa-clock"></i>
                            12 preguntas aleatorias · 15 min
                        </div>
                    </div>
                </div>

                ${boton}
            </div>
        `;
    }).join('');
}

/* ============================== RESULTADOS (HISTORIAL) ============================== */

function renderStudentResults(resultados, error) {
    const list = document.getElementById('studentResultsList');

    if (!list) return;

    if (error) {
        list.innerHTML = `
            <p class="text-muted">
                No fue posible cargar tu historial de calificaciones.
            </p>
        `;
        return;
    }

    if (!resultados || resultados.length === 0) {
        list.innerHTML = `
            <p class="text-muted">
                Aún no has presentado ninguna evaluación.
            </p>
        `;
        return;
    }

    // Guardar datos para exportación
    APP.student._exportResults = resultados.map(r => {
        const modulo = (APP.student.modules || []).find(m => m.id === r.modulo_id);
        return {
            'Módulo': modulo?.nombre || 'Módulo',
            'Calificación': Number(r.calificacion).toFixed(1),
            'Correctas': r.respuestas_correctas || 0,
            'Total preguntas': r.total_preguntas || 0,
            'Fecha': formatDate(r.created_at) || ''
        };
    });

    // Construir HTML con botones de exportación
    let html = `
        <div class="export-actions" style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
            <button class="btn-secondary btn-compact" id="btnExportResultsExcel">
                <i class="fa-solid fa-file-excel"></i> Exportar historial a Excel
            </button>
            <button class="btn-secondary btn-compact" id="btnExportResultsPDF">
                <i class="fa-solid fa-file-pdf"></i> Exportar historial a PDF
            </button>
        </div>
        <div class="results-list">
    `;

    const modulesPorId = {};
    (APP.student.modules || []).forEach(modulo => {
        modulesPorId[modulo.id] = modulo;
    });

    resultados.forEach(resultado => {
        const modulo = modulesPorId[resultado.modulo_id];
        html += `
            <div class="result-item">
                <div class="r-main">
                    <strong>
                        ${escapeHTML(modulo?.nombre || 'Módulo')}
                    </strong>
                    <span class="r-meta">
                        ${resultado.respuestas_correctas || 0}/${resultado.total_preguntas || 0} correctas ·
                        ${formatDate(resultado.created_at)}
                    </span>
                </div>
                <span class="result-score ${scoreClass(resultado.calificacion)}">
                    ${Number(resultado.calificacion).toFixed(1)}
                </span>
            </div>
        `;
    });

    html += `</div>`;
    list.innerHTML = html;

    // Asignar eventos a los botones
    document.getElementById('btnExportResultsExcel')
        .addEventListener('click', () => exportStudentResults('excel'));

    document.getElementById('btnExportResultsPDF')
        .addEventListener('click', () => exportStudentResults('pdf'));
}

/* ============================== NOTAS FINALES ============================== */

/**
 * Obtiene las notas finales exclusivamente del estudiante
 * que tiene la sesión activa.
 */
async function loadStudentGrades() {
    const list = document.getElementById('studentGradesList');

    if (!list) return;

    list.innerHTML = `
        <div class="loading-inline">
            <i class="fa-solid fa-spinner"></i>
            Cargando tus notas...
        </div>
    `;

    try {
        const { data, error } = await db
            .rpc(
                'obtener_notas_finales',
                {
                    p_estudiante_id: APP.user.id
                }
            );

        if (error) throw error;

        APP.student.grades = data || [];

        renderStudentGrades(APP.student.grades);

    } catch (error) {
        console.error(
            'Error al cargar las notas finales:',
            error
        );

        list.innerHTML = `
            <p class="text-muted">
                No fue posible cargar tus notas finales.
            </p>
        `;
    }
}

/**
 * Muestra las notas organizadas por módulo con botones de exportación.
 */
function renderStudentGrades(notas) {
    const list = document.getElementById('studentGradesList');

    if (!list) return;

    if (!notas || notas.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-graduation-cap"></i>
                <h3>Aún no tienes calificaciones finales</h3>
                <p>
                    Tus notas aparecerán aquí cuando tengas módulos
                    inscritos y evaluaciones registradas.
                </p>
            </div>
        `;
        return;
    }

    // Guardar datos para exportación
    APP.student._exportGrades = notas.map(nota => ({
        'Módulo': nota.modulo_nombre || 'Módulo',
        'Promedio evaluaciones': formatStudentGrade(nota.promedio_evaluaciones),
        'Nota adicional 1': formatStudentGrade(nota.nota_adicional_1),
        'Nota adicional 2': formatStudentGrade(nota.nota_adicional_2),
        'Nota final': formatStudentGrade(nota.nota_final)
    }));

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
                        <th style="text-align:left; padding:12px">Módulo</th>
                        <th style="text-align:center; padding:12px">Promedio evaluaciones</th>
                        <th style="text-align:center; padding:12px">Nota adicional 1</th>
                        <th style="text-align:center; padding:12px">Nota adicional 2</th>
                        <th style="text-align:center; padding:12px">Nota final</th>
                    </tr>
                </thead>
                <tbody>
    `;

    notas.forEach(nota => {
        html += `
            <tr>
                <td style="padding:12px"><strong>${escapeHTML(nota.modulo_nombre || 'Módulo')}</strong></td>
                <td style="text-align:center; padding:12px">${formatStudentGrade(nota.promedio_evaluaciones)}</td>
                <td style="text-align:center; padding:12px">${formatStudentGrade(nota.nota_adicional_1)}</td>
                <td style="text-align:center; padding:12px">${formatStudentGrade(nota.nota_adicional_2)}</td>
                <td style="text-align:center; padding:12px"><strong>${formatStudentGrade(nota.nota_final)}</strong></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = html;

    // Asignar eventos a los botones
    document.getElementById('btnExportGradesExcel')
        .addEventListener('click', () => exportStudentGrades('excel'));

    document.getElementById('btnExportGradesPDF')
        .addEventListener('click', () => exportStudentGrades('pdf'));
}

/**
 * Formatea una calificación.
 */
function formatStudentGrade(value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return Number(value).toFixed(1);
}

/* ============================== EXPORTACIONES DEL ESTUDIANTE ============================== */

/**
 * Exporta el historial de calificaciones.
 */
function exportStudentResults(format) {
    const data = APP.student._exportResults;
    if (!data || data.length === 0) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }
    const filename = `mi_historial_${new Date().toISOString().slice(0,10)}`;
    if (format === 'excel') {
        exportToExcel(data, filename);
    } else {
        exportToPDF(data, filename, 'Mi historial de calificaciones');
    }
}

/**
 * Exporta las notas finales.
 */
function exportStudentGrades(format) {
    const data = APP.student._exportGrades;
    if (!data || data.length === 0) {
        showToast('No hay datos para exportar.', 'error');
        return;
    }
    const filename = `mis_notas_${new Date().toISOString().slice(0,10)}`;
    if (format === 'excel') {
        exportToExcel(data, filename);
    } else {
        exportToPDF(data, filename, 'Mis notas finales');
    }
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
                    body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1f2937; }
                    h1 { font-size: 18px; margin-bottom: 4px; }
                    p.meta { font-size: 12px; color: #6b7280; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
                    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
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
                    <thead><tr>
                        ${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${headers.map(h => `<td>${escapeHTML(String(row[h] ?? ''))}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Permite las ventanas emergentes para exportar el PDF.', 'error');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
}

/* ============================== TIEMPO REAL ============================== */

function unsubscribeStudentRealtime() {
    if (APP.student.realtimeChannel) {
        db.removeChannel(APP.student.realtimeChannel);
        APP.student.realtimeChannel = null;
    }
}

/**
 * Escucha cambios de las evaluaciones activas para actualizar
 * automáticamente el estado de los módulos del estudiante.
 */
function subscribeToEvaluationChanges() {
    unsubscribeStudentRealtime();

    const moduleIds = new Set(
        (APP.student.modules || []).map(
            modulo => modulo.id
        )
    );

    if (!moduleIds.size) return;

    APP.student.realtimeChannel = db
        .channel(
            `evaluaciones-estudiante-${APP.user.id}`
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'evaluaciones_activas'
            },
            payload => {
                const moduloId =
                    payload.new?.modulo_id ||
                    payload.old?.modulo_id;

                if (
                    moduloId &&
                    moduleIds.has(moduloId)
                ) {
                    loadStudentDashboard();
                }
            }
        )
        .subscribe();
}

/* ============================== INICIALIZACIÓN ============================== */

function initStudentModule() {
    const refreshButton =
        document.getElementById('btnRefreshStudent');

    if (refreshButton) {
        refreshButton.addEventListener(
            'click',
            loadStudentDashboard
        );
    }
}