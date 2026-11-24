import { gameState } from "../state.js";

/**
 * Creates and initializes a Blood Monster elite enemy for the Secret Easter Egg.
 * 
 * Features:
 * - 10 HP behemoth from the Tiny RPG Character Asset Pack.
 * - Overhead dynamic Health Bar displaying current HP (10/10).
 * - Multi-attack AI: Heavy claw strikes (Attack01) and blood lunges (Attack02).
 * - Melee attacks can be blocked 100% with Mili's Shield (Shift/C).
 * - Stomp deals 2 critical damage with bounce.
 * - Sword strikes deal 1 damage with hit-flash & knockback.
 * - Safely resolves collisions with collisionIgnore = ["*"] on defeat.
 * - O(1) player tracking.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 * @param {number} x - Initial X coordinate
 * @param {number} y - Initial Y coordinate
 * @param {number} patrolRange - Max distance to wander left/right
 * @param {Function} onDied - Optional callback when this monster is defeated
 * @returns {import("kaboom").GameObj} The blood monster game object
 */
export function createBloodMonster(k, x, y, patrolRange = 70, onDied = null) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 38;
  const chaseSpeed = 65;
  const visionDistance = 220;
  const attackDistance = 44;

  let attackCooldown = 0;
  let activeHitbox = null;

  const monster = k.add([
    k.sprite("blood_monster", { anim: "walk" }),
    k.pos(x, y),
    // Scale to imposing elite stature (approx 36px visual height)
    k.scale(1.7),
    k.area({ shape: new k.Rect(k.vec2(0, -1), 22, 22) }),
    k.body({ maxVelocity: 380 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "blood_monster",
    {
      hp: 10,
      maxHp: 10,
      state: "patrol", // "patrol" | "alert" | "chase" | "attack" | "hurt" | "die"
      isDead: false,
      isHurt: false,

      // Take damage from sword melee attacks or aerial stomps
      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp = Math.max(0, this.hp - dmg);
        k.play("hit");

        if (activeHitbox) {
          activeHitbox.destroy();
          activeHitbox = null;
        }

        updateHpBar();

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.state = "hurt";
          this.play("hurt");

          // Knockback
          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(110);
          this.move(knockDir * 85, 0);

          // Crimson flash feedback
          this.color = k.rgb(255, 120, 120);

          // Damage indicator popup
          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 28),
            k.anchor("center"),
            k.color(255, 60, 60),
            k.z(35)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.4, () => dmgPopup.destroy());

          k.wait(0.35, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
            // Charge the player immediately when injured
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
        k.shake(6);
        gameState.addScore(1000);

        // Huge score award popup (+1000)
        const scorePopup = k.add([
          k.text("+1000", { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 24),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(35)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 30 * k.dt();
        });
        k.wait(0.7, () => scorePopup.destroy());

        this.play("death");
        // Safely ignore all collisions without deleting component data
        this.collisionIgnore = ["*"];

        // Hide health bar
        hpBg.hidden = true;
        hpFill.hidden = true;
        hpText.hidden = true;

        if (onDied) {
          onDied(this);
        }

        k.wait(0.8, () => {
          this.destroy();
        });
      }
    }
  ]);

  // --- Overhead Health Bar UI ---
  const barWidth = 32;
  const barHeight = 4;
  const hpBg = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x, y - 26),
    k.anchor("center"),
    k.color(30, 10, 10),
    k.opacity(0.85),
    k.z(20)
  ]);

  const hpFill = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x - barWidth / 2, y - 26),
    k.anchor("left"),
    k.color(255, 40, 40),
    k.z(21)
  ]);

  const hpText = k.add([
    k.text(`${monster.hp}/10`, { font: "pressstart", size: 5.5 }),
    k.pos(x, y - 32),
    k.anchor("center"),
    k.color(255, 200, 200),
    k.z(22)
  ]);

  function updateHpBar() {
    const pct = Math.max(0, monster.hp / monster.maxHp);
    hpFill.width = barWidth * pct;
    hpText.text = `${monster.hp}/10`;
  }

  // Synchronize health bar with monster position
  hpBg.onUpdate(() => {
    if (monster.isDead) return;
    hpBg.pos.x = monster.pos.x;
    hpBg.pos.y = monster.pos.y - 26;
    hpFill.pos.x = monster.pos.x - barWidth / 2;
    hpFill.pos.y = monster.pos.y - 26;
    hpText.pos.x = monster.pos.x;
    hpText.pos.y = monster.pos.y - 32;
  });

  monster.onDestroy(() => {
    hpBg.destroy();
    hpFill.destroy();
    hpText.destroy();
  });

  // Alert reaction mark
  function showAlertBubble() {
    const alertBox = k.add([
      k.rect(14, 14, { radius: 3 }),
      k.pos(monster.pos.x, monster.pos.y - 24),
      k.anchor("center"),
      k.color(220, 30, 30),
      k.z(30)
    ]);
    const alertTxt = k.add([
      k.text("!", { font: "pressstart", size: 9 }),
      k.pos(monster.pos.x, monster.pos.y - 24),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.z(31)
    ]);

    alertBox.onUpdate(() => {
      alertBox.pos.x = monster.pos.x;
      alertBox.pos.y = monster.pos.y - 24;
      alertTxt.pos.x = monster.pos.x;
      alertTxt.pos.y = monster.pos.y - 24;
    });

    k.wait(0.35, () => {
      alertBox.destroy();
      alertTxt.destroy();
    });
  }

  // --- AI State Machine Update Loop ---
  monster.onUpdate(() => {
    if (monster.isDead) return;

    if (monster.vel && monster.vel.y > 380) {
      monster.vel.y = 380;
    }

    const dt = k.dt();
    if (attackCooldown > 0) {
      attackCooldown -= dt;
    }

    const player = gameState.player || k.get("player")[0];
    let dx = 0;
    let dy = 0;
    let dist = Infinity;

    if (player && !player.isHurt && !player.isDead) {
      dx = player.pos.x - monster.pos.x;
      dy = player.pos.y - monster.pos.y;
      dist = Math.hypot(dx, dy);
    }

    const playerInSight =
      player &&
      !player.isHurt &&
      !player.isDead &&
      Math.abs(dx) <= visionDistance &&
      Math.abs(dy) <= 60;

    switch (monster.state) {
      // 1. PATROL: Wander platform back and forth
      case "patrol": {
        monster.move(patrolSpeed * dir, 0);
        monster.flipX = dir < 0;

        if (monster.isGrounded() && monster.curAnim() !== "walk") {
          monster.play("walk");
        }

        // Boundary turnaround
        if (monster.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (monster.pos.x > startX + patrolRange) {
          dir = -1;
        }

        if (playerInSight) {
          monster.state = "alert";
          monster.play("idle");
          showAlertBubble();
          k.wait(0.3, () => {
            if (!monster.isDead && monster.state === "alert") {
              monster.state = "chase";
            }
          });
        }
        break;
      }

      // 2. ALERT: Momentary pause before charging
      case "alert": {
        if (player) {
          dir = dx >= 0 ? 1 : -1;
          monster.flipX = dir < 0;
        }
        break;
      }

      // 3. CHASE: Rapidly stalk player
      case "chase": {
        if (!player || dist > visionDistance * 1.5) {
          monster.state = "patrol";
          break;
        }

        dir = dx >= 0 ? 1 : -1;
        monster.flipX = dir < 0;

        // In melee attack range
        if (Math.abs(dx) <= attackDistance && Math.abs(dy) <= 24 && attackCooldown <= 0) {
          monster.state = "attack";
          attackCooldown = 1.6;

          const animChoice = Math.random() > 0.5 ? "attack1" : "attack2";
          monster.play(animChoice);

          const attackOffsetX = dir * 20;
          k.wait(0.2, () => {
            if (monster.isDead || monster.state !== "attack") return;
            if (activeHitbox) {
              activeHitbox.destroy();
              activeHitbox = null;
            }
            const clawHitbox = k.add([
              k.pos(monster.pos.x + attackOffsetX, monster.pos.y),
              k.area({ shape: new k.Rect(k.vec2(0), 24, 24) }),
              k.anchor("center"),
              "blood_monster_attack"
            ]);
            activeHitbox = clawHitbox;
            k.wait(0.25, () => {
              if (activeHitbox === clawHitbox) {
                clawHitbox.destroy();
                activeHitbox = null;
              }
            });
          });

          k.wait(0.65, () => {
            if (!monster.isDead && monster.state === "attack") {
              monster.state = "chase";
            }
          });
          break;
        }

        monster.move(chaseSpeed * dir, 0);
        if (monster.isGrounded() && monster.curAnim() !== "walk") {
          monster.play("walk");
        }
        break;
      }

      // 4. ATTACK: Short forward momentum during strike
      case "attack": {
        monster.move(dir * (chaseSpeed * 0.15), 0);
        break;
      }

      case "hurt": {
        break;
      }
    }
  });

  // Floor seam protection
  monster.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= monster.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Turn around on solid wall obstacles
  monster.onCollide("solid", (obj, col) => {
    if (obj.pos.y < monster.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        monster.flipX = dir < 0;
      }
    }
  });

  // Hurt from player sword melee attack
  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}
