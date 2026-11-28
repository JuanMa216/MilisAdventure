import { gameState } from "../state.js";

/**
 * Entidades de Monstruos Básicos del Basic Asset Pack:
 * - Bloodshot Eye (Ojo Inyectado en Sangre): Centinela aéreo flotante con patrulla sinusoidal (3 HP)
 * - Red Cap (Gorro Rojo): Hostigador subterráneo rápido y agresivo (3 HP)
 * - Crushing Cyclops (Cíclope Aplastador): Bruto poderoso con barra de salud dinámica superior (6 HP)
 * - Stone Troll (Trol de Piedra): Guardián acorazado pesado con barra de salud superior (5 HP)
 */

/**
 * Crea un monstruo flotante Ojo Inyectado en Sangre (Bloodshot Eye).
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} [patrolRange=85] - Distancia máxima de patrulla horizontal
 * @param {Function|null} [onDied=null] - Callback opcional al morir el monstruo
 * @returns {import("kaboom").GameObj} Objeto de juego del monstruo
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

      /**
       * Aplica daño al ojo flotante y muestra el texto de daño y retroceso.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Posición X del atacante para calcular la dirección del empuje
       */
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

          // Indicador flotante de daño
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

      /**
       * Ejecuta la muerte del monstruo, otorga +300 puntos y genera partículas de dispersión.
       */
      die() {
        if (this.isDead) return;
        this.isDead = true;
        k.play("hit");
        gameState.addScore(300);

        // Texto flotante de puntuación (+300)
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

        // Efecto de estallido con fragmentos
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

    // Flotación sinusoidal vertical
    monster.pos.y = baseY + Math.sin(k.time() * 3.5 + startX) * 7;

    // Patrulla horizontal
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
 * Crea un enemigo ágil trasgo Gorro Rojo (Red Cap).
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} [patrolRange=75] - Distancia máxima de patrulla
 * @param {Function|null} [onDied=null] - Callback opcional al morir el monstruo
 * @returns {import("kaboom").GameObj} Objeto de juego del monstruo
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

      /**
       * Aplica daño al trasgo con salto de retroceso e indicador flotante.
       * @param {number} [dmg=1] - Daño recibido
       * @param {number} [fromX=0] - Posición X del atacante
       */
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

      /**
       * Ejecuta la derrota del trasgo, otorga +400 puntos y destruye la entidad.
       */
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

    // Detecta al jugador en rango horizontal
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

    // Da la vuelta al alcanzar los límites de patrulla
    if (dir < 0 && monster.pos.x <= startX - patrolRange) {
      dir = 1;
    } else if (dir > 0 && monster.pos.x >= startX + patrolRange) {
      dir = -1;
    }
  });

  // Colisión segura con el suelo (evita desplazamientos laterales en uniones)
  monster.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= monster.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Da la vuelta al chocar contra muros sólidos
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
 * Crea un imponente minijefe Cíclope Aplastador (Crushing Cyclops) con barra de salud superior.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} [patrolRange=70] - Distancia máxima de patrulla
 * @param {Function|null} [onDied=null] - Callback opcional al morir el monstruo
 * @returns {import("kaboom").GameObj} Objeto de juego del cíclope
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

      /**
       * Aplica daño al cíclope, actualiza su barra de vida superior y aplica retroceso.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Posición X del atacante
       */
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

      /**
       * Ejecuta la derrota del cíclope, sacude la cámara, otorga +800 puntos y oculta su barra de salud.
       */
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

  // Barra de salud superior sobre el monstruo
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
    // Mantiene la barra de salud anclada sobre el monstruo
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
 * Crea un enemigo guardián Trol de Piedra (Stone Troll) con 5 HP y barra de salud superior.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} [patrolRange=50] - Distancia máxima de patrulla
 * @param {Function|null} [onDied=null] - Callback opcional al morir el monstruo
 * @returns {import("kaboom").GameObj} Objeto de juego del trol de piedra
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

      /**
       * Aplica daño al trol de piedra, actualiza su barra de vida superior y aplica retroceso.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Posición X del atacante
       */
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

      /**
       * Ejecuta la derrota del trol de piedra, otorga +600 puntos y oculta su barra de salud.
       */
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
