// =====================================================================
// Evaluacion generica de ejercicios, a partir de la definicion que trae
// cada diagrama en su manifest.json. Un mismo motor sirve para cualquier
// diagrama nuevo, siempre que declare sus ejercicios con esta forma:
//
//  { id, tipo: "numerica", enunciado, tolerancia, puntaje }
//     -> el diagrama calcula el valor correcto en vivo (depende de los
//        parametros que el propio estudiante mueve) y lo pasa como
//        "esperado" al evaluar.
//  { id, tipo: "opcion", enunciado, opciones: [{id,texto}], correcta, puntaje }
//  { id, tipo: "abierta", enunciado }
//     -> no se autocalifica; queda "puntaje: null" hasta que el docente
//        la califique desde la pizarra.
// =====================================================================

export function evaluarNumerica(valorEstudiante, esperado, tolerancia, puntaje = 1) {
  const v = Number(valorEstudiante);
  const e = Number(esperado);
  const tol = Number(tolerancia ?? 0);
  if (Number.isNaN(v)) return { correcta: false, puntaje: 0 };
  const correcta = Math.abs(v - e) <= tol;
  return { correcta, puntaje: correcta ? puntaje : 0 };
}

export function evaluarOpcion(opcionElegidaId, opcionCorrectaId, puntaje = 1) {
  const correcta = String(opcionElegidaId) === String(opcionCorrectaId);
  return { correcta, puntaje: correcta ? puntaje : 0 };
}

// Las respuestas abiertas nunca se autocalifican: se guardan tal cual y
// el docente les pone puntaje despues, desde la pizarra.
export function empaquetarAbierta(texto) {
  return { texto };
}
