import { gameState } from "../state.js";

/**
 * Crea e inicializa un enemigo de élite Monstruo de Sangre (Blood Monster) para el nivel secreto.
 * 
 * Características:
 * - Coloso de 10 HP del paquete Tiny RPG Character Asset Pack.
 * - Barra de salud dinámica sobre la cabeza que muestra el HP actual (10/10).
 * - IA multi-ataque: zarpazos pesados (Attack01) y embestidas sangrientas (Attack02).
 * - Sus ataques cuerpo a cuerpo pueden bloquearse al 100% con el Escudo de Mili (Shift/C).
 * - El pisotón aéreo inflige 2 de daño crítico con rebote.
 * - Los golpes de espada infligen 1 de daño con destello de impacto y retroceso.
 * - Resuelve colisiones de forma segura al morir mediante collisionIgnore = ["*"].
 * - Seguimiento del jugador en O(1).
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} patrolRange - Distancia máxima de patrulla hacia izquierda/derecha
 * @param {Function} onDied - Callback opcional al derrotar a este monstruo
 * @returns {import("kaboom").GameObj} Objeto de juego del monstruo de sangre
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
    // Escala a una estatura imponente de élite (~36px de altura visual)
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

      /**
       * Aplica daño por ataques cuerpo a cuerpo de espada o pisotones aéreos.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Coordenada X del atacante para calcular el retroceso
       */
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

          // Retroceso físico al recibir impacto
          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(110);
          this.move(knockDir * 85, 0);

          // Destello carmesí de impacto
          this.color = k.rgb(255, 120, 120);

          // Indicador flotante de daño
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
            // Embiste hacia el jugador inmediatamente al quedar herido
            this.state = "chase";
          });
        }
      },

      /**
       * Ejecuta la secuencia de derrota, otorga +1000 puntos y oculta la barra de salud.
       */
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

        // Texto flotante de gran recompensa (+1000)
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
        // Ignora colisiones de forma segura sin eliminar componentes
        this.collisionIgnore = ["*"];

        // Oculta la barra de vida superior
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

  // --- Interfaz de Barra de Salud Superior ---
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

  // Actualiza el ancho y texto de la barra de salud
  function updateHpBar() {
    const pct = Math.max(0, monster.hp / monster.maxHp);
    hpFill.width = barWidth * pct;
    hpText.text = `${monster.hp}/10`;
  }

  // Sincroniza la barra de salud con la posición del monstruo
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

  // Marca de reacción de alerta "!" sobre el monstruo
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

  // --- Bucle de actualización de la Máquina de Estados de IA ---
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
      // 1. PATRULLA: Recorre la plataforma de un lado a otro
      case "patrol": {
        monster.move(patrolSpeed * dir, 0);
        monster.flipX = dir < 0;

        if (monster.isGrounded() && monster.curAnim() !== "walk") {
          monster.play("walk");
        }

        // Giro al alcanzar los límites de patrulla
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

      // 2. ALERTA: Pausa momentánea antes de cargar contra el jugador
      case "alert": {
        if (player) {
          dir = dx >= 0 ? 1 : -1;
          monster.flipX = dir < 0;
        }
        break;
      }

      // 3. PERSECUCIÓN: Acecha rápidamente al jugador
      case "chase": {
        if (!player || dist > visionDistance * 1.5) {
          monster.state = "patrol";
          break;
        }

        dir = dx >= 0 ? 1 : -1;
        monster.flipX = dir < 0;

        // En rango de ataque cuerpo a cuerpo
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

      // 4. ATAQUE: Pequeño impulso hacia adelante durante el golpe
      case "attack": {
        monster.move(dir * (chaseSpeed * 0.15), 0);
        break;
      }

      case "hurt": {
        break;
      }
    }
  });

  // Protección contra uniones del suelo
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
        monster.flipX = dir < 0;
      }
    }
  });

  // Recibe daño de la espada del jugador
  monster.onCollide("sword_hitbox", (hitbox) => {
    monster.takeDamage(1, hitbox.pos.x);
  });

  return monster;
}
