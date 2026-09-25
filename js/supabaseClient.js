/**
 * supabaseClient.js
 * ----------------------------------------------------------------------
 * Conexión con el proyecto Supabase NUEVO + reducción de lecturas repetidas.
 *
 * IMPORTANTE:
 * - En el frontend solo debe ir la clave Publishable/anon del proyecto.
 * - NUNCA colocar aquí una secret/service_role key.
 * - Reemplaza SUPABASE_PUBLISHABLE_KEY con la clave pública del nuevo
 *   proyecto: Supabase Dashboard > Settings > API.
 *
 * Optimización de consumo:
 * - Las lecturas REST GET repetidas se mantienen SOLO en memoria durante
 *   30 segundos.
 * - Se cachean únicamente solicitudes a /rest/v1/.
 * - Las escrituras (POST/PATCH/PUT/DELETE) invalidan el caché REST.
 * - RPC no se cachea automáticamente porque normalmente usa POST.
 * - El Service Worker tampoco cachea respuestas de Supabase.
 * ----------------------------------------------------------------------
 */

const SUPABASE_URL = 'https://rflwowetgtasqhzsztof.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HO-UUicauywPk5jsADzDdg_jlRm5Fup';

const SUPABASE_REST_CACHE_TTL = 30 * 1000;
const supabaseRestCache = new Map();

function getHeaderValue(headers, name) {
    if (!headers) return '';
    if (headers instanceof Headers) return headers.get(name) || '';
    return headers[name] || headers[name.toLowerCase()] || '';
}

function buildRestCacheKey(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const headers = init?.headers || (input instanceof Request ? input.headers : null);
    const authorization = getHeaderValue(headers, 'Authorization');
    const apikey = getHeaderValue(headers, 'apikey');

    return `${url}|${apikey}|${authorization}`;
}

async function optimizedFetch(input, init = {}) {
    const method = (
        init.method ||
        (input instanceof Request ? input.method : 'GET') ||
        'GET'
    ).toUpperCase();

    const rawUrl = typeof input === 'string' ? input : input?.url;

    if (!rawUrl) {
        return fetch(input, init);
    }

    let url;
    try {
        url = new URL(rawUrl, window.location.href);
    } catch {
        return fetch(input, init);
    }

    const isSupabaseRest =
        url.hostname === new URL(SUPABASE_URL).hostname &&
        url.pathname.startsWith('/rest/v1/');

    // Las escrituras invalidan las lecturas REST previamente almacenadas.
    if (isSupabaseRest && method !== 'GET' && method !== 'HEAD') {
        supabaseRestCache.clear();
        return fetch(input, init);
    }

    // No cachear nada que no sea una lectura REST de Supabase.
    if (!isSupabaseRest || method !== 'GET') {
        return fetch(input, init);
    }

    const key = buildRestCacheKey(input, init);
    const now = Date.now();
    const cached = supabaseRestCache.get(key);

    if (cached && (now - cached.timestamp) < SUPABASE_REST_CACHE_TTL) {
        return cached.response.clone();
    }

    if (cached) {
        supabaseRestCache.delete(key);
    }

    const response = await fetch(input, init);

    if (response.ok) {
        supabaseRestCache.set(key, {
            timestamp: now,
            response: response.clone()
        });
    }

    return response;
}

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        global: {
            fetch: optimizedFetch
        }
    }
);

// Permite limpiar manualmente las lecturas REST cuando una operación
// cambie datos y la pantalla necesite refrescar inmediatamente.
db.clearRestCache = () => supabaseRestCache.clear();
