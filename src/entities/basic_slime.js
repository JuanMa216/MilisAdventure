import { gameState } from "../state.js";

/**
 * Creates and initializes a Basic Slime / Cavern Ooze enemy.
 * 
 * Features:
 * - 1 HP bouncy ooze enemy from Pixel Enemies pack.
 * - Squishes and lunges forward when the player gets close.
 * - Can be stomped from above or slashed with sword.
 * - Fast O(1) player tracking.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 * @param {number} x - Initial X coordinate
 * @param {number} y - Initial Y coordinate
 * @param {number} patrolRange - Max distance to wander left/right
 * @returns {import("kaboom").GameObj} The slime game object
 */
export function createBasicSlime(k, x, y, patrolRange = 50) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 28;
  const attackDistance = 55;
  const visionDistance = 140;

  let attackCooldown = 0;

  const slime = k.add([
    k.sprite("slime_basic", { anim: "walk" }),
    k.pos(x, y),
    // Frame is 96x64, slime is ~29x12 px centered. Scale 1.0 fits 24px tile scale
    k.scale(1.0),
    k.area({ shape: new k.Rect(k.vec2(0, 10), 24, 12) }),
    k.body({ maxVelocity: 350 }),
    k.anchor("center"),
    k.z(5),
    "enemy",
    "basic_slime",
    {
      hp: 1,
      isDead: false,
      isHurt: false,
      state: "patrol", // "patrol" | "attack" | "hurt" | "die"

      // Slime defeated
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = "die";

        k.play("hit");
        gameState.addScore(150);

        // Score popup
        const scorePopup = k.add([
          k.text("+150", { font: "pressstart", size: 8 }),
          k.pos(this.pos.x, this.pos.y - 12),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(30)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 25 * k.dt();
        });
        k.wait(0.6, () => scorePopup.destroy());

        this.play("die");
        this.collisionIgnore = ["*"];

        k.wait(0.7, () => {
          this.destroy();
        });
      }
    }
  ]);

  // Slime AI Update Loop
  slime.onUpdate(() => {
    if (slime.isDead) return;

    if (slime.vel && slime.vel.y > 350) {
      slime.vel.y = 350;
    }

    const dt = k.dt();
    if (attackCooldown > 0) attackCooldown -= dt;

    // Fast O(1) player lookup
    const player = gameState.player || k.get("player")[0];
    let dx = 0;
    let dy = 0;
    let dist = Infinity;

    if (player && !player.isHurt && !player.isDead) {
      dx = player.pos.x - slime.pos.x;
      dy = player.pos.y - slime.pos.y;
      dist = Math.hypot(dx, dy);
    }

    switch (slime.state) {
      case "patrol": {
        slime.move(patrolSpeed * dir, 0);
        slime.flipX = dir < 0;

        if (slime.isGrounded() && slime.curAnim() !== "walk") {
          slime.play("walk");
        }

        // Boundary turnaround
        if (slime.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (slime.pos.x > startX + patrolRange) {
          dir = -1;
        }

        // Lunge check: player is nearby at roughly ground level
        const playerAtLungeLevel = dy >= -10 && dy <= 24;
        if (Math.abs(dx) <= attackDistance && playerAtLungeLevel && attackCooldown <= 0) {
          slime.state = "attack";
          attackCooldown = 1.8;
          dir = dx >= 0 ? 1 : -1;
          slime.flipX = dir < 0;
          slime.play("attack");

          // Short forward hop lunge
          slime.jump(160);
          slime.move(dir * 90, 0);

          k.wait(0.5, () => {
            if (!slime.isDead && slime.state === "attack") {
              slime.state = "patrol";
            }
          });
        }
        break;
      }

      case "attack": {
        slime.move(dir * 50, 0);
        break;
      }

      default:
        break;
    }
  });

  // Floor seam protection
  slime.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= slime.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Turn around on obstacles
  slime.onCollide("solid", (obj, col) => {
    if (obj.pos.y < slime.pos.y + 2) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        slime.flipX = dir < 0;
      }
    }
  });

  // Sword melee hit
  slime.onCollide("sword_hitbox", () => {
    if (slime.isDead) return;
    slime.die();
  });

  return slime;
}
