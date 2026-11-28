import kaboom from "kaboom";

/**
 * Instancia principal del contexto de Kaboom.js.
 * Configura la resolución interna (640x360), el modo letterbox,
 * el lienzo objetivo y el límite de 60 FPS.
 */
export const k = kaboom({
  width: 640,
  height: 360,
  letterbox: true,
  canvas: document.getElementById("game"),
  background: [18, 16, 25],
  maxFPS: 60
});

// Alternar pantalla completa al presionar la tecla F
window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    const container = document.getElementById("game-container");
    if (!document.fullscreenElement) {
      container?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
});

export default k;
