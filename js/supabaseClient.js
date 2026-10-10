/**
 * supabaseClient.js
 * ----------------------------------------------------------------------
 * Inicializa la conexión con Supabase.
 *
 * 👉 REEMPLAZA los dos valores de abajo con los de TU proyecto:
 *    Supabase Dashboard → Project Settings → API
 *      - "Project URL"      → SUPABASE_URL
 *      - "anon public" key  → SUPABASE_ANON_KEY
 *
 * La "anon key" es pública y segura de exponer en el frontend: el acceso
 * real a los datos queda protegido por las políticas RLS definidas en
 * sql/schema.sql, no por mantener esta llave en secreto.
 * ----------------------------------------------------------------------
 */
const SUPABASE_URL = 'https://qrxekxxazvnopcqoowbr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K-h_DsBfh05CmCJ6s244eQ_QaknLJ4V';

// Se usa el nombre "db" (en vez de "supabase") para no chocar con el
// objeto global "supabase" que crea el SDK cargado por CDN.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
