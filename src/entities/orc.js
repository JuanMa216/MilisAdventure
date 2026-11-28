import { gameState } from "../state.js";

/**
 * Crea e inicializa un enemigo Guerrero Orco para el Nivel 2 (Cavernas).
 * 
 * Características:
 * - Enemigo de élite resistente con 3 HP y ataque pesado de garrote/hacha.
 * - Máquina de estados: PATROL, ALERT, CHASE, ATTACK, HURT, DIE.
 * - Sus ataques pueden bloquearse con el Escudo (Shift/C) o responderse con la espada.
 * - El pisotón aéreo inflige 2 de daño crítico.
 * - Caja de colisión calibrada (24px de altura, sin hundirse en el suelo).
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} patrolRange - Distancia máxima de patrulla hacia izquierda/derecha
 * @returns {import("kaboom").GameObj} Objeto de juego del orco
 */
export function createOrc(k, x, y, patrolRange = 70) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 32;
  const chaseSpeed = 54;
  const visionDistance = 140;
  const attackDistance = 38;

  let attackCooldown = 0;
  let activeHitbox = null;

  const orc = k.add([
    k.sprite("orc", { anim: "walk" }),
    k.pos(x, y),
    // Escala al orco a 24px (1 bloque de mapa de alto, igual que Mili)
    k.scale(24 / 16),
    // Hitbox de precisión alineado con los pies (y=+7 en cuadro 100x100) y la cabeza (y=-9)
    k.area({ shape: new k.Rect(k.vec2(0, -1), 16, 16) }),
    k.body({ maxVelocity: 350 }),
    k.anchor("center"),
    k.z(6),
    "enemy",
    "orc",
    {
      hp: 3,
      maxHp: 3,
      state: "patrol", // "patrol" | "alert" | "chase" | "attack" | "hurt" | "die"
      isDead: false,
      isHurt: false,

      /**
       * Aplica daño al orco por ataques cuerpo a cuerpo o pisotones del jugador.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Coordenada X del atacante para calcular el retroceso
       */
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

          // Retroceso físico al recibir impacto
          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(100);
          this.move(knockDir * 80, 0);

          // Destello rojo de impacto
          this.color = k.rgb(255, 110, 110);

          // Indicador flotante de daño
          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 16),
            k.anchor("center"),
            k.color(255, 90, 90),
            k.z(25)
          ]);
          dmgPopup.onUpdate(() => {
            dmgPopup.pos.y -= 25 * k.dt();
          });
          k.wait(0.4, () => dmgPopup.destroy());

          k.wait(0.4, () => {
            if (this.isDead) return;
            this.color = k.rgb(255, 255, 255);
            this.isHurt = false;
            // Enfurecido: persigue al jugador de inmediato
            this.state = "chase";
          });
        }
      },

      /**
       * Ejecuta la derrota del orco, muestra la puntuación y destruye la entidad.
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
        gameState.addScore(300);

        // Texto flotante de puntuación (+300)
        const scorePopup = k.add([
          k.text("+300", { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 16),
          k.anchor("center"),
          k.color(255, 230, 80),
          k.z(30)
        ]);
        scorePopup.onUpdate(() => {
          scorePopup.pos.y -= 30 * k.dt();
        });
        k.wait(0.7, () => scorePopup.destroy());

        this.play("death");
        // Ignora colisiones futuras de forma segura sin eliminar componentes (evita corromper la grilla espacial)
        this.collisionIgnore = ["*"];

        k.wait(0.6, () => {
          this.destroy();
        });
      }
    }
  ]);

  // Muestra un globo de alerta "!" sobre el orco al detectar al jugador
  function showAlertBubble() {
    const alertBox = k.add([
      k.rect(14, 14, { radius: 3 }),
      k.pos(orc.pos.x, orc.pos.y - 22),
      k.anchor("center"),
      k.color(240, 40, 50),
      k.z(20)
    ]);

    const alertMark = k.add([
      k.text("!", { font: "pressstart", size: 9 }),
      k.pos(orc.pos.x, orc.pos.y - 22),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.z(21)
    ]);

    k.wait(0.4, () => {
      alertBox.destroy();
      alertMark.destroy();
    });
  }

  // Bucle de actualización de IA
  orc.onUpdate(() => {
    if (orc.isDead) return;

    // Seguridad: evita atravesar plataformas en caídas rápidas o picos de lag
    if (orc.vel && orc.vel.y > 350) {
      orc.vel.y = 350;
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
      dx = player.pos.x - orc.pos.x;
      dy = player.pos.y - orc.pos.y;
      dist = Math.hypot(dx, dy);
    }

    const playerInSight =
      player &&
      !player.isHurt &&
      !player.isDead &&
      Math.abs(dx) <= visionDistance &&
      Math.abs(dy) <= 60;

    switch (orc.state) {
      // 1. PATRULLA: Camina por la plataforma
      case "patrol": {
        orc.move(patrolSpeed * dir, 0);
        // El sprite base mira a la derecha; se invierte al moverse a la izquierda (dir < 0)
        orc.flipX = dir < 0;

        if (orc.isGrounded() && orc.curAnim() !== "walk") {
          orc.play("walk");
        }

        // Giro al llegar a los límites de patrulla
        if (orc.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (orc.pos.x > startX + patrolRange) {
          dir = -1;
        }

        if (playerInSight) {
          orc.state = "alert";
          orc.play("idle");
          showAlertBubble();
          k.wait(0.35, () => {
            if (!orc.isDead && orc.state === "alert") {
              orc.state = "chase";
            }
          });
        }
        break;
      }

      // 2. ALERTA: Pausa breve de sorpresa antes de perseguir
      case "alert": {
        if (player) {
          dir = dx >= 0 ? 1 : -1;
          orc.flipX = dir < 0;
        }
        break;
      }

      // 3. PERSECUCIÓN: Persigue activamente al jugador
      case "chase": {
        if (!player || dist > visionDistance * 1.6) {
          orc.state = "patrol";
          break;
        }

        dir = dx >= 0 ? 1 : -1;
        orc.flipX = dir < 0;

        // Comprueba si está a distancia de golpe cuerpo a cuerpo
        if (Math.abs(dx) <= attackDistance && Math.abs(dy) <= 24 && attackCooldown <= 0) {
          orc.state = "attack";
          attackCooldown = 1.8;
          orc.play("attack");

          // Golpe frontal con garrote/hacha
          const attackOffsetX = dir * 18;
          k.wait(0.2, () => {
            if (orc.isDead || orc.state !== "attack") return;
            if (activeHitbox) {
              activeHitbox.destroy();
              activeHitbox = null;
            }
            const clubHitbox = k.add([
              k.pos(orc.pos.x + attackOffsetX, orc.pos.y),
              k.area({ shape: new k.Rect(k.vec2(0), 20, 20) }),
              k.anchor("center"),
              "orc_attack"
            ]);
            activeHitbox = clubHitbox;
            k.wait(0.2, () => {
              if (activeHitbox === clubHitbox) {
                clubHitbox.destroy();
                activeHitbox = null;
              }
            });
          });

          k.wait(0.6, () => {
            if (!orc.isDead && orc.state === "attack") {
              orc.state = "chase";
            }
          });
          break;
        }

        orc.move(chaseSpeed * dir, 0);
        if (orc.isGrounded() && orc.curAnim() !== "walk") {
          orc.play("walk");
        }
        break;
      }

      // 4. ATAQUE: Avance breve durante el golpe
      case "attack": {
        orc.move(dir * (chaseSpeed * 0.2), 0);
        break;
      }

      case "hurt": {
        break;
      }
    }
  });

  // Protección de uniones del suelo: evita desplazamientos horizontales en junturas planas
  orc.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= orc.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Da la vuelta al chocar lateralmente contra muros sólidos a la altura del cuerpo/cabeza
  orc.onCollide("solid", (obj, col) => {
    if (obj.pos.y < orc.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        orc.flipX = dir < 0;
      }
    }
  });

  // Recibe daño del hitbox de espada del jugador
  orc.onCollide("sword_hitbox", (hitbox) => {
    orc.takeDamage(1, hitbox.pos.x);
  });

  return orc;
}
