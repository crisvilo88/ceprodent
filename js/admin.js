/**
 * CEPRODENT 2.0
 * ----------------------------------------------------------------------
 * Panel del administrador
 *
 * Funcionalidades:
 * - Dashboard y estadísticas generales.
 * - Administración de docentes.
 * - Administración de estudiantes.
 * - Administración de programas académicos.
 * - Centro de reportes con filtros:
 *      * Estudiantes (filtro por programa y estado).
 *      * Módulos (filtro por programa, docente y estado).
 *      * Calificaciones (filtro por módulo, búsqueda de estudiante y rango de fechas).
 * - Exportación a Excel (CSV) y PDF con datos filtrados.
 * ----------------------------------------------------------------------
 */

APP.admin = {
    docentes: [],
    estudiantes: [],
    programas: [],
    currentReport: null,
    reportExport: null,
    filters: {
        estudiantes: { programa: '', estado: '' },
        modulos: { programa: '', docente: '', estado: '' },
        calificaciones: { modulo: '', estudiante: '', fechaDesde: '', fechaHasta: '' }
    }
};


/* ======================================================================
   DASHBOARD ADMINISTRATIVO
====================================================================== */

async function loadAdminDashboard() {
    await Promise.all([
        loadAdminStats(),
        loadAdminTopProgramas(),
    ]);
}


/* ----------------------------------------------------------------------
   ESTADÍSTICAS GENERALES
---------------------------------------------------------------------- */

async function loadAdminStats() {

    const {
        data,
        error,
    } = await db
        .from('v_dashboard_administrador')
        .select('*')
        .single();

    if (error) {
        console.error(
            'Error al cargar estadísticas administrativas:',
            error
        );
        return;
    }

    const set = (id, value) => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value ?? 0;
        }
    };

    set(
        'statDocentesActivos',
        data.docentes_activos
    );

    set(
        'statDocentesInactivos',
        data.docentes_inactivos
    );

    set(
        'statEstudiantesActivos',
        data.estudiantes_activos
    );

    set(
        'statEstudiantesInactivos',
        data.estudiantes_inactivos
    );

    set(
        'statProgramas',
        data.programas_activos
    );
}


/* ----------------------------------------------------------------------
   PROGRAMAS CON MÁS ESTUDIANTES
---------------------------------------------------------------------- */

async function loadAdminTopProgramas() {

    const box =
        document.getElementById('adminTopProgramas');

    if (!box) {
        return;
    }

    const {
        data,
        error,
    } = await db
        .from('v_top_programas')
        .select('*');

    if (error) {

        console.error(
            'Error al cargar programas principales:',
            error
        );

        box.innerHTML =
            '<p class="text-muted">' +
            'No fue posible cargar las estadísticas.' +
            '</p>';

        return;
    }

    if (!data || !data.length) {

        box.innerHTML =
            '<p class="text-muted">' +
            'Aún no hay programas con estudiantes.' +
            '</p>';

        return;
    }

    box.innerHTML = data.map((programa, index) => `
        <div class="student-item">

            <div>

                <div class="s-name">
                    #${index + 1}
                    ${escapeHTML(programa.nombre || '')}
                </div>

                <div class="s-email">
                    ${programa.total_estudiantes || 0}
                    estudiante(s)
                </div>

            </div>

            <i class="fa-solid fa-trophy"></i>

        </div>
    `).join('');
}


/* ======================================================================
   NAVEGACIÓN ENTRE MÓDULOS ADMINISTRATIVOS
====================================================================== */

function showAdminModule(name) {

    const panels = [
        'adminDashboardPanel',
        'adminDocentesPanel',
        'adminEstudiantesPanel',
        'adminProgramasPanel',
        'adminReportesPanel',
    ];

    panels.forEach(id => {

        const panel =
            document.getElementById(id);

        if (panel) {
            panel.classList.add('hidden');
        }

    });


    const panelMap = {

        docentes:
            'adminDocentesPanel',

        estudiantes:
            'adminEstudiantesPanel',

        programas:
            'adminProgramasPanel',

        reportes:
            'adminReportesPanel',

    };


    /*
     * Dashboard principal.
     */
    if (!panelMap[name]) {

        const dashboard =
            document.getElementById(
                'adminDashboardPanel'
            );

        if (dashboard) {
            dashboard.classList.remove('hidden');
        }

        loadAdminDashboard();

        return;
    }


    const selectedPanel =
        document.getElementById(
            panelMap[name]
        );

    if (selectedPanel) {
        selectedPanel.classList.remove('hidden');
    }


    /*
     * Cargar información específica del módulo.
     */
    if (name === 'docentes') {
        loadAdminUsersList('docente');
    }


    if (name === 'estudiantes') {

        loadAdminProgramasSelect();

        loadAdminUsersList(
            'estudiante'
        );

    }


    if (name === 'programas') {
        loadAdminProgramasList();
    }


    if (name === 'reportes') {
        resetAdminReportView();
    }

}


/* ======================================================================
   ADMINISTRACIÓN DE USUARIOS
====================================================================== */

async function loadAdminUsersList(rol) {

    const id =
        rol === 'docente'
            ? 'adminDocentesList'
            : 'adminEstudiantesList';

    const box =
        document.getElementById(id);

    if (!box) {
        return;
    }

    box.innerHTML =
        '<div class="loading-inline">' +
        '<i class="fa-solid fa-spinner"></i> ' +
        'Cargando...' +
        '</div>';


    const {
        data,
        error,
    } = await db
        .from('usuarios')
        .select(
            'id, nombres, apellidos, email, activo, created_at'
        )
        .eq('rol', rol)
        .order(
            'created_at',
            {
                ascending: false,
            }
        );


    if (error) {

        console.error(
            'Error al cargar usuarios:',
            error
        );

        box.innerHTML = '';

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    if (rol === 'docente') {

        APP.admin.docentes =
            data || [];

    } else {

        APP.admin.estudiantes =
            data || [];

    }


    renderAdminUsersList(
        id,
        data || [],
        rol
    );

}


/* ----------------------------------------------------------------------
   MOSTRAR LISTADO DE USUARIOS
---------------------------------------------------------------------- */

function renderAdminUsersList(
    id,
    users,
    rol
) {

    const box =
        document.getElementById(id);

    if (!box) {
        return;
    }


    if (!users.length) {

        box.innerHTML =
            '<p class="text-muted">' +
            'Aún no hay registros.' +
            '</p>';

        return;
    }


    box.innerHTML = users.map(user => `

        <div class="student-item">

            <div>

                <div class="s-name">

                    ${escapeHTML(
                        user.nombres || ''
                    )}

                    ${escapeHTML(
                        user.apellidos || ''
                    )}

                    ${
                        user.activo
                            ? ''
                            : '<span class="status-inactive">' +
                              'Inactivo' +
                              '</span>'
                    }

                </div>


                <div class="s-email">

                    ${escapeHTML(
                        user.email || ''
                    )}

                </div>

            </div>


            <div class="admin-actions">

                <button
                    class="btn-icon"
                    title="Editar"
                    type="button"
                    onclick="adminEditUser('${user.id}')"
                >
                    <i class="fa-solid fa-pen"></i>
                </button>


                <button
                    class="btn-icon"
                    title="${
                        user.activo
                            ? 'Desactivar'
                            : 'Activar'
                    }"
                    type="button"
                    onclick="adminToggleUser(
                        '${user.id}',
                        ${!user.activo}
                    )"
                >
                    <i
                        class="fa-solid ${
                            user.activo
                                ? 'fa-user-slash'
                                : 'fa-user-check'
                        }"
                    ></i>
                </button>


                <button
                    class="btn-icon danger"
                    title="Eliminar"
                    type="button"
                    onclick="adminDeleteUser(
                        '${user.id}',
                        '${rol}'
                    )"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>

            </div>

        </div>

    `).join('');

}


/* ----------------------------------------------------------------------
   CREAR DOCENTE O ESTUDIANTE
---------------------------------------------------------------------- */

async function createAdminUser(
    event,
    rol
) {

    event.preventDefault();


    const prefix =
        rol === 'docente'
            ? 'docente'
            : 'estudiante';


    const buttonId =
        rol === 'docente'
            ? 'btnCrearDocente'
            : 'btnCrearEstudiante';


    const button =
        document.getElementById(buttonId);


    const payload = {

        rol,

        nombres:
            document
                .getElementById(
                    prefix + 'Nombres'
                )
                .value
                .trim(),

        apellidos:
            document
                .getElementById(
                    prefix + 'Apellidos'
                )
                .value
                .trim(),

        email:
            document
                .getElementById(
                    prefix + 'Email'
                )
                .value
                .trim(),

        password:
            document
                .getElementById(
                    prefix + 'Password'
                )
                .value,

    };


    if (rol === 'estudiante') {

        payload.programa_id =
            document.getElementById(
                'estudiantePrograma'
            ).value;

    }


    setButtonLoading(
        button,
        true,
        'Creando...'
    );


    try {

        const {
            data,
            error,
        } = await db.functions.invoke(
            'create-user',
            {
                body: payload,
            }
        );


        if (error) {
            throw error;
        }


        if (data?.error) {
            throw new Error(
                data.error
            );
        }


        showToast(
            rol === 'docente'
                ? 'Docente creado correctamente.'
                : 'Estudiante creado correctamente.',
            'success'
        );


        event.target.reset();


        await loadAdminUsersList(
            rol
        );

        await loadAdminStats();


    } catch (error) {

        console.error(
            'Error al crear usuario:',
            error
        );

        showToast(
            friendlyError(error),
            'error',
            6000
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }

}


/* ======================================================================
   PROGRAMAS ACADÉMICOS
====================================================================== */

async function loadAdminProgramasSelect() {

    const select =
        document.getElementById(
            'estudiantePrograma'
        );

    if (!select) {
        return;
    }


    const {
        data,
        error,
    } = await db
        .from('programas')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');


    if (error) {

        select.innerHTML =
            '<option value="">' +
            'No se pudieron cargar programas' +
            '</option>';

        return;
    }


    select.innerHTML =
        '<option value="">' +
        '— Seleccione un programa —' +
        '</option>' +

        (data || []).map(programa => `
            <option value="${programa.id}">
                ${escapeHTML(programa.nombre)}
            </option>
        `).join('');

}


async function loadAdminProgramasList() {

    const box =
        document.getElementById(
            'adminProgramasList'
        );

    if (!box) {
        return;
    }


    const {
        data,
        error,
    } = await db
        .from('programas')
        .select(
            'id, nombre, activo'
        )
        .order('nombre');


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    APP.admin.programas =
        data || [];


    if (!data || !data.length) {

        box.innerHTML =
            '<p class="text-muted">' +
            'Aún no hay programas.' +
            '</p>';

        return;
    }


    box.innerHTML = data.map(programa => `

        <div class="student-item">

            <div>

                <div class="s-name">

                    ${escapeHTML(
                        programa.nombre || ''
                    )}

                    ${
                        programa.activo
                            ? ''
                            : '<span class="status-inactive">' +
                              'Inactivo' +
                              '</span>'
                    }

                </div>

            </div>


            <div class="admin-actions">

                <button
                    class="btn-icon"
                    type="button"
                    title="Editar"
                    onclick="adminEditPrograma(
                        '${programa.id}'
                    )"
                >
                    <i class="fa-solid fa-pen"></i>
                </button>


                <button
                    class="btn-icon"
                    type="button"
                    title="${
                        programa.activo
                            ? 'Desactivar'
                            : 'Activar'
                    }"
                    onclick="adminTogglePrograma(
                        '${programa.id}',
                        ${!programa.activo}
                    )"
                >
                    <i
                        class="fa-solid ${
                            programa.activo
                                ? 'fa-ban'
                                : 'fa-check'
                        }"
                    ></i>
                </button>


                <button
                    class="btn-icon danger"
                    type="button"
                    title="Eliminar"
                    onclick="adminDeletePrograma(
                        '${programa.id}'
                    )"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>

            </div>

        </div>

    `).join('');

}


/* ----------------------------------------------------------------------
   CREAR PROGRAMA
---------------------------------------------------------------------- */

async function handleCreatePrograma(event) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                'adminProgramaNombre'
            )
            .value
            .trim();


    const button =
        document.getElementById(
            'btnCrearPrograma'
        );


    if (!name) {

        showToast(
            'Escribe el nombre del programa.',
            'error'
        );

        return;
    }


    setButtonLoading(
        button,
        true,
        'Creando...'
    );


    try {

        const {
            error,
        } = await db
            .from('programas')
            .insert({
                nombre: name,
                activo: true,
                creado_por: APP.user.id,
            });


        if (error) {
            throw error;
        }


        event.target.reset();


        showToast(
            'Programa creado correctamente.',
            'success'
        );


        await loadAdminProgramasList();

        await loadAdminStats();


    } catch (error) {

        showToast(
            friendlyError(error),
            'error'
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }

}


/* ======================================================================
   EDITAR / ACTIVAR / ELIMINAR USUARIOS
====================================================================== */

async function adminEditUser(id) {

    const user = [
        ...APP.admin.docentes,
        ...APP.admin.estudiantes,
    ].find(item =>
        item.id === id
    );


    if (!user) {
        return;
    }


    const nombres =
        prompt(
            'Nombres:',
            user.nombres
        );


    if (nombres === null) {
        return;
    }


    const apellidos =
        prompt(
            'Apellidos:',
            user.apellidos
        );


    if (apellidos === null) {
        return;
    }


    const email =
        prompt(
            'Correo:',
            user.email
        );


    if (email === null) {
        return;
    }


    const {
        error,
    } = await db
        .from('usuarios')
        .update({
            nombres:
                nombres.trim(),

            apellidos:
                apellidos.trim(),

            email:
                email.trim(),
        })
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        'Usuario actualizado.',
        'success'
    );


    const rol =
        APP.admin.docentes.some(
            item => item.id === id
        )
            ? 'docente'
            : 'estudiante';


    await loadAdminUsersList(
        rol
    );

}


async function adminToggleUser(
    id,
    activo
) {

    const {
        error,
    } = await db
        .from('usuarios')
        .update({
            activo,
        })
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        activo
            ? 'Usuario activado.'
            : 'Usuario desactivado.',
        'success'
    );


    const rol =
        APP.admin.docentes.some(
            item => item.id === id
        )
            ? 'docente'
            : 'estudiante';


    await loadAdminUsersList(
        rol
    );

    await loadAdminStats();

}


async function adminDeleteUser(
    id,
    rol
) {

    const confirmed = confirm(
        '¿Desea eliminar este usuario? ' +
        'Esta acción no se puede deshacer.'
    );


    if (!confirmed) {
        return;
    }


    const {
        error,
    } = await db
        .from('usuarios')
        .delete()
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        'Usuario eliminado.',
        'success'
    );


    await loadAdminUsersList(
        rol
    );

    await loadAdminStats();

}


/* ======================================================================
   EDITAR / ACTIVAR / ELIMINAR PROGRAMAS
====================================================================== */

async function adminEditPrograma(id) {

    const program =
        APP.admin.programas.find(
            item => item.id === id
        );


    if (!program) {
        return;
    }


    const nombre =
        prompt(
            'Nombre del programa:',
            program.nombre
        );


    if (
        nombre === null ||
        !nombre.trim()
    ) {
        return;
    }


    const {
        error,
    } = await db
        .from('programas')
        .update({
            nombre:
                nombre.trim(),
        })
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        'Programa actualizado.',
        'success'
    );


    await loadAdminProgramasList();

}


async function adminTogglePrograma(
    id,
    activo
) {

    const {
        error,
    } = await db
        .from('programas')
        .update({
            activo,
        })
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        activo
            ? 'Programa activado.'
            : 'Programa desactivado.',
        'success'
    );


    await loadAdminProgramasList();

    await loadAdminStats();

}


async function adminDeletePrograma(id) {

    const confirmed = confirm(
        '¿Eliminar este programa? ' +
        'No se podrá eliminar si tiene información relacionada.'
    );


    if (!confirmed) {
        return;
    }


    const {
        error,
    } = await db
        .from('programas')
        .delete()
        .eq('id', id);


    if (error) {

        showToast(
            friendlyError(error),
            'error'
        );

        return;
    }


    showToast(
        'Programa eliminado.',
        'success'
    );


    await loadAdminProgramasList();

    await loadAdminStats();

}


/* ======================================================================
   CENTRO DE REPORTES CON FILTROS
====================================================================== */

/*
 * Restablece el área visual al entrar al módulo de reportes.
 */
function resetAdminReportView() {

    APP.admin.currentReport = null;
    APP.admin.reportExport = null;

    const content =
        document.getElementById(
            'adminReportContent'
        );

    const results =
        document.getElementById(
            'adminReportResults'
        );

    const filters =
        document.getElementById(
            'adminReportFilters'
        );

    const actions =
        document.getElementById(
            'adminReportExportActions'
        );


    if (content) {
        content.classList.add('hidden');
    }


    if (results) {

        results.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-chart-column"></i>
                <h3>Centro de información académica</h3>
                <p>
                    Selecciona una categoría para generar
                    un reporte detallado.
                </p>
            </div>
        `;

    }


    if (filters) {
        filters.innerHTML = '';
    }


    if (actions) {
        actions.classList.add('hidden');
    }

}


/* ----------------------------------------------------------------------
   SELECCIONAR REPORTE
---------------------------------------------------------------------- */

async function loadAdminReport(type) {

    APP.admin.currentReport = type;


    const content =
        document.getElementById(
            'adminReportContent'
        );

    const title =
        document.getElementById(
            'adminReportTitle'
        );

    const subtitle =
        document.getElementById(
            'adminReportSubtitle'
        );

    const results =
        document.getElementById(
            'adminReportResults'
        );

    const filters =
        document.getElementById(
            'adminReportFilters'
        );


    if (content) {
        content.classList.remove('hidden');
    }


    if (results) {

        results.innerHTML = `
            <div class="loading-inline">
                <i class="fa-solid fa-spinner"></i>
                Cargando reporte...
            </div>
        `;

    }


    /*
     * Reporte de estudiantes.
     */
    if (type === 'estudiantes') {

        if (title) {
            title.innerHTML =
                '<i class="fa-solid fa-user-graduate"></i> ' +
                'Reporte de estudiantes';
        }

        if (subtitle) {
            subtitle.textContent =
                'Listado general de estudiantes registrados ' +
                'en la institución.';
        }

        buildFilters(type);
        refreshReport(type);

        return;
    }


    /*
     * Reporte de módulos.
     */
    if (type === 'modulos') {

        if (title) {
            title.innerHTML =
                '<i class="fa-solid fa-book-open"></i> ' +
                'Reporte de módulos';
        }

        if (subtitle) {
            subtitle.textContent =
                'Consulta los módulos, sus programas y docentes responsables.';
        }

        buildFilters(type);
        refreshReport(type);

        return;
    }


    /*
     * Reporte de calificaciones.
     */
    if (type === 'calificaciones') {

        if (title) {
            title.innerHTML =
                '<i class="fa-solid fa-graduation-cap"></i> ' +
                'Reporte de calificaciones';
        }

        if (subtitle) {
            subtitle.textContent =
                'Resultados obtenidos por los estudiantes ' +
                'en las evaluaciones.';
        }

        buildFilters(type);
        refreshReport(type);

    }

}


/* ----------------------------------------------------------------------
   CONSTRUCCIÓN DE FILTROS
---------------------------------------------------------------------- */

function buildFilters(type) {

    const container =
        document.getElementById('adminReportFilters');

    if (!container) {
        return;
    }


    let html = '<div class="filters-row">';


    if (type === 'estudiantes') {

        html += `
            <div class="filter-group">
                <label for="filterEstPrograma">Programa</label>
                <select id="filterEstPrograma" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filterEstEstado">Estado</label>
                <select id="filterEstEstado" class="form-control">
                    <option value="">Todos</option>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                </select>
            </div>
        `;

    } else if (type === 'modulos') {

        html += `
            <div class="filter-group">
                <label for="filterModPrograma">Programa</label>
                <select id="filterModPrograma" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filterModDocente">Docente</label>
                <select id="filterModDocente" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filterModEstado">Estado</label>
                <select id="filterModEstado" class="form-control">
                    <option value="">Todos</option>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                </select>
            </div>
        `;

    } else if (type === 'calificaciones') {

        html += `
            <div class="filter-group">
                <label for="filterCalModulo">Módulo</label>
                <select id="filterCalModulo" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filterCalEstudiante">Estudiante (nombre o email)</label>
                <input type="text" id="filterCalEstudiante" class="form-control" placeholder="Buscar...">
            </div>
            <div class="filter-group">
                <label for="filterCalFechaDesde">Desde</label>
                <input type="date" id="filterCalFechaDesde" class="form-control">
            </div>
            <div class="filter-group">
                <label for="filterCalFechaHasta">Hasta</label>
                <input type="date" id="filterCalFechaHasta" class="form-control">
            </div>
        `;

    }


    html += '</div>';
    container.innerHTML = html;


    // Cargar opciones dinámicas para selects
    loadFilterOptions(type);


    // Asignar eventos para refrescar automáticamente
    const inputs = container.querySelectorAll('select, input');

    inputs.forEach(el => {

        const eventType =
            (el.type === 'text' || el.type === 'date')
                ? 'input'
                : 'change';

        el.addEventListener(
            eventType,
            debounce(() => refreshReport(type), 400)
        );

    });

}


/* ----------------------------------------------------------------------
   CARGAR OPCIONES DE FILTROS (programas, docentes, módulos)
---------------------------------------------------------------------- */

async function loadFilterOptions(type) {

    if (type === 'estudiantes' || type === 'modulos') {

        const { data: programas } = await db
            .from('programas')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        const selectors =
            type === 'estudiantes'
                ? ['filterEstPrograma']
                : ['filterModPrograma'];

        selectors.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML =
                    '<option value="">Todos</option>' +
                    (programas || []).map(p =>
                        `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`
                    ).join('');
            }
        });

    }


    if (type === 'modulos') {

        const { data: docentes } = await db
            .from('usuarios')
            .select('id, nombres, apellidos')
            .eq('rol', 'docente');

        const selDoc = document.getElementById('filterModDocente');

        if (selDoc) {
            selDoc.innerHTML =
                '<option value="">Todos</option>' +
                (docentes || []).map(d =>
                    `<option value="${d.id}">${escapeHTML(d.nombres + ' ' + d.apellidos)}</option>`
                ).join('');
        }

    }


    if (type === 'calificaciones') {

        const { data: modulos } = await db
            .from('modulos')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        const selMod = document.getElementById('filterCalModulo');

        if (selMod) {
            selMod.innerHTML =
                '<option value="">Todos</option>' +
                (modulos || []).map(m =>
                    `<option value="${m.id}">${escapeHTML(m.nombre)}</option>`
                ).join('');
        }

    }

}


/* ----------------------------------------------------------------------
   OBTENER FILTROS ACTUALES
---------------------------------------------------------------------- */

function getFilters(type) {

    const filters = {};

    if (type === 'estudiantes') {

        filters.programa =
            document.getElementById('filterEstPrograma')?.value || '';

        filters.estado =
            document.getElementById('filterEstEstado')?.value || '';

    } else if (type === 'modulos') {

        filters.programa =
            document.getElementById('filterModPrograma')?.value || '';

        filters.docente =
            document.getElementById('filterModDocente')?.value || '';

        filters.estado =
            document.getElementById('filterModEstado')?.value || '';

    } else if (type === 'calificaciones') {

        filters.modulo =
            document.getElementById('filterCalModulo')?.value || '';

        filters.estudiante =
            document.getElementById('filterCalEstudiante')?.value || '';

        filters.fechaDesde =
            document.getElementById('filterCalFechaDesde')?.value || '';

        filters.fechaHasta =
            document.getElementById('filterCalFechaHasta')?.value || '';

    }

    return filters;

}


/* ----------------------------------------------------------------------
   REFRESCAR REPORTE CON FILTROS
---------------------------------------------------------------------- */

function refreshReport(type) {

    const filters = getFilters(type);

    if (type === 'estudiantes') {
        loadStudentsReport(filters);
    } else if (type === 'modulos') {
        loadModulesReport(filters);
    } else if (type === 'calificaciones') {
        loadGradesReport(filters);
    }

}


/* ======================================================================
   REPORTE DE ESTUDIANTES (con filtros)
====================================================================== */

async function loadStudentsReport(filters = {}) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    try {

        let query = db
            .from('usuarios')
            .select(
                'id, nombres, apellidos, email, activo, programa_id, created_at'
            )
            .eq('rol', 'estudiante');


        if (filters.programa) {
            query = query.eq('programa_id', filters.programa);
        }


        if (filters.estado !== '') {
            query = query.eq('activo', filters.estado === 'true');
        }


        const {
            data: students,
            error: studentsError,
        } = await query.order(
            'created_at',
            {
                ascending: false,
            }
        );


        if (studentsError) {
            throw studentsError;
        }


        /*
         * Obtener los programas para mostrar sus nombres.
         */
        const {
            data: programs,
            error: programsError,
        } = await db
            .from('programas')
            .select(
                'id, nombre'
            );


        if (programsError) {
            throw programsError;
        }


        const programsById = {};

        (programs || []).forEach(program => {
            programsById[program.id] =
                program.nombre;
        });


        renderStudentsReport(
            students || [],
            programsById
        );


    } catch (error) {

        console.error(
            'Error al generar reporte de estudiantes:',
            error
        );

        results.innerHTML = '';

        showToast(
            friendlyError(error),
            'error'
        );

    }

}


function renderStudentsReport(
    students,
    programsById
) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    if (!results) {
        return;
    }


    setReportExportData(
        'reporte_estudiantes',
        students.map(student => ({
            'Nombres': student.nombres || '',
            'Apellidos': student.apellidos || '',
            'Email': student.email || '',
            'Programa':
                programsById[student.programa_id] ||
                'Sin programa asignado',
            'Estado': student.activo ? 'Activo' : 'Inactivo',
        }))
    );


    if (!students.length) {

        results.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-graduate"></i>
                <h3>No hay estudiantes registrados</h3>
                <p>
                    Los estudiantes registrados aparecerán
                    en este reporte.
                </p>
            </div>
        `;

        return;
    }


    results.innerHTML = `

        <div class="report-summary">
            <strong>
                ${students.length}
            </strong>
            estudiante(s) encontrado(s)
        </div>

        <div class="students-list">

            ${students.map(student => {

                const programName =
                    programsById[
                        student.programa_id
                    ] || 'Sin programa asignado';


                return `

                    <div class="student-item">

                        <div>

                            <div class="s-name">

                                ${escapeHTML(
                                    student.nombres || ''
                                )}

                                ${escapeHTML(
                                    student.apellidos || ''
                                )}

                                ${
                                    student.activo
                                        ? ''
                                        : '<span class="status-inactive">' +
                                          'Inactivo' +
                                          '</span>'
                                }

                            </div>


                            <div class="s-email">

                                <i class="fa-solid fa-envelope"></i>

                                ${escapeHTML(
                                    student.email || ''
                                )}

                                <br>

                                <i class="fa-solid fa-book"></i>

                                ${escapeHTML(
                                    programName
                                )}

                            </div>

                        </div>


                        <i
                            class="fa-solid fa-user-graduate"
                        ></i>

                    </div>

                `;

            }).join('')}

        </div>

    `;

}


/* ======================================================================
   REPORTE DE MÓDULOS (con filtros)
====================================================================== */

async function loadModulesReport(filters = {}) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    try {

        let query = db
            .from('modulos')
            .select(
                'id, nombre, descripcion, programa_id, docente_id, activo, created_at'
            );


        if (filters.programa) {
            query = query.eq('programa_id', filters.programa);
        }


        if (filters.docente) {
            query = query.eq('docente_id', filters.docente);
        }


        if (filters.estado !== '') {
            query = query.eq('activo', filters.estado === 'true');
        }


        const {
            data: modules,
            error: modulesError,
        } = await query.order(
            'created_at',
            {
                ascending: false,
            }
        );


        if (modulesError) {
            throw modulesError;
        }


        /*
         * Obtener programas.
         */
        const {
            data: programs,
            error: programsError,
        } = await db
            .from('programas')
            .select(
                'id, nombre'
            );


        if (programsError) {
            throw programsError;
        }


        /*
         * Obtener docentes.
         */
        const {
            data: teachers,
            error: teachersError,
        } = await db
            .from('usuarios')
            .select(
                'id, nombres, apellidos'
            )
            .eq(
                'rol',
                'docente'
            );


        if (teachersError) {
            throw teachersError;
        }


        const programsById = {};
        const teachersById = {};


        (programs || []).forEach(program => {

            programsById[program.id] =
                program.nombre;

        });


        (teachers || []).forEach(teacher => {

            teachersById[teacher.id] =
                `${teacher.nombres || ''} ${teacher.apellidos || ''}`.trim();

        });


        renderModulesReport(
            modules || [],
            programsById,
            teachersById
        );


    } catch (error) {

        console.error(
            'Error al generar reporte de módulos:',
            error
        );

        results.innerHTML = '';

        showToast(
            friendlyError(error),
            'error'
        );

    }

}


function renderModulesReport(
    modules,
    programsById,
    teachersById
) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    if (!results) {
        return;
    }


    setReportExportData(
        'reporte_modulos',
        modules.map(module => ({
            'Modulo': module.nombre || '',
            'Programa':
                programsById[module.programa_id] || 'Sin programa',
            'Docente':
                teachersById[module.docente_id] ||
                'Sin docente asignado',
            'Descripcion': module.descripcion || '',
            'Estado': module.activo === false ? 'Inactivo' : 'Activo',
        }))
    );


    if (!modules.length) {

        results.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-book-open"></i>
                <h3>No hay módulos registrados</h3>
                <p>
                    Los módulos creados por los docentes
                    aparecerán aquí.
                </p>
            </div>
        `;

        return;
    }


    results.innerHTML = `

        <div class="report-summary">
            <strong>
                ${modules.length}
            </strong>
            módulo(s) encontrado(s)
        </div>

        <div class="students-list">

            ${modules.map(module => {

                const programName =
                    programsById[
                        module.programa_id
                    ] || 'Sin programa';


                const teacherName =
                    teachersById[
                        module.docente_id
                    ] || 'Sin docente asignado';


                return `

                    <div class="student-item">

                        <div>

                            <div class="s-name">

                                ${escapeHTML(
                                    module.nombre || ''
                                )}

                                ${
                                    module.activo === false
                                        ? '<span class="status-inactive">' +
                                          'Inactivo' +
                                          '</span>'
                                        : ''
                                }

                            </div>


                            <div class="s-email">

                                <i class="fa-solid fa-book"></i>

                                ${escapeHTML(
                                    programName
                                )}

                                <br>

                                <i class="fa-solid fa-chalkboard-user"></i>

                                ${escapeHTML(
                                    teacherName
                                )}

                                ${
                                    module.descripcion
                                        ? `<br>
                                            <i class="fa-solid fa-circle-info"></i>
                                            ${escapeHTML(
                                                module.descripcion
                                            )}`
                                        : ''
                                }

                            </div>

                        </div>


                        <i
                            class="fa-solid fa-book-open"
                        ></i>

                    </div>

                `;

            }).join('')}

        </div>

    `;

}


/* ======================================================================
   REPORTE DE CALIFICACIONES (con filtros)
====================================================================== */

async function loadGradesReport(filters = {}) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    try {

        let query = db
            .from('resultados')
            .select(
                'id, modulo_id, estudiante_id, calificacion, respuestas_correctas, total_preguntas, created_at'
            );


        if (filters.modulo) {
            query = query.eq('modulo_id', filters.modulo);
        }


        if (filters.fechaDesde) {
            query = query.gte('created_at', filters.fechaDesde);
        }


        if (filters.fechaHasta) {
            query = query.lte('created_at', filters.fechaHasta + ' 23:59:59');
        }


        const {
            data: grades,
            error: gradesError,
        } = await query.order(
            'created_at',
            {
                ascending: false,
            }
        );


        if (gradesError) {
            throw gradesError;
        }


        /*
         * Aplicar filtro de estudiante por nombre/email (post-query)
         * porque no podemos hacer join directamente con like en otra tabla.
         * Si hay muchos datos, esto podría optimizarse con una consulta SQL.
         */
        let filteredGrades = grades || [];


        if (filters.estudiante && filteredGrades.length) {

            const studentIds =
                filteredGrades.map(g => g.estudiante_id).filter(Boolean);

            const uniqueStudentIds = [...new Set(studentIds)];

            if (uniqueStudentIds.length) {

                const { data: students } = await db
                    .from('usuarios')
                    .select('id, nombres, apellidos, email')
                    .in('id', uniqueStudentIds);

                const studentsMap = {};

                (students || []).forEach(s => {
                    studentsMap[s.id] = s;
                });

                const searchTerm =
                    filters.estudiante.toLowerCase().trim();

                filteredGrades = filteredGrades.filter(grade => {

                    const student =
                        studentsMap[grade.estudiante_id];

                    if (!student) {
                        return false;
                    }

                    const fullName =
                        `${student.nombres || ''} ${student.apellidos || ''}`.toLowerCase();

                    const email =
                        (student.email || '').toLowerCase();

                    return (
                        fullName.includes(searchTerm) ||
                        email.includes(searchTerm)
                    );

                });

            }

        }


        if (!filteredGrades.length) {

            renderGradesReport(
                [],
                {},
                {}
            );

            return;
        }


        /*
         * Obtener estudiantes y módulos para los resultados filtrados.
         */
        const studentIds = [
            ...new Set(
                filteredGrades
                    .map(grade =>
                        grade.estudiante_id
                    )
                    .filter(Boolean)
            ),
        ];


        const moduleIds = [
            ...new Set(
                filteredGrades
                    .map(grade =>
                        grade.modulo_id
                    )
                    .filter(Boolean)
            ),
        ];


        let students = [];
        let modules = [];


        if (studentIds.length) {

            const {
                data,
                error,
            } = await db
                .from('usuarios')
                .select(
                    'id, nombres, apellidos'
                )
                .in(
                    'id',
                    studentIds
                );


            if (!error) {
                students = data || [];
            }

        }


        if (moduleIds.length) {

            const {
                data,
                error,
            } = await db
                .from('modulos')
                .select(
                    'id, nombre'
                )
                .in(
                    'id',
                    moduleIds
                );


            if (!error) {
                modules = data || [];
            }

        }


        const studentsById = {};
        const modulesById = {};


        students.forEach(student => {

            studentsById[student.id] =
                `${student.nombres || ''} ${student.apellidos || ''}`.trim();

        });


        modules.forEach(module => {

            modulesById[module.id] =
                module.nombre;

        });


        renderGradesReport(
            filteredGrades,
            studentsById,
            modulesById
        );


    } catch (error) {

        console.error(
            'Error al generar reporte de calificaciones:',
            error
        );

        results.innerHTML = '';

        showToast(
            friendlyError(error),
            'error'
        );

    }

}


function renderGradesReport(
    grades,
    studentsById,
    modulesById
) {

    const results =
        document.getElementById(
            'adminReportResults'
        );


    if (!results) {
        return;
    }


    setReportExportData(
        'reporte_calificaciones',
        grades.map(grade => ({
            'Estudiante':
                studentsById[grade.estudiante_id] ||
                'Estudiante no disponible',
            'Modulo':
                modulesById[grade.modulo_id] ||
                'Modulo no disponible',
            'Calificacion': Number(grade.calificacion || 0).toFixed(2),
            'Correctas': grade.respuestas_correctas ?? '',
            'Total preguntas': grade.total_preguntas ?? '',
            'Fecha': grade.created_at || '',
        }))
    );


    if (!grades.length) {

        results.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-graduation-cap"></i>
                <h3>Aún no hay calificaciones</h3>
                <p>
                    Los resultados aparecerán cuando los
                    estudiantes realicen sus evaluaciones.
                </p>
            </div>
        `;

        return;
    }


    results.innerHTML = `

        <div class="report-summary">
            <strong>
                ${grades.length}
            </strong>
            resultado(s) encontrado(s)
        </div>

        <div class="results-list">

            ${grades.map(grade => {

                const studentName =
                    studentsById[
                        grade.estudiante_id
                    ] || 'Estudiante no disponible';


                const moduleName =
                    modulesById[
                        grade.modulo_id
                    ] || 'Módulo no disponible';


                const score =
                    Number(
                        grade.calificacion || 0
                    );


                const scoreClassName =
                    typeof scoreClass === 'function'
                        ? scoreClass(score)
                        : '';


                return `

                    <div class="result-item">

                        <div class="r-main">

                            <strong>

                                ${escapeHTML(
                                    studentName
                                )}

                            </strong>


                            <span class="r-meta">

                                <i class="fa-solid fa-book"></i>

                                ${escapeHTML(
                                    moduleName
                                )}

                                <br>

                                ${grade.respuestas_correctas || 0}
                                /
                                ${grade.total_preguntas || 0}
                                respuestas correctas

                                ${
                                    grade.created_at
                                        ? ` · ${formatAdminDate(
                                            grade.created_at
                                        )}`
                                        : ''
                                }

                            </span>

                        </div>


                        <span
                            class="result-score ${scoreClassName}"
                        >

                            ${score.toFixed(1)}

                        </span>

                    </div>

                `;

            }).join('')}

        </div>

    `;

}


/* ======================================================================
   EXPORTACIÓN DE REPORTES (Excel / PDF) - con datos filtrados
====================================================================== */

function setReportExportData(name, rows) {

    APP.admin.reportExport = {
        name: name,
        rows: rows || [],
    };


    const actions =
        document.getElementById('adminReportExportActions');

    if (actions) {

        actions.classList.toggle(
            'hidden',
            !(rows && rows.length)
        );

    }

}


function exportReportToExcel() {

    const data = APP.admin.reportExport;


    if (!data || !data.rows.length) {

        showToast(
            'Genera un reporte antes de exportarlo.',
            'error'
        );

        return;
    }


    const headers = Object.keys(data.rows[0]);


    const escapeCell = value => {

        const text = String(value ?? '').replace(/"/g, '""');

        return `"${text}"`;

    };


    const csv = [
        headers.map(escapeCell).join(';'),
        ...data.rows.map(row =>
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
    link.download = `${data.name}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}


function exportReportToPDF() {

    const data = APP.admin.reportExport;


    if (!data || !data.rows.length) {

        showToast(
            'Genera un reporte antes de exportarlo.',
            'error'
        );

        return;
    }


    const titleElement =
        document.getElementById('adminReportTitle');

    const title =
        (titleElement && titleElement.textContent.trim()) ||
        'Reporte';


    const headers = Object.keys(data.rows[0]);


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
                    ${data.rows.length} registro(s)
                </p>
                <table>
                    <thead>
                        <tr>
                            ${headers
                                .map(header =>
                                    `<th>${escapeHTML(header)}</th>`
                                )
                                .join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows
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


/* ----------------------------------------------------------------------
   FORMATO DE FECHA PARA REPORTES
---------------------------------------------------------------------- */

function formatAdminDate(value) {

    if (!value) {
        return '';
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }


    return date.toLocaleDateString(
        'es-CO',
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }
    );

}


/* ----------------------------------------------------------------------
   UTILITY: DEBOUNCE
---------------------------------------------------------------------- */

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}


/* ======================================================================
   INICIALIZACIÓN DEL MÓDULO ADMINISTRATIVO
====================================================================== */

function initAdminModule() {

    /* ============================================================
       NAVEGACIÓN ADMINISTRATIVA
    ============================================================ */

    const moduleAliases = {
        dashboard: 'dashboard',
        inicio: 'dashboard',
        home: 'dashboard',
        docentes: 'docentes',
        docente: 'docentes',
        estudiantes: 'estudiantes',
        estudiante: 'estudiantes',
        programas: 'programas',
        programa: 'programas',
        reportes: 'reportes',
        reporte: 'reportes',
    };

    function resolveAdminModule(button) {

        const raw = String(
            button.dataset.adminModule ||
            button.dataset.module ||
            button.getAttribute('data-target') ||
            button.id ||
            button.textContent ||
            ''
        ).trim().toLowerCase();

        if (moduleAliases[raw]) {
            return moduleAliases[raw];
        }

        if (raw.includes('dashboard') || raw.includes('inicio')) {
            return 'dashboard';
        }

        if (raw.includes('docent')) {
            return 'docentes';
        }

        if (raw.includes('estudiant')) {
            return 'estudiantes';
        }

        if (raw.includes('program')) {
            return 'programas';
        }

        if (raw.includes('report')) {
            return 'reportes';
        }

        return null;
    }

    document
        .querySelectorAll(
            '[data-admin-module], [data-module], [data-target], .admin-module-card, .admin-module-btn, #btnAdminDashboard, #btnAdminDocentes, #btnAdminEstudiantes, #btnAdminProgramas, #btnAdminReportes'
        )
        .forEach(button => {

            if (button.dataset.adminModuleBound === 'true') {
                return;
            }

            const moduleName = resolveAdminModule(button);

            if (!moduleName) {
                return;
            }

            button.dataset.adminModuleBound = 'true';

            button.addEventListener(
                'click',
                event => {
                    event.preventDefault();
                    showAdminModule(moduleName);
                }
            );

        });


    /* ============================================================
       BOTONES PARA VOLVER AL DASHBOARD
    ============================================================ */

    document
        .querySelectorAll('.admin-back, [data-admin-back]')
        .forEach(button => {

            if (button.dataset.adminBackBound === 'true') {
                return;
            }

            button.dataset.adminBackBound = 'true';

            button.addEventListener(
                'click',
                event => {
                    event.preventDefault();
                    showAdminModule('dashboard');
                }
            );

        });


    /* ============================================================
       BOTONES DE REPORTES
    ============================================================ */

    document
        .querySelectorAll('[data-report]')
        .forEach(button => {

            if (button.dataset.reportBound === 'true') {
                return;
            }

            button.dataset.reportBound = 'true';

            button.addEventListener(
                'click',
                () => loadAdminReport(
                    button.dataset.report
                )
            );

        });


    /* ============================================================
       BOTONES DE EXPORTACIÓN
    ============================================================ */

    [
        ['btnExportExcel', exportReportToExcel],
        ['btnExportPDF', exportReportToPDF],
    ].forEach(([id, handler]) => {

        const button = document.getElementById(id);

        if (!button || button.dataset.exportBound === 'true') {
            return;
        }

        button.dataset.exportBound = 'true';
        button.addEventListener('click', handler);

    });


    /* ============================================================
       FORMULARIOS ADMINISTRATIVOS
    ============================================================ */

    const docenteForm =
        document.getElementById('adminCreateDocenteForm');

    if (
        docenteForm &&
        docenteForm.dataset.adminBound !== 'true'
    ) {
        docenteForm.dataset.adminBound = 'true';

        docenteForm.addEventListener(
            'submit',
            event => createAdminUser(event, 'docente')
        );
    }


    const estudianteForm =
        document.getElementById('adminCreateEstudianteForm');

    if (
        estudianteForm &&
        estudianteForm.dataset.adminBound !== 'true'
    ) {
        estudianteForm.dataset.adminBound = 'true';

        estudianteForm.addEventListener(
            'submit',
            event => createAdminUser(event, 'estudiante')
        );
    }


    const programaForm =
        document.getElementById('adminCreateProgramaForm');

    if (
        programaForm &&
        programaForm.dataset.adminBound !== 'true'
    ) {
        programaForm.dataset.adminBound = 'true';

        programaForm.addEventListener(
            'submit',
            handleCreatePrograma
        );
    }


    console.log(
        'Módulo de administrador inicializado correctamente.'
    );
}