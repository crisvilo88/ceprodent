/**
 * auth.js
 * ----------------------------------------------------------------------
 * Maneja el inicio de sesión, cierre de sesión y restauración de sesión.
 *
 * Roles:
 * - administrador
 * - docente
 * - estudiante
 * ----------------------------------------------------------------------
 */

const APP = {
    user: null,
    profile: null
};


/** Se ejecuta al cargar la página e intenta restaurar la sesión activa. */
async function initAuth() {
    const { data: { session } } = await db.auth.getSession();

    if (session?.user) {
        await handleSessionActive(session.user);
    } else {
        showAuthScreen();
    }

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            APP.user = null;
            APP.profile = null;
            showAuthScreen();
        }
    });
}


const btnShowRegister =
    document.getElementById('btnShowRegister');

const btnBackToLogin =
    document.getElementById('btnBackToLogin');

const registerForm =
    document.getElementById('registerForm');

if (btnShowRegister) {
    btnShowRegister.addEventListener(
        'click',
        showRegisterForm
    );
}

if (btnBackToLogin) {
    btnBackToLogin.addEventListener(
        'click',
        showLoginForm
    );
}

if (registerForm) {
    registerForm.addEventListener(
        'submit',
        handleRegister
    );
}


function showAuthScreen() {
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('userNav').classList.add('hidden');
    switchView('authView');
}


/** Carga el perfil institucional y dirige al usuario según su rol. */
async function handleSessionActive(user) {
    APP.user = user;

    const { data: profile, error } = await db
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error de Supabase al buscar perfil:', error);
        showToast(
            'Error al buscar perfil: ' + error.message,
            'error',
            8000
        );
        await db.auth.signOut();
        return;
    }

    if (!profile) {
        showToast(
            'No se encontró un perfil institucional para esta cuenta.',
            'error',
            6000
        );
        await db.auth.signOut();
        return;
    }

    if (!profile.activo) {
        showToast(
            'Esta cuenta institucional se encuentra inactiva.',
            'error',
            6000
        );
        await db.auth.signOut();
        return;
    }

    APP.profile = profile;

    // Mostrar información del usuario.
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('userNav').classList.remove('hidden');

    document.getElementById('userNameDisplay').textContent =
        `${profile.nombres} ${profile.apellidos}`;


    // ==================================================================
    // ADMINISTRADOR
    // ==================================================================

    if (profile.rol === 'administrador') {

        document.getElementById('userRoleBadge').textContent =
            'Administrador';

        // Si existe una vista específica para administrador, la usamos.
        const adminView = document.getElementById('adminView');

        if (adminView) {
            switchView('adminView');

            // Se ejecuta únicamente si la función existe.
            if (typeof loadAdminDashboard === 'function') {
                await loadAdminDashboard();
            }

        } else {
            // Temporalmente utiliza el panel docente hasta crear adminView.
            switchView('teacherView');

            if (typeof loadTeacherDashboard === 'function') {
                await loadTeacherDashboard();
            }
        }

        return;
    }


    // ==================================================================
    // DOCENTE
    // ==================================================================

    if (profile.rol === 'docente') {

        document.getElementById('userRoleBadge').textContent =
            'Docente';

        switchView('teacherView');

        if (typeof loadTeacherDashboard === 'function') {
            await loadTeacherDashboard();
        }

        return;
    }


    // ==================================================================
    // ESTUDIANTE
    // ==================================================================

    if (profile.rol === 'estudiante') {

        document.getElementById('userRoleBadge').textContent =
            'Estudiante';

        switchView('studentView');

        if (typeof loadStudentDashboard === 'function') {
            await loadStudentDashboard();
        }

        return;
    }


    // ==================================================================
    // ROL NO RECONOCIDO
    // ==================================================================

    console.error('Rol no reconocido:', profile.rol);

    showToast(
        'El rol asignado a esta cuenta no es válido.',
        'error',
        6000
    );

    await db.auth.signOut();
}


/** Procesa el formulario de inicio de sesión. */
async function handleLogin(event) {
    event.preventDefault();

    const btn = document.getElementById('btnLogin');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setButtonLoading(btn, true, 'Ingresando...');

    try {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await handleSessionActive(data.user);

        document.getElementById('loginForm').reset();

    } catch (error) {
        console.error('Error de inicio de sesión:', error);
        showToast(friendlyError(error), 'error');

    } finally {
        setButtonLoading(btn, false);
    }
}


/** Cierra la sesión actual. */
async function handleLogout() {
    await db.auth.signOut();
    showToast('Sesión cerrada.', 'info', 2500);
}


/* ============================== REGISTRO DE ESTUDIANTES ============================== */

/**
 * Muestra el formulario de registro y carga los programas disponibles.
 */
async function showRegisterForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');

    await loadRegisterPrograms();
}


/**
 * Regresa al formulario de inicio de sesión.
 */
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');

    registerForm.reset();
}


/**
 * Carga los programas académicos para el registro del estudiante.
 */
async function loadRegisterPrograms() {
    const select = document.getElementById('registerPrograma');

    if (!select) return;

    select.innerHTML = `
        <option value="">
            Cargando programas...
        </option>
    `;

    try {
        const { data, error } = await db
            .from('programas')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;

        select.innerHTML = `
            <option value="">
                — Selecciona tu programa —
            </option>
        `;

        (data || []).forEach(programa => {
            const option = document.createElement('option');

            option.value = programa.id;
            option.textContent = programa.nombre;

            select.appendChild(option);
        });

        if (!data || data.length === 0) {
            select.innerHTML = `
                <option value="">
                    No hay programas disponibles
                </option>
            `;
        }

    } catch (error) {
        console.error(
            'Error al cargar programas:',
            error
        );

        select.innerHTML = `
            <option value="">
                Error al cargar programas
            </option>
        `;

        showToast(
            'No fue posible cargar los programas académicos.',
            'error'
        );
    }
}


/**
 * Registra un nuevo estudiante.
 *
 * El rol siempre se envía como "estudiante".
 * El usuario nunca puede elegir ni modificar su propio rol.
 */
async function handleRegister(event) {
    event.preventDefault();

    const btn =
        document.getElementById('btnRegister');

    const nombres =
        document.getElementById('registerNombres')
            .value
            .trim();

    const apellidos =
        document.getElementById('registerApellidos')
            .value
            .trim();

    const programaId =
        document.getElementById('registerPrograma')
            .value;

    const email =
        document.getElementById('registerEmail')
            .value
            .trim()
            .toLowerCase();

    const password =
        document.getElementById('registerPassword')
            .value;

    const passwordConfirm =
        document.getElementById('registerPasswordConfirm')
            .value;

    if (!nombres || !apellidos || !programaId || !email || !password) {
        showToast(
            'Completa todos los campos del registro.',
            'error'
        );
        return;
    }

    if (password.length < 6) {
        showToast(
            'La contraseña debe tener al menos 6 caracteres.',
            'error'
        );
        return;
    }

    if (password !== passwordConfirm) {
        showToast(
            'Las contraseñas no coinciden.',
            'error'
        );
        return;
    }

    setButtonLoading(
        btn,
        true,
        'Creando cuenta...'
    );

    try {
        /*
         * Usamos una Edge Function específica para registro público.
         * El rol se establece en el servidor como "estudiante".
         */
        const { data, error } =
            await db.functions.invoke(
                'register-student',
                {
                    body: {
                        nombres,
                        apellidos,
                        email,
                        password,
                        programa_id: programaId
                    }
                }
            );

        if (error) {
            throw error;
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        showToast(
            '¡Cuenta creada correctamente! Ya puedes iniciar sesión.',
            'success',
            5000
        );

        showLoginForm();

        document.getElementById('email').value = email;

    } catch (error) {
        console.error(
            'Error al registrar estudiante:',
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