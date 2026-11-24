import { gameState } from "../state.js";

/**
 * Creates and initializes a Skeleton Warrior enemy for Level 3 (The Tower).
 * 
 * Features:
 * - 2 HP undead warrior wielding an ancient bone sword.
 * - State machine: PATROL, ALERT, CHASE, ATTACK, HURT, DIE.
 * - Slashes forward with sword when player enters melee range.
 * - Can be blocked with Mili's Shield (Shift/C) or struck with sword.
 * - Stomp deals 2 critical damage (instant crush).
 * - Fast O(1) player tracking without scene tree allocations.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 * @param {number} x - Initial X coordinate
 * @param {number} y - Initial Y coordinate
 * @param {number} patrolRange - Max distance to wander left/right
 * @returns {import("kaboom").GameObj} The skeleton game object
 */
export function createSkeleton(k, x, y, patrolRange = 60) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 36;
  const chaseSpeed = 58;
  const visionDistance = 150;
  const attackDistance = 34;

  let attackCooldown = 0;
  let activeHitbox = null;

  const skeleton = k.add([
    k.sprite("skeleton_base", { anim: "walk" }),
    k.pos(x, y),
    // Scale skeleton to match 24px tile scale (around 25px visual height)
    k.scale(0.95),
    // Hitbox aligned to feet (frame is 64x64, center is (32, 32))
    k.area({ shape: new k.Rect(k.vec2(1, 2), 16, 26) }),
    k.body({ maxVelocity: 350 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "skeleton",
    {
      hp: 2,
      maxHp: 2,
      state: "patrol", // "patrol" | "alert" | "chase" | "attack" | "hurt" | "die"
      isDead: false,
      isHurt: false,

      // Take damage from player melee attacks
      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp -= dmg;
        k.play("hit");

        if (activeHitbox) {
          activeHitbox.destroy();
          activeHitbox = null;
        }

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.state = "hurt";
          this.play("hurt");

          // Knockback
          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(110);
          this.move(knockDir * 90, 0);

          // Bone white flash feedback
          this.color = k.rgb(255, 120, 120);

          // Damage indicator popup
          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 18),
            k.anchor("center"),
            k.color(255, 100, 100),
            k.z(25)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.4, () => dmgPopup.destroy());

          k.wait(0.35, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
            this.state = "chase";
          });
        }
      },

      // Defeat sequence
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = "die";
        if (activeHitbox) {
          activeHitbox.destroy();
          activeHitbox = null;
        }

        k.play("hit");
        gameState.addScore(250);

        // Score award popup
        const scorePopup = k.add([
          k.text("+250", { font: "pressstart", size: 8 }),
          k.pos(this.pos.x, this.pos.y - 18),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(30)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 30 * k.dt();
        });
        k.wait(0.7, () => scorePopup.destroy());

        this.play("die");
        // Safely ignore all collisions without deleting component data
        this.collisionIgnore = ["*"];

        k.wait(0.7, () => {
          this.destroy();
        });
      }
    }
  ]);

  // Shows an "!" alert balloon over the skeleton when spotting player
  function showAlertBubble() {
    const alertBox = k.add([
      k.rect(14, 14, { radius: 3 }),
      k.pos(skeleton.pos.x, skeleton.pos.y - 24),
      k.anchor("center"),
      k.color(240, 60, 60),
      k.z(40)
    ]);
    const alertTxt = k.add([
      k.text("!", { font: "pressstart", size: 9 }),
      k.pos(skeleton.pos.x, skeleton.pos.y - 24),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.z(41)
    ]);

    alertBox.onUpdate(() => {
      alertBox.pos.x = skeleton.pos.x;
      alertBox.pos.y = skeleton.pos.y - 24;
      alertTxt.pos.x = skeleton.pos.x;
      alertTxt.pos.y = skeleton.pos.y - 24;
    });

    k.wait(0.4, () => {
      alertBox.destroy();
      alertTxt.destroy();
    });
  }

  // Skeleton AI State Machine Update Loop
  skeleton.onUpdate(() => {
    if (skeleton.isDead) return;

    // Safety: clamp falling speed to prevent physics tunneling
    if (skeleton.vel && skeleton.vel.y > 350) {
      skeleton.vel.y = 350;
    }

    const dt = k.dt();
    if (attackCooldown > 0) {
      attackCooldown -= dt;
    }

    // Fast O(1) player lookup
    const player = gameState.player || k.get("player")[0];
    let dx = 0;
    let dy = 0;
    let dist = Infinity;

    if (player && !player.isHurt && !player.isDead) {
      dx = player.pos.x - skeleton.pos.x;
      dy = player.pos.y - skeleton.pos.y;
      dist = Math.hypot(dx, dy);
    }

    const playerInSight =
      player &&
      !player.isHurt &&
      !player.isDead &&
      Math.abs(dx) <= visionDistance &&
      Math.abs(dy) <= 50;

    switch (skeleton.state) {
      // 1. PATROL: Wander platform back and forth
      case "patrol": {
        skeleton.move(patrolSpeed * dir, 0);
        skeleton.flipX = dir < 0;

        if (skeleton.isGrounded() && skeleton.curAnim() !== "walk") {
          skeleton.play("walk");
        }

        // Boundary turnaround
        if (skeleton.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (skeleton.pos.x > startX + patrolRange) {
          dir = -1;
        }

        if (playerInSight) {
          skeleton.state = "alert";
          skeleton.play("idle");
          showAlertBubble();
          k.wait(0.3, () => {
            if (!skeleton.isDead && skeleton.state === "alert") {
              skeleton.state = "chase";
            }
          });
        }
        break;
      }

      // 2. ALERT: Brief pause before charging
      case "alert": {
        if (player) {
          dir = dx >= 0 ? 1 : -1;
          skeleton.flipX = dir < 0;
        }
        break;
      }

      // 3. CHASE: Advance towards player
      case "chase": {
        if (!player || dist > visionDistance * 1.5) {
          skeleton.state = "patrol";
          break;
        }

        dir = dx >= 0 ? 1 : -1;
        skeleton.flipX = dir < 0;

        // In melee attack range
        if (Math.abs(dx) <= attackDistance && Math.abs(dy) <= 24 && attackCooldown <= 0) {
          skeleton.state = "attack";
          attackCooldown = 1.4;
          skeleton.play("attack");

          const attackOffsetX = dir * 18;
          k.wait(0.2, () => {
            if (skeleton.isDead || skeleton.state !== "attack") return;
            if (activeHitbox) {
              activeHitbox.destroy();
              activeHitbox = null;
            }
            const swordHitbox = k.add([
              k.pos(skeleton.pos.x + attackOffsetX, skeleton.pos.y),
              k.area({ shape: new k.Rect(k.vec2(0), 18, 18) }),
              k.anchor("center"),
              "skeleton_attack"
            ]);
            activeHitbox = swordHitbox;
            k.wait(0.2, () => {
              if (activeHitbox === swordHitbox) {
                swordHitbox.destroy();
                activeHitbox = null;
              }
            });
          });

          k.wait(0.6, () => {
            if (!skeleton.isDead && skeleton.state === "attack") {
              skeleton.state = "chase";
            }
          });
          break;
        }

        skeleton.move(chaseSpeed * dir, 0);
        if (skeleton.isGrounded() && skeleton.curAnim() !== "walk") {
          skeleton.play("walk");
        }
        break;
      }

      // 4. ATTACK: Short pause during swing
      case "attack": {
        skeleton.move(dir * (chaseSpeed * 0.15), 0);
        break;
      }

      case "hurt": {
        break;
      }
    }
  });

  // Floor seam protection
  skeleton.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= skeleton.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Turn around on solid wall obstacles
  skeleton.onCollide("solid", (obj, col) => {
    if (obj.pos.y < skeleton.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        skeleton.flipX = dir < 0;
      }
    }
  });

  // Hurt from player sword melee attack
  skeleton.onCollide("sword_hitbox", (hitbox) => {
    skeleton.takeDamage(1, hitbox.pos.x);
  });

  return skeleton;
}
