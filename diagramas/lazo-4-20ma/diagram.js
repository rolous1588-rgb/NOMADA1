// =====================================================================
// Diagrama interactivo: Lazo de corriente 4-20 mA
// Modulo independiente: solo depende del contenedor que se le pasa y de
// las funciones que la plataforma le entrega (onCambio). No conoce nada
// de Supabase ni de la logica de evaluacion.
// =====================================================================

function corrienteDesdePv(pv) {
  return 4 + (pv / 100) * 16;
}

function svgBase() {
  return `
  <svg viewBox="0 0 640 220" class="diagrama-svg" role="img" aria-label="Lazo de corriente 4-20 mA">
    <!-- Sensor / transmisor -->
    <rect x="20" y="70" width="120" height="80" rx="10" fill="#1f2937" stroke="#60a5fa" stroke-width="2"/>
    <text x="80" y="55" text-anchor="middle" fill="#e5e7eb" font-size="14">Transmisor</text>
    <text x="80" y="105" text-anchor="middle" fill="#93c5fd" font-size="12">Sensor</text>
    <text id="pv-label" x="80" y="128" text-anchor="middle" fill="#f9fafb" font-size="16" font-weight="bold">0%</text>

    <!-- Cable -->
    <line x1="140" y1="110" x2="420" y2="110" stroke="#fbbf24" stroke-width="4"/>
    <circle id="pulso" cx="140" cy="110" r="5" fill="#fde68a"/>

    <!-- Indicador / PLC -->
    <rect x="420" y="60" width="200" height="100" rx="10" fill="#1f2937" stroke="#34d399" stroke-width="2"/>
    <text x="520" y="48" text-anchor="middle" fill="#e5e7eb" font-size="14">Controlador / PLC</text>
    <text id="ma-label" x="520" y="105" text-anchor="middle" fill="#6ee7f9" font-size="26" font-weight="bold">4.00 mA</text>
    <text x="520" y="130" text-anchor="middle" fill="#a7f3d0" font-size="12">Escala: 4-20 mA</text>

    <!-- Barra de escala -->
    <rect x="450" y="140" width="140" height="10" rx="5" fill="#374151"/>
    <rect id="barra" x="450" y="140" width="0" height="10" rx="5" fill="#34d399"/>
  </svg>`;
}

function actualizarSvg(el, pv) {
  const mA = corrienteDesdePv(pv);
  el.querySelector("#pv-label").textContent = `${pv.toFixed(0)}%`;
  el.querySelector("#ma-label").textContent = `${mA.toFixed(2)} mA`;
  const pctBarra = ((mA - 4) / 16) * 140;
  el.querySelector("#barra").setAttribute("width", Math.max(0, pctBarra).toFixed(1));
  const pulso = el.querySelector("#pulso");
  if (pulso) pulso.setAttribute("cx", 140 + (280 * pv) / 100);
  return mA;
}

// Version interactiva, para cada estudiante.
export function montar(el, { manifest, onCambio } = {}) {
  el.innerHTML = `
    <div class="diagrama-lazo">
      ${svgBase()}
      <div class="control-fila">
        <label for="pv-slider">Variable de proceso (%)</label>
        <input id="pv-slider" type="range" min="0" max="100" step="1" value="0" />
        <span id="pv-valor">0%</span>
      </div>
    </div>
  `;

  const slider = el.querySelector("#pv-slider");
  const pvValor = el.querySelector("#pv-valor");

  function refrescar() {
    const pv = Number(slider.value);
    const mA = actualizarSvg(el, pv);
    pvValor.textContent = `${pv}%`;
    if (typeof onCambio === "function") onCambio({ pv, corriente_mA: mA });
  }

  slider.addEventListener("input", refrescar);
  refrescar();

  return {
    obtenerEstado() {
      const pv = Number(slider.value);
      return { pv, corriente_mA: corrienteDesdePv(pv) };
    },
    fijarPv(pv) {
      slider.value = String(pv);
      refrescar();
    },
    destruir() {
      el.innerHTML = "";
    },
  };
}

// Version de solo lectura / proyeccion para explicar en Zoom: anima el
// valor automaticamente para ilustrar el concepto, sin controles.
export function montarSoloLectura(el) {
  el.innerHTML = `<div class="diagrama-lazo diagrama-lazo--demo">${svgBase()}</div>`;
  let pv = 0;
  let subiendo = true;
  actualizarSvg(el, 0);
  const intervalo = setInterval(() => {
    pv += subiendo ? 2 : -2;
    if (pv >= 100) { pv = 100; subiendo = false; }
    if (pv <= 0) { pv = 0; subiendo = true; }
    actualizarSvg(el, pv);
  }, 120);

  return {
    destruir() {
      clearInterval(intervalo);
      el.innerHTML = "";
    },
  };
}
