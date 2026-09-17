import { createClient } from "@supabase/supabase-js";

// Este cliente corre SOLO del lado del servidor (Route Handlers / Server
// Components). Usa la clave "anon", pero las tablas operativas tienen
// policies de RLS que le dan lectura/escritura completa (el control de
// acceso real es el gate de contraseña de la app, igual que en el
// artifact piloto). Las tablas de participantes/delegados quedan
// cerradas hasta que sumemos ese módulo.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan las variables de entorno SUPABASE_URL / SUPABASE_ANON_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
