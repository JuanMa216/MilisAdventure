import { gameState } from "../state.js";

/**
 * Crea un jarrón decorativo interactivo y rompible.
 * 
 * Mecánicas:
 * - Solo puede romperse con el ataque de espada de Mili (Z, J, Enter), NO saltando encima.
 * - Al destruirse:
 *   - Reproduce sonido de impacto y una sacudida sutil de cámara.
 *   - Emite fragmentos de cerámica y pétalos con física.
 *   - Otorga +50 puntos base.
 *   - Puede soltar una moneda o un corazón restaurador si faltan vidas.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Posición X central
 * @param {number} y - Posición Y central
 * @param {Function} onScorePopup - Callback para mostrar texto flotante de puntuación
 * @param {Function} onBreak - Callback al destruirse el jarrón
 * @returns {import("kaboom").GameObj} Objeto de juego del jarrón
 */
export function createFlowerVase(k, x, y, onScorePopup = null, onBreak = null) {
  const vase = k.add([
    k.sprite("flower_vase"),
    k.pos(x, y),
    k.scale(24 / 16),
    k.anchor("center"),
    k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 16) }),
    k.z(2),
    "flower_vase",
    "destructible",
    {
      isBroken: false,
      /**
       * Rompe el jarrón, genera partículas de escombros y suelta recompensas aleatorias.
       */
      break() {
        if (this.isBroken) return;
        this.isBroken = true;

        k.play("hit");
        k.shake(1.5);
        gameState.addScore(50);
        if (onScorePopup) {
          onScorePopup(this.pos, 50);
        }
        if (onBreak) {
          onBreak(this);
        }

        // Genera fragmentos de cerámica y pétalos de flor
        const colors = [
          k.rgb(205, 120, 80),  // Arcilla terracota
          k.rgb(160, 80, 50),   // Cerámica oscura
          k.rgb(240, 160, 110), // Cerámica clara
          k.rgb(90, 185, 90),   // Tallo verde
          k.rgb(255, 120, 150)  // Pétalo rosa
        ];

        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const speed = k.rand(55, 120);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 65; // Impulso ascendente inicial
          const col = colors[i % colors.length];
          const size = k.rand(2.5, 4.5);

          const shard = k.add([
            k.rect(size, size),
            k.pos(this.pos.x + k.rand(-3, 3), this.pos.y + k.rand(-3, 3)),
            k.color(col),
            k.anchor("center"),
            k.z(25)
          ]);

          let shardVy = vy;
          shard.onUpdate(() => {
            shard.pos.x += vx * k.dt();
            shard.pos.y += shardVy * k.dt();
            shardVy += 520 * k.dt(); // Gravedad aplicada al fragmento
            shard.opacity = Math.max(0, (shard.opacity ?? 1) - 2.8 * k.dt());
            if (shard.opacity <= 0) {
              shard.destroy();
            }
          });
        }

        // Recompensa aleatoria: probabilidad de soltar un corazón o una moneda
        const roll = Math.random();
        if (gameState.lives < gameState.maxLives && roll < 0.3) {
          // Suelta un corazón restaurador
          k.add([
            k.sprite("heart_full"),
            k.pos(this.pos.x, this.pos.y - 4),
            k.scale(24 / 16),
            k.area(),
            k.anchor("center"),
            k.z(3),
            "heart_drop"
          ]);
        } else if (roll < 0.55) {
          // Suelta una moneda de bonificación
          k.add([
            k.sprite("coin"),
            k.pos(this.pos.x, this.pos.y - 4),
            k.scale(24 / 18),
            k.area(),
            k.anchor("center"),
            k.z(3),
            "coin"
          ]);
        }

        this.destroy();
      }
    }
  ]);

  // Solo puede romperse con el hitbox de la espada del jugador
  vase.onCollide("sword_hitbox", () => {
    vase.break();
  });

  return vase;
}
