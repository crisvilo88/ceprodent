# CEPRODENT · Sistema de Evaluación Institucional

Aplicación web para gestionar evaluaciones académicas de opción múltiple:
docentes administran programas, módulos y bancos de preguntas; estudiantes
presentan exámenes de 12 preguntas aleatorias (de un pool de 20) y reciben
su calificación al instante.

**Stack:** HTML5 + CSS3 + JavaScript puro (sin frameworks ni build step) y
Supabase (PostgreSQL + Auth + Realtime) como backend. Lista para desplegar
en GitHub Pages.

---

## 1. Estructura del proyecto

```
ceprodent-evaluacion/
├── index.html              # Marcado de todas las vistas (login, dashboards, examen, resultado)
├── css/
│   └── styles.css          # Sistema de diseño (azul/blanco, degradados, responsivo)
├── js/
│   ├── supabaseClient.js   # Conexión a Supabase (⚠️ aquí van tus credenciales)
│   ├── ui.js                # Vistas, toasts, tabs, modal, helpers
│   ├── auth.js              # Login / logout / sesión / enrutamiento por rol
│   ├── teacher.js           # Panel docente: módulos, preguntas, estudiantes, activación
│   ├── quiz.js               # Motor del examen (preguntas, temporizador, envío)
│   ├── student.js            # Panel estudiante: dashboard y tiempo real
│   └── app.js                 # Arranque de la aplicación
└── sql/
    └── schema.sql            # Tablas, RLS, triggers y funciones RPC de Supabase
```

---

## 2. Cómo funciona el modelo de datos (resumen)

| Tabla                  | Qué guarda                                                            |
|-------------------------|------------------------------------------------------------------------|
| `usuarios`              | Perfil institucional (nombre, apellido, rol) enlazado a Supabase Auth |
| `programas`              | Programas académicos (ej. "Técnico en Sistemas")                     |
| `modulos`                | Módulos de un programa, con UN docente responsable                   |
| `inscripciones`          | Qué estudiantes están asignados a cada módulo                        |
| `banco_preguntas`         | Hasta 20 preguntas de opción múltiple por módulo                     |
| `evaluaciones_activas`    | Si la evaluación de un módulo está habilitada ahora mismo             |
| `resultados`              | Calificaciones obtenidas por cada estudiante                          |

**Seguridad clave:** el banco de preguntas nunca se envía completo al
estudiante, y la calificación nunca la calcula el navegador. Todo pasa por
dos funciones de Supabase (RPC) que corren en el servidor:

- `obtener_preguntas_examen(modulo_id)` → entrega 12 preguntas al azar
  **sin** la respuesta correcta.
- `calificar_examen(modulo_id, respuestas)` → compara las respuestas contra
  la base de datos, calcula la nota y la guarda. El estudiante no puede
  insertar su propia calificación directamente (no tiene permiso RLS para
  ello).

---

## 3. Configurar Supabase (paso a paso)

### 3.1. Crear el proyecto
1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre, contraseña de base de datos y región. Espera a que se aprovisione (1-2 min).

### 3.2. Ejecutar el esquema SQL
1. En el panel izquierdo, entra a **SQL Editor** → **New query**.
2. Abre el archivo `sql/schema.sql` de este proyecto, copia **todo** su contenido y pégalo.
3. Presiona **Run**. Esto crea las 7 tablas, los índices, los triggers, las
   políticas de seguridad (RLS) y las funciones RPC.

> Si en el paso de Realtime (`alter publication supabase_realtime add table ...`)
> aparece un error de "ya existe", puedes ignorarlo tranquilamente.

### 3.3. Obtener tus credenciales
1. Ve a **Project Settings** (ícono de engranaje) → **API**.
2. Copia el **Project URL** y la llave **anon public**.
3. Abre `js/supabaseClient.js` en este proyecto y reemplaza:

```js
const SUPABASE_URL = 'https://ewlxluyyxtmeuzpyjkag.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l69o_3QAcMb1z9H0T4gFzA_rpRSGt2-';
```

con tus valores reales.

### 3.4. Crear las cuentas de docentes y estudiantes

Este sistema **no tiene registro público** (por seguridad institucional:
nadie debe poder auto-asignarse el rol "docente"). Cada cuenta la crea la
institución así:

1. En Supabase, ve a **Authentication → Users → Add user**. Ingresa el
   correo y una contraseña temporal para la persona (docente o estudiante).
   Guarda/copia el **UUID** que se le asigna.
2. Ve a **SQL Editor** y ejecuta un INSERT como este (ajusta los datos):

```sql
-- Para un docente
insert into public.usuarios (id, nombres, apellidos, email, rol)
values ('e98aec34-2b3c-4708-ac3c-d8cf34911d23', 'CRISTIAN', 'VILORIA', 'cristian.viloria@ceprodent.edu.co', 'docente');

-- Para un estudiante
insert into public.usuarios (id, nombres, apellidos, email, rol)
values ('ffd2995b-2be6-497c-a988-dd7e84612d6d', 'Ana', 'Gómez', 'ana.gomez@ceprodent.edu.co', 'estudiante');
```

3. Repite para cada persona. (Si prefieres automatizarlo para muchos
   usuarios, se puede hacer con la Admin API de Supabase o un script,
   pero para el alcance de este proyecto el proceso manual es suficiente).

### 3.5. Habilitar Realtime (activación en vivo del examen)

El script SQL ya incluye `alter publication supabase_realtime add table public.evaluaciones_activas;`,
que basta en la mayoría de proyectos. Si el switch de "Evaluación activa"
del docente no se refleja en vivo en el panel del estudiante, revisa:
**Database → Replication** → asegúrate de que la tabla `evaluaciones_activas`
esté marcada para la publicación `supabase_realtime`.

---

## 4. Probar localmente

Como el proyecto es HTML/CSS/JS puro, basta con servirlo con cualquier
servidor estático (abrir `index.html` directo con doble clic también
funciona en la mayoría de navegadores, aunque un servidor local es más
confiable):

```bash
# Opción con Python
python3 -m http.server 8080

# Opción con Node
npx serve .
```

Luego abre `http://localhost:8080`.

**Flujo de prueba sugerido:**
1. Inicia sesión con la cuenta de docente.
2. Crea un programa y un módulo ("Nuevo módulo").
3. Agrega al menos 12 preguntas en la pestaña "Banco de preguntas".
4. En la pestaña "Estudiantes", inscribe al estudiante por su correo.
5. Activa el switch "Evaluación" (arriba a la derecha del módulo).
6. Cierra sesión e inicia con la cuenta del estudiante: el módulo debe
   aparecer como "Evaluación activa" y permitir presentarla.
7. Al finalizar, la nota se guarda y aparece tanto en el historial del
   estudiante como en la pestaña "Resultados" del docente.

---

## 5. Desplegar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube el contenido de esta carpeta
   (con tus credenciales de Supabase ya puestas en `js/supabaseClient.js`):

```bash
git init
git add .
git commit -m "CEPRODENT - Sistema de Evaluación"
git branch -M main
git remote add origin https://github.com/crisvilo/ceprodent_evaluacion.git
git push -u origin main
```

2. En GitHub, ve a **Settings → Pages**.
3. En "Build and deployment" → **Source**, elige **Deploy from a branch**.
4. En "Branch", selecciona `main` y la carpeta `/ (root)`. Guarda.
5. Espera 1-2 minutos; GitHub te dará la URL pública (algo como
   `https://tu-usuario.github.io/tu-repositorio/`).

### 5.1. Autorizar el dominio en Supabase
Por defecto Supabase Auth no restringe el origen para `signInWithPassword`,
pero si más adelante activas magic links o redirecciones OAuth, agrega la
URL de GitHub Pages en **Authentication → URL Configuration → Redirect URLs**.

---

## 6. Preguntas frecuentes / notas de diseño

- **¿Por qué el estudiante no puede volver a presentar el examen?**
  Una vez existe una calificación (`resultados`) para ese estudiante y
  módulo, el botón se deshabilita y muestra la nota obtenida. Si el
  docente quiere permitir un segundo intento, puede borrar esa fila desde
  el **Table Editor** de Supabase (tabla `resultados`).

- **¿Cómo cambio el tiempo del examen (15 minutos por defecto)?**
  Edita la constante `QUIZ_DURATION_SECONDS` al inicio de `js/quiz.js`.

- **¿Puedo permitir más/menos de 20 preguntas por módulo?**
  El límite de 20 está reforzado por un trigger en la base de datos
  (`fn_check_max_preguntas`, en `sql/schema.sql`). Puedes ajustar el
  número `20` ahí si lo necesitas.

- **¿Es seguro exponer la "anon key" de Supabase en el frontend?**
  Sí: esa llave es pública por diseño. La seguridad real la dan las
  políticas RLS (quién puede leer/escribir cada fila) y las funciones RPC
  con `SECURITY DEFINER`, no el secreto de la llave.
