/**
 * app.js
 * ----------------------------------------------------------------------
 * Punto de entrada de la aplicación. Conecta los formularios/botones
 * estáticos del HTML con sus manejadores y arranca la sesión.
 * ----------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);

    initTeacherModule();
    initQuizModule();
    initStudentModule();
    initAdminModule();

    initAuth();
});
