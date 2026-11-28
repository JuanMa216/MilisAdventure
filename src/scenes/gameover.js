import { gameState } from "../state.js";

/**
 * Escena de Game Over (Derrota).
 * Muestra la puntuación final alcanzada y permite reiniciar la partida desde el Nivel 1.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initGameOver(k) {
  k.scene("gameover", () => {
    k.camPos(k.width() / 2, k.height() / 2);

    // Fondo oscuro con tono rojizo
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(15, 8, 12),
      k.fixed()
    ]);

    // Título principal de Game Over
    k.add([
      k.text("GAME OVER", { font: "pressstart", size: 24 }),
      k.pos(k.width() / 2, k.height() / 2 - 40),
      k.anchor("center"),
      k.color(240, 60, 70),
      k.fixed()
    ]);

    // Indicador de puntuación final
    k.add([
      k.text(`PUNTUACIÓN FINAL: ${gameState.score}`, { font: "pressstart", size: 10 }),
      k.pos(k.width() / 2, k.height() / 2 + 10),
      k.anchor("center"),
      k.color(240, 220, 160),
      k.fixed()
    ]);

    // Instrucción para reintentar
    const prompt = k.add([
      k.text("Presiona ESPACIO o ENTER para reintentar", { font: "pressstart", size: 8 }),
      k.pos(k.width() / 2, k.height() / 2 + 55),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.fixed()
    ]);

    // Efecto de parpadeo en el mensaje de reinicio
    k.loop(0.6, () => {
      prompt.opacity = prompt.opacity === 1 ? 0.3 : 1;
    });

    // Atajos de teclado para reiniciar el juego
    for (const key of ["space", "enter", "r"]) {
      k.onKeyPress(key, () => {
        gameState.reset();
        k.go("level1");
      });
    }
  });
}
