import { gameState } from "../state.js";

/**
 * Credits Scene.
 * Displays smooth scrolling end credits featuring creators, beta testers,
 * and sprite/asset authors, with speed-up and replay controls.
 *
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initCredits(k) {
  k.scene("credits", () => {
    k.camPos(k.width() / 2, k.height() / 2);

    // Atmospheric backdrop
    k.add([
      k.sprite("bg_level1"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Deep midnight overlay for high text legibility
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(10, 12, 22),
      k.opacity(0.9),
      k.fixed(),
      k.z(-5)
    ]);

    // Subtle twinkling stars in the background
    for (let i = 0; i < 28; i++) {
      const star = k.add([
        k.rect(2, 2),
        k.pos(k.rand(0, k.width()), k.rand(0, k.height())),
        k.color(200, 220, 255),
        k.opacity(k.rand(0.2, 0.7)),
        k.fixed(),
        k.z(-3),
        {
          phase: k.rand(0, Math.PI * 2),
          speed: k.rand(1.5, 4)
        }
      ]);
      star.onUpdate(() => {
        star.opacity = k.wave(0.15, 0.75, k.time() * star.speed + star.phase);
      });
    }

    // Scrolling container
    const scrollContainer = k.add([
      k.pos(k.width() / 2, k.height() + 30),
      k.z(10)
    ]);

    let cursorY = 0;

    function addLine(text, { size = 8, color = k.rgb(230, 235, 245), gap = 20 } = {}) {
      scrollContainer.add([
        k.text(text, { font: "pressstart", size }),
        k.pos(0, cursorY),
        k.anchor("center"),
        k.color(color)
      ]);
      cursorY += gap;
    }

    function addSection(title, color = k.rgb(255, 220, 90)) {
      cursorY += 14;
      scrollContainer.add([
        k.rect(340, 2),
        k.pos(0, cursorY - 12),
        k.anchor("center"),
        k.color(color),
        k.opacity(0.45)
      ]);
      addLine(title, { size: 10, color, gap: 26 });
    }

    // --- Credits Content ---
    addLine("MILI'S ADVENTURE", { size: 18, color: k.rgb(255, 220, 80), gap: 26 });
    addLine("CRÉDITOS FINALES", { size: 9, color: k.rgb(160, 220, 255), gap: 38 });

    // Creators
    addSection("CREADORES DEL JUEGO", k.rgb(255, 215, 80));
    addLine("Juan Manuel Rojas Muñoz", { size: 9, color: k.rgb(245, 245, 255), gap: 22 });
    addLine("Nohora Camila Cardozo Cardenas", { size: 9, color: k.rgb(245, 245, 255), gap: 34 });

    // Beta Testers
    addSection("BETA TESTERS", k.rgb(120, 240, 190));
    addLine("Juan Jose Galvez", { size: 9, color: k.rgb(230, 245, 240), gap: 22 });
    addLine("Brahian Castro", { size: 9, color: k.rgb(230, 245, 240), gap: 34 });

    // Sprite & Asset Authors
    addSection("AUTORES DE SPRITES Y ASSETS", k.rgb(180, 170, 255));
    addLine("https://zerie.itch.io/", { size: 7.5, color: k.rgb(210, 225, 255), gap: 20 });
    addLine("https://clockworkraven.itch.io/", { size: 7.5, color: k.rgb(210, 225, 255), gap: 20 });
    addLine("https://oboropixel.itch.io/", { size: 7.5, color: k.rgb(210, 225, 255), gap: 20 });
    addLine("https://brackeysgames.itch.io/", { size: 7.5, color: k.rgb(210, 225, 255), gap: 20 });
    addLine("https://deepdivegamestudio.itch.io/", { size: 7.5, color: k.rgb(210, 225, 255), gap: 38 });

    // Closing tribute
    addSection("¡GRACIAS POR JUGAR!", k.rgb(255, 190, 120));
    addLine(`PUNTUACIÓN FINAL: ${String(gameState.score).padStart(5, "0")}`, {
      size: 9,
      color: k.rgb(255, 235, 120),
      gap: 32
    });

    // Celebrating Mili sprite at the end of the scroll
    scrollContainer.add([
      k.sprite("player", { anim: "idle" }),
      k.pos(0, cursorY + 14),
      k.anchor("center"),
      k.scale(2.2)
    ]);
    cursorY += 56;

    // Final prompt that settles in the center when scroll completes
    const endBannerY = cursorY;
    const endPrompt = scrollContainer.add([
      k.text("Presiona ESPACIO o ENTER para volver a jugar", {
        font: "pressstart",
        size: 8
      }),
      k.pos(0, endBannerY),
      k.anchor("center"),
      k.color(230, 235, 255)
    ]);

    // Fixed bottom helper bar
    k.add([
      k.rect(k.width(), 22),
      k.pos(0, k.height() - 22),
      k.color(8, 10, 18),
      k.opacity(0.85),
      k.fixed(),
      k.z(50)
    ]);

    k.add([
      k.text("Manten ABAJO/ESPACIO: Acelerar   |   R / ESC: Volver a jugar", {
        font: "pressstart",
        size: 6.5
      }),
      k.pos(k.width() / 2, k.height() - 11),
      k.anchor("center"),
      k.color(170, 185, 210),
      k.fixed(),
      k.z(51)
    ]);

    // Stop scrolling once the final prompt reaches the lower-center of the screen
    const stopTargetY = k.height() * 0.72 - endBannerY;
    let scrollFinished = false;

    scrollContainer.onUpdate(() => {
      if (scrollFinished) return;

      const fastForward = k.isKeyDown("down") || k.isKeyDown("s") || k.isKeyDown("space");
      const speed = fastForward ? 110 : 34;

      scrollContainer.pos.y -= speed * k.dt();

      if (scrollContainer.pos.y <= stopTargetY) {
        scrollContainer.pos.y = stopTargetY;
        scrollFinished = true;
      }
    });

    // Pulse final prompt once scroll finishes
    k.loop(0.6, () => {
      if (scrollFinished) {
        endPrompt.opacity = endPrompt.opacity === 1 ? 0.35 : 1;
      }
    });

    // Restart controls
    function restartGame() {
      gameState.reset();
      k.go("level1");
    }

    for (const key of ["r", "escape"]) {
      k.onKeyPress(key, restartGame);
    }

    for (const key of ["enter", "space"]) {
      k.onKeyPress(key, () => {
        if (scrollFinished) {
          restartGame();
        }
      });
    }
  });
}
