// =====================================================================
// Cliente Supabase compartido + funciones de alto nivel usadas por las
// vistas de estudiante y docente. Todo pasa por las funciones RPC
// definidas en supabase/schema.sql (unirse, enviar_respuesta, calificar_respuesta).
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Garantiza que haya una sesion (anonima si nadie ha iniciado sesion).
// Se usa tanto en la vista de estudiante como en la de docente sin
// contraseña propia (el docente puede luego migrar a login con correo).
export async function asegurarSesionAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.session;
}

// ---------- Docente (login con correo + contraseña) ----------
// Se eligio contraseña en vez de enlace/codigo por correo porque Gmail y
// otros clientes a veces invalidan los enlaces de un solo uso al
// "previsualizarlos" por seguridad, antes de que el usuario los abra.

export async function crearCuentaDocente(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function iniciarSesionDocente(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export function generarCodigoSesion() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  let codigo = "";
  for (let i = 0; i < 3; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
  for (let i = 0; i < 3; i++) codigo += numeros[Math.floor(Math.random() * numeros.length)];
  return codigo;
}

export async function crearSesionClase({ titulo, diagramaId, codigo }) {
  const { data, error } = await supabase
    .from("sesiones")
    .insert({ titulo, diagrama_id: diagramaId, codigo })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cerrarSesionClase(sesionId) {
  const { error } = await supabase.from("sesiones").update({ activa: false }).eq("id", sesionId);
  if (error) throw error;
}

export async function misSesiones() {
  const { data, error } = await supabase
    .from("sesiones")
    .select("*")
    .order("creada", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function listarParticipantes(sesionId) {
  const { data, error } = await supabase
    .from("participantes")
    .select("*")
    .eq("sesion_id", sesionId)
    .order("creado", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listarRespuestas(sesionId) {
  const { data, error } = await supabase
    .from("respuestas")
    .select("*")
    .eq("sesion_id", sesionId);
  if (error) throw error;
  return data;
}

export async function calificarRespuesta(respuestaId, puntaje, nota) {
  const { error } = await supabase.rpc("calificar_respuesta", {
    p_respuesta_id: respuestaId,
    p_puntaje: puntaje,
    p_nota: nota ?? null,
  });
  if (error) throw error;
}

export function suscribirCambiosSesion(sesionId, onCambio) {
  const canal = supabase
    .channel(`sesion-${sesionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "participantes", filter: `sesion_id=eq.${sesionId}` },
      onCambio
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "respuestas", filter: `sesion_id=eq.${sesionId}` },
      onCambio
    )
    .subscribe();
  return () => supabase.removeChannel(canal);
}

// ---------- Estudiante ----------

export async function unirseASesion(codigo, nombre, carnet) {
  const { data, error } = await supabase.rpc("unirse", {
    p_codigo: codigo,
    p_nombre: nombre,
    p_carnet: carnet,
  });
  if (error) throw error;
  return data; // { participante_id, nombre, sesion_id, titulo, diagrama_id }
}

export async function enviarRespuesta({ participanteId, ejercicioId, tipo, respuesta, correcta, puntaje }) {
  const { error } = await supabase.rpc("enviar_respuesta", {
    p_participante: participanteId,
    p_ejercicio: ejercicioId,
    p_tipo: tipo,
    p_respuesta: respuesta,
    p_correcta: correcta ?? null,
    p_puntaje: puntaje ?? null,
  });
  if (error) throw error;
}

export async function misRespuestas(participanteId) {
  const { data, error } = await supabase
    .from("respuestas")
    .select("*")
    .eq("participante_id", participanteId);
  if (error) throw error;
  return data;
}
