// =====================================================================
// Registro de diagramas disponibles. Para agregar un diagrama nuevo:
//   1. crea una carpeta en /diagramas/<id>/ con manifest.json y diagram.js
//   2. agrega una linea aqui con su id y su carpeta
// Nada mas del sistema necesita cambiar.
// =====================================================================
export const DIAGRAMAS = {
  "lazo-4-20ma": {
    nombre: "Lazo de corriente 4–20 mA",
    carpeta: "diagramas/lazo-4-20ma",
  },
};

export async function cargarManifest(diagramaId) {
  const info = DIAGRAMAS[diagramaId];
  if (!info) throw new Error(`Diagrama no registrado: ${diagramaId}`);
  const resp = await fetch(`${info.carpeta}/manifest.json`);
  if (!resp.ok) throw new Error(`No se pudo cargar manifest de ${diagramaId}`);
  const manifest = await resp.json();
  return { ...manifest, carpeta: info.carpeta };
}

// Carga el modulo JS del diagrama. Cada modulo exporta:
//   montar(contenedorEl, { manifest, onEvento })  -> pinta el SVG/canvas
//   montarSoloLectura(contenedorEl, { manifest })  -> version para Zoom/proyeccion, sin inputs
export async function cargarModulo(diagramaId) {
  const info = DIAGRAMAS[diagramaId];
  if (!info) throw new Error(`Diagrama no registrado: ${diagramaId}`);
  return import(`../${info.carpeta}/diagram.js`);
}
