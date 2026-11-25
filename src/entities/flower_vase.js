import { gameState } from "../state.js";

/**
 * Creates an interactive, breakable decorative flower vase.
 * 
 * Mechanics:
 * - Can ONLY be broken with Mili's sword attack (Z, J, Enter), NOT by stomping/jumping.
 * - On destruction:
 *   - Plays impact sound & subtle screen shake.
 *   - Emits scattering ceramic shards & flower petal particles with physics.
 *   - Awards +50 base score.
 *   - Chance to drop a coin (+100) or a restorative heart if lives are low.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {Function} onScorePopup - Callback to display floating text
 * @param {Function} onBreak - Callback when vase is destroyed
 * @returns {import("kaboom").GameObj} The vase game object
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

        // Spawn ceramic shards and petal debris
        const colors = [
          k.rgb(205, 120, 80),  // Terracotta clay
          k.rgb(160, 80, 50),   // Dark ceramic
          k.rgb(240, 160, 110), // Light ceramic
          k.rgb(90, 185, 90),   // Stem green
          k.rgb(255, 120, 150)  // Petal pink
        ];

        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const speed = k.rand(55, 120);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - 65; // Upward pop
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
            shardVy += 520 * k.dt(); // Gravity
            shard.opacity = Math.max(0, (shard.opacity ?? 1) - 2.8 * k.dt());
            if (shard.opacity <= 0) {
              shard.destroy();
            }
          });
        }

        // Random bonus drop: chance of coin or heart
        const roll = Math.random();
        if (gameState.lives < gameState.maxLives && roll < 0.3) {
          // Drops a restorative heart
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
          // Drops a bonus coin
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

  // Can ONLY be broken by the player's sword melee hitbox
  vase.onCollide("sword_hitbox", () => {
    vase.break();
  });

  return vase;
}
