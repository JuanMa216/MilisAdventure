import { gameState } from "../state.js";

/**
 * Escena de Victoria.
 * Muestra la pantalla de triunfo final, la puntuación obtenida, el estado del Easter Egg
 * y el acceso a los créditos finales o al reinicio de la partida.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initVictory(k) {
  k.scene("victory", () => {
    k.camPos(k.width() / 2, k.height() / 2);
    k.play("win");

    // Fondo atmosférico de celebración
    k.add([
      k.sprite("bg_level1"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Superposición oscura semitransparente
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(14, 18, 28),
      k.opacity(0.85),
      k.fixed(),
      k.z(-5)
    ]);

    // Título de victoria
    k.add([
      k.text("¡VICTORIA ÉPICA!", { font: "pressstart", size: 20 }),
      k.pos(k.width() / 2, 70),
      k.anchor("center"),
      k.color(255, 220, 80),
      k.fixed(),
      k.z(10)
    ]);

    // Texto de cierre de la historia
    k.add([
      k.text("¡El Rey Demonio ha sido purificado!", { font: "pressstart", size: 9 }),
      k.pos(k.width() / 2, 110),
      k.anchor("center"),
      k.color(200, 240, 255),
      k.fixed(),
      k.z(10)
    ]);

    k.add([
      k.text("Mili ha salvado las tierras sagradas de Cartago y las cavernas.", {
        font: "pressstart",
        size: 7
      }),
      k.pos(k.width() / 2, 130),
      k.anchor("center"),
      k.color(180, 200, 210),
      k.fixed(),
      k.z(10)
    ]);

    // Sprite de la heroína Mili celebrando
    const hero = k.add([
      k.sprite("player", { anim: "idle" }),
      k.pos(k.width() / 2, 185),
      k.anchor("center"),
      k.scale(2.2),
      k.fixed(),
      k.z(15)
    ]);

    // Panel de puntuación final
    k.add([
      k.rect(380, 42),
      k.pos(k.width() / 2, 245),
      k.anchor("center"),
      k.color(25, 20, 35),
      k.fixed(),
      k.z(10)
    ]);

    k.add([
      k.text(`PUNTUACIÓN FINAL: ${String(gameState.score).padStart(5, "0")}`, {
        font: "pressstart",
        size: 10
      }),
      k.pos(k.width() / 2, 238),
      k.anchor("center"),
      k.color(255, 230, 100),
      k.fixed(),
      k.z(11)
    ]);

    // Indicador de estado del Easter Egg
    if (gameState.foundEasterEgg) {
      k.add([
        k.text("★ ¡EASTER EGG ENCONTRADO - 100% COMPLETADO! ★", {
          font: "pressstart",
          size: 7
        }),
        k.pos(k.width() / 2, 256),
        k.anchor("center"),
        k.color(100, 255, 180),


        k.fixed(),
        k.z(11)
      ]);
    } else {
      k.add([
        k.text(`¿Nivel Secreto? Consigue ***** pts para desbloquear el Easter Egg`, {
          font: "pressstart",
          size: 6
        }),
        k.pos(k.width() / 2, 256),
        k.anchor("center"),
        k.color(200, 180, 140),
        k.fixed(),
        k.z(11)
      ]);
    }

    // Indicaciones para ver créditos o reiniciar
    const prompt = k.add([
      k.text("Presiona ESPACIO o ENTER para ver los Créditos", {
        font: "pressstart",
        size: 8
      }),
      k.pos(k.width() / 2, 292),
      k.anchor("center"),
      k.color(220, 235, 255),
      k.fixed(),
      k.z(10)
    ]);

    k.add([
      k.text("(Presiona R para volver a jugar directamente)", {
        font: "pressstart",
        size: 6.5
      }),
      k.pos(k.width() / 2, 314),
      k.anchor("center"),
      k.color(165, 175, 195),
      k.fixed(),
      k.z(10)
    ]);

    // Animación sutil de parpadeo para el mensaje principal
    k.loop(0.6, () => {
      prompt.opacity = prompt.opacity === 1 ? 0.3 : 1;
    });

    // Atajos de teclado para abrir los créditos o reiniciar desde el Nivel 1
    for (const key of ["space", "enter", "c"]) {
      k.onKeyPress(key, () => {
        k.go("credits");
      });
    }

    k.onKeyPress("r", () => {
      gameState.reset();
      k.go("level1");
    });
  });
}
