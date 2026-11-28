import { gameState } from "../state.js";

/**
 * Crea e inicializa el HUD (interfaz en pantalla).
 * Cumple con Req-3 (Contador de puntuación), Req-4 (Sistema de vidas/corazones) y seguimiento de nivel.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {string} levelTitle - Nombre del nivel actual a mostrar
 * @returns {object} Controlador del HUD con métodos de actualización y barra de jefe
 */
export function createHUD(k, levelTitle = "NIVEL 1") {
  // Franja de fondo semitransparente para el HUD
  k.add([
    k.rect(k.width(), 36),
    k.pos(0, 0),
    k.color(14, 12, 22),
    k.opacity(0.85),
    k.fixed(),
    k.z(90)
  ]);

  // Borde inferior sutil para la franja
  k.add([
    k.rect(k.width(), 2),
    k.pos(0, 36),
    k.color(59, 45, 84),
    k.fixed(),
    k.z(91)
  ]);

  // --- 1. Indicador de corazones / vidas (Req-4) ---
  const heartObjects = [];
  const startX = 20;
  const heartSpacing = 26;

  for (let i = 0; i < gameState.maxLives; i++) {
    const heart = k.add([
      k.sprite("heart_full"),
      k.pos(startX + i * heartSpacing, 10),
      k.scale(1.25),
      k.fixed(),
      k.z(100)
    ]);
    heartObjects.push(heart);
  }

  // --- 2. Indicador de llave o libro en inventario (mecánica del Nivel 2) ---
  const keyIcon = k.add([
    k.sprite("key"),
    k.pos(startX + gameState.maxLives * heartSpacing + 10, 8),
    k.scale(1.2),
    k.fixed(),
    k.z(100),
    k.opacity(0) // Oculto hasta recoger el objeto
  ]);

  // --- 3. Etiqueta del nivel actual ---
  const displayTitle = typeof levelTitle === "string" ? levelTitle : "NIVEL 1";
  const levelLabel = k.add([
    k.text(displayTitle.toUpperCase(), {
      font: "pressstart",
      size: 10
    }),
    k.pos(k.width() / 2, 18),
    k.anchor("center"),
    k.color(240, 220, 160),
    k.fixed(),
    k.z(100)
  ]);

  // --- 4. Contador de puntuación (Req-3) ---
  // Ícono de moneda junto a la puntuación
  k.add([
    k.sprite("coin"),
    k.pos(k.width() - 120, 9),
    k.scale(1.1),
    k.fixed(),
    k.z(100)
  ]);

  const scoreLabel = k.add([
    k.text("00000", {
      font: "pressstart",
      size: 10
    }),
    k.pos(k.width() - 95, 18),
    k.anchor("left"),
    k.color(255, 230, 100),
    k.fixed(),
    k.z(100)
  ]);

  // --- 5. Bucle de actualización en tiempo real para el estado del HUD ---
  const hudUpdater = k.onUpdate(() => {
    // Actualiza los corazones según las vidas actuales
    for (let i = 0; i < heartObjects.length; i++) {
      if (i < gameState.lives) {
        heartObjects[i].use(k.sprite("heart_full"));
      } else {
        heartObjects[i].use(k.sprite("heart_empty"));
      }
    }

    // Formatea el puntaje con 5 dígitos rellenados con ceros
    const formattedScore = String(gameState.score).padStart(5, "0");
    scoreLabel.text = formattedScore;

    // Actualiza el ícono de llave o libro coleccionado
    if (gameState.collectedBook === "red") {
      keyIcon.use(k.sprite("book_red"));
      keyIcon.opacity = 1;
    } else if (gameState.collectedBook === "green") {
      keyIcon.use(k.sprite("book_green"));
      keyIcon.opacity = 1;
    } else if (gameState.collectedBook === "blue") {
      keyIcon.use(k.sprite("book_blue"));
      keyIcon.opacity = 1;
    } else if (gameState.hasKey) {
      keyIcon.use(k.sprite("key"));
      keyIcon.opacity = 1;
    } else {
      keyIcon.opacity = 0;
    }
  });

  return {
    /**
     * Cancela el bucle de actualización del HUD al salir de la escena.
     */
    destroy() {
      hudUpdater.cancel();
    },

    /**
     * Crea la barra de salud del jefe en el HUD para el Nivel 3 (Req-10).
     * @param {string} bossName - Nombre del jefe (p. ej. "REY DEMONIO")
     * @param {number} maxHp - Puntos de vida máximos del jefe
     * @returns {object} Controlador con método update(currentHp)
     */
    createBossBar(bossName = "REY DEMONIO", maxHp = 10) {
      const barWidth = 240;
      const barHeight = 12;
      const barX = (k.width() - barWidth) / 2;
      const barY = k.height() - 28;

      // Texto con el nombre del jefe
      k.add([
        k.text(bossName, { font: "pressstart", size: 8 }),
        k.pos(k.width() / 2, barY - 10),
        k.anchor("center"),
        k.color(255, 100, 100),
        k.fixed(),
        k.z(100)
      ]);

      // Borde de fondo de la barra
      k.add([
        k.rect(barWidth + 4, barHeight + 4),
        k.pos(barX - 2, barY - 2),
        k.color(20, 10, 25),
        k.fixed(),
        k.z(98)
      ]);

      // Fondo vacío de la barra (rojo oscuro)
      k.add([
        k.rect(barWidth, barHeight),
        k.pos(barX, barY),
        k.color(60, 20, 20),
        k.fixed(),
        k.z(99)
      ]);

      // Relleno dinámico de vida (rojo brillante)
      const healthFill = k.add([
        k.rect(barWidth, barHeight),
        k.pos(barX, barY),
        k.color(230, 40, 50),
        k.fixed(),
        k.z(100)
      ]);

      return {
        /**
         * Actualiza el ancho de la barra según la vida actual del jefe.
         * @param {number} currentHp - Vida actual del jefe
         */
        update(currentHp) {
          const ratio = Math.max(0, currentHp / maxHp);
          healthFill.width = barWidth * ratio;
        }
      };
    }
  };
}
