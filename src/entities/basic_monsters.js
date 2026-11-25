import { gameState } from "../state.js";

/**
 * Basic Monster Entities from the Basic Asset Pack:
 * - Bloodshot Eye: Aerial floating/hovering sentry with sinusoidal patrol (3 HP)
 * - Red Cap: Quick and aggressive subterranean skirmisher (3 HP)
 * - Crushing Cyclops: Mighty brute with dynamic overhead health bar (6 HP)
 * - Stone Troll: Heavy armored guardian with overhead health bar (5 HP)
 */

/**
 * Creates a floating Bloodshot Eye monster.
 * 
 * @param {import("kaboom").KaboomCtx} k 
 * @param {number} x 
 * @param {number} y 
 * @param {number} patrolRange 
 * @param {Function} onDied 
 */
export function createBloodshotEye(k, x, y, patrolRange = 85, onDied = null) {
  let dir = -1;
  const startX = x;
  const baseY = y;
  const speed = 48;

  const monster = k.add([
    k.sprite("bloodshot_eye", { anim: "move" }),
    k.pos(x, y),
    k.scale(1.6),
    k.area({ shape: new k.Rect(k.vec2(0, 0), 14, 14) }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "bloodshot_eye",
    {
      hp: 3,
      maxHp: 3,
      isDead: false,
      isHurt: false,

      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp = Math.max(0, this.hp - dmg);
        k.play("hit");

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.color = k.rgb(255, 100, 100);

          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.pos.x += knockDir * 12;

          // Damage popup
          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 7 }),
            k.pos(this.pos.x, this.pos.y - 14),
            k.anchor("center"),
            k.color(255, 80, 80),
            k.z(35)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.35, () => dmgPopup.destroy());

          k.wait(0.25, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
          });
        }
      },

      die() {
        if (this.isDead) return;
        this.isDead = true;
        k.play("hit");
        gameState.addScore(300);

        // Score popup
        const scorePopup = k.add([
          k.text("+300", { font: "pressstart", size: 8 }),
          k.pos(this.pos.x, this.pos.y - 14),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(35)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 25 * k.dt();
        });
        k.wait(0.5, () => scorePopup.destroy());

        this.collisionIgnore = ["*"];
        this.color = k.rgb(180, 40, 40);

        if (onDied) onDied(this);

        // Eyeball pop effect
        for (let i = 0; i < 5; i++) {
          const shard = k.add([
            k.rect(3, 3),
            k.pos(this.pos.x, this.pos.y),
            k.color(k.rgb(220, 40, 60)),
            k.anchor("center"),
            k.z(25)
          ]);
          const angle = Math.random() * Math.PI * 2;
          const spd = k.rand(40, 90);
          shard.onUpdate(() => {
            shard.pos.x += Math.cos(angle) * spd * k.dt();
            shard.pos.y += (Math.sin(angle) * spd + 100 * k.dt()) * k.dt();
            shard.opacity = Math.max(0, (shard.opacity ?? 1) - 3 * k.dt());
            if (shard.opacity <= 0) shard.destroy();
          });
        }

        k.wait(0.2, () => this.destroy());
      }
    }
  ]);

  monster.onUpdate(() => {
    if (monster.isDead || monster.isHurt) return;

    // Sine-wave hovering
    monster.pos.y = baseY + Math.sin(k.time() * 3.5 + startX) * 7;

    // Horizontal patrol
    monster.pos.x += dir * speed * k.dt();
    monster.flipX = dir > 0;

    if (dir < 0 && monster.pos.x <= startX - patrolRange) {
      dir = 1;
      monster.pos.x = startX - patrolRange;
    } else if (dir > 0 && monster.pos.x >= startX + patrolRange) {
      dir = -1;
      monster.pos.x = startX + patrolRange;
    }
  });

  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}

/**
 * Creates a nimble Red Cap goblin enemy.
 * 
 * @param {import("kaboom").KaboomCtx} k 
 * @param {number} x 
 * @param {number} y 
 * @param {number} patrolRange 
 * @param {Function} onDied 
 */
export function createRedCap(k, x, y, patrolRange = 75, onDied = null) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 52;
  const chaseSpeed = 82;

  const monster = k.add([
    k.sprite("red_cap", { anim: "move" }),
    k.pos(x, y),
    k.scale(1.6),
    k.area({ shape: new k.Rect(k.vec2(0, 1), 14, 14) }),
    k.body({ maxVelocity: 360 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "red_cap",
    {
      hp: 3,
      maxHp: 3,
      isDead: false,
      isHurt: false,

      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp = Math.max(0, this.hp - dmg);
        k.play("hit");

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.color = k.rgb(255, 120, 120);

          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(100);
          this.move(knockDir * 70, 0);

          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 7 }),
            k.pos(this.pos.x, this.pos.y - 16),
            k.anchor("center"),
            k.color(255, 70, 70),
            k.z(35)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.35, () => dmgPopup.destroy());

          k.wait(0.3, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
          });
        }
      },

      die() {
        if (this.isDead) return;
        this.isDead = true;
        k.play("hit");
        gameState.addScore(400);

        const scorePopup = k.add([
          k.text("+400", { font: "pressstart", size: 8 }),
          k.pos(this.pos.x, this.pos.y - 16),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(35)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 25 * k.dt();
        });
        k.wait(0.5, () => scorePopup.destroy());

        this.collisionIgnore = ["*"];
        if (onDied) onDied(this);

        k.wait(0.3, () => this.destroy());
      }
    }
  ]);

  monster.onUpdate(() => {
    if (monster.isDead || monster.isHurt) return;

    const player = gameState.player;
    let curSpeed = patrolSpeed;

    // Detect player in horizontal range
    if (player && !player.isDead) {
      const dx = player.pos.x - monster.pos.x;
      const dy = player.pos.y - monster.pos.y;
      if (Math.abs(dy) <= 30 && Math.abs(dx) <= 150) {
        dir = dx >= 0 ? 1 : -1;
        curSpeed = chaseSpeed;
      }
    }

    monster.move(dir * curSpeed, 0);
    monster.flipX = dir > 0;

    // Turn around at patrol limits
    if (dir < 0 && monster.pos.x <= startX - patrolRange) {
      dir = 1;
    } else if (dir > 0 && monster.pos.x >= startX + patrolRange) {
      dir = -1;
    }
  });

  // Safe floor collision
  monster.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= monster.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Turn around on wall collisions
  monster.onCollide("solid", (obj, col) => {
    if (obj.pos.y < monster.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        monster.flipX = dir > 0;
      }
    }
  });

  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}

/**
 * Creates an imposing Crushing Cyclops brute mini-boss with overhead health bar.
 * 
 * @param {import("kaboom").KaboomCtx} k 
 * @param {number} x 
 * @param {number} y 
 * @param {number} patrolRange 
 * @param {Function} onDied 
 */
export function createCrushingCyclops(k, x, y, patrolRange = 70, onDied = null) {
  let dir = -1;
  const startX = x;
  const speed = 40;

  const monster = k.add([
    k.sprite("crushing_cyclops", { anim: "move" }),
    k.pos(x, y),
    k.scale(2.2),
    k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 16) }),
    k.body({ maxVelocity: 340 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "crushing_cyclops",
    {
      hp: 6,
      maxHp: 6,
      isDead: false,
      isHurt: false,

      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp = Math.max(0, this.hp - dmg);
        k.play("hit");

        updateHpBar();

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.color = k.rgb(255, 120, 120);

          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(80);
          this.move(knockDir * 50, 0);

          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 24),
            k.anchor("center"),
            k.color(255, 60, 60),
            k.z(35)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.35, () => dmgPopup.destroy());

          k.wait(0.35, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
          });
        }
      },

      die() {
        if (this.isDead) return;
        this.isDead = true;
        k.play("hit");
        k.shake(5);
        gameState.addScore(800);

        const scorePopup = k.add([
          k.text("+800", { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 24),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(35)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 25 * k.dt();
        });
        k.wait(0.6, () => scorePopup.destroy());

        this.collisionIgnore = ["*"];
        hpBg.hidden = true;
        hpFill.hidden = true;
        hpText.hidden = true;

        if (onDied) onDied(this);

        k.wait(0.4, () => this.destroy());
      }
    }
  ]);

  // Overhead HP UI
  const barWidth = 26;
  const barHeight = 3.5;
  const hpBg = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x, y - 22),
    k.anchor("center"),
    k.color(30, 15, 15),
    k.z(20)
  ]);
  const hpFill = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x - barWidth / 2, y - 22),
    k.anchor("left"),
    k.color(255, 50, 50),
    k.z(21)
  ]);
  const hpText = k.add([
    k.text(`${monster.hp}/6`, { font: "pressstart", size: 5 }),
    k.pos(x, y - 28),
    k.anchor("center"),
    k.color(255, 220, 220),
    k.z(22)
  ]);

  function updateHpBar() {
    const pct = Math.max(0, monster.hp / monster.maxHp);
    hpFill.width = barWidth * pct;
    hpText.text = `${monster.hp}/6`;
  }

  monster.onUpdate(() => {
    // Keep HP bar attached to monster
    hpBg.pos.x = monster.pos.x;
    hpBg.pos.y = monster.pos.y - 22;
    hpFill.pos.x = monster.pos.x - barWidth / 2;
    hpFill.pos.y = monster.pos.y - 22;
    hpText.pos.x = monster.pos.x;
    hpText.pos.y = monster.pos.y - 28;

    if (monster.isDead || monster.isHurt) return;

    monster.move(dir * speed, 0);
    monster.flipX = dir > 0;

    if (dir < 0 && monster.pos.x <= startX - patrolRange) {
      dir = 1;
    } else if (dir > 0 && monster.pos.x >= startX + patrolRange) {
      dir = -1;
    }
  });

  monster.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= monster.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  monster.onCollide("solid", (obj, col) => {
    if (obj.pos.y < monster.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        monster.flipX = dir > 0;
      }
    }
  });

  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}

/**
 * Creates a Stone Troll guardian enemy with 5 HP.
 * 
 * @param {import("kaboom").KaboomCtx} k 
 * @param {number} x 
 * @param {number} y 
 * @param {number} patrolRange 
 * @param {Function} onDied 
 */
export function createStoneTroll(k, x, y, patrolRange = 50, onDied = null) {
  let dir = -1;
  const startX = x;
  const speed = 36;

  const monster = k.add([
    k.sprite("stone_troll", { anim: "move" }),
    k.pos(x, y),
    k.scale(2.0),
    k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 16) }),
    k.body({ maxVelocity: 340 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "stone_troll",
    {
      hp: 5,
      maxHp: 5,
      isDead: false,
      isHurt: false,

      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp = Math.max(0, this.hp - dmg);
        k.play("hit");

        updateHpBar();

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.color = k.rgb(255, 140, 140);

          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(80);
          this.move(knockDir * 45, 0);

          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 22),
            k.anchor("center"),
            k.color(255, 80, 80),
            k.z(35)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.35, () => dmgPopup.destroy());

          k.wait(0.35, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
          });
        }
      },

      die() {
        if (this.isDead) return;
        this.isDead = true;
        k.play("hit");
        gameState.addScore(600);

        const scorePopup = k.add([
          k.text("+600", { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 22),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(35)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 25 * k.dt();
        });
        k.wait(0.6, () => scorePopup.destroy());

        this.collisionIgnore = ["*"];
        hpBg.hidden = true;
        hpFill.hidden = true;
        hpText.hidden = true;

        if (onDied) onDied(this);

        k.wait(0.4, () => this.destroy());
      }
    }
  ]);

  const barWidth = 24;
  const barHeight = 3.5;
  const hpBg = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x, y - 20),
    k.anchor("center"),
    k.color(25, 25, 25),
    k.z(20)
  ]);
  const hpFill = k.add([
    k.rect(barWidth, barHeight),
    k.pos(x - barWidth / 2, y - 20),
    k.anchor("left"),
    k.color(240, 160, 40),
    k.z(21)
  ]);
  const hpText = k.add([
    k.text(`${monster.hp}/5`, { font: "pressstart", size: 5 }),
    k.pos(x, y - 26),
    k.anchor("center"),
    k.color(255, 230, 200),
    k.z(22)
  ]);

  function updateHpBar() {
    const pct = Math.max(0, monster.hp / monster.maxHp);
    hpFill.width = barWidth * pct;
    hpText.text = `${monster.hp}/5`;
  }

  monster.onUpdate(() => {
    hpBg.pos.x = monster.pos.x;
    hpBg.pos.y = monster.pos.y - 20;
    hpFill.pos.x = monster.pos.x - barWidth / 2;
    hpFill.pos.y = monster.pos.y - 20;
    hpText.pos.x = monster.pos.x;
    hpText.pos.y = monster.pos.y - 26;

    if (monster.isDead || monster.isHurt) return;

    monster.move(dir * speed, 0);
    monster.flipX = dir > 0;

    if (dir < 0 && monster.pos.x <= startX - patrolRange) {
      dir = 1;
    } else if (dir > 0 && monster.pos.x >= startX + patrolRange) {
      dir = -1;
    }
  });

  monster.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= monster.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  monster.onCollide("solid", (obj, col) => {
    if (obj.pos.y < monster.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        monster.flipX = dir > 0;
      }
    }
  });

  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}
