import { gameState } from "../state.js";

/**
 * Crea e inicializa un enemigo Slime avanzado con IA de Máquina de Estados Finitos completa:
 * - PATROL: Recorre la plataforma con saltos periódicos y gira en los bordes o muros.
 * - ALERT: Detecta al jugador en su radio de visión, muestra "!" y se prepara para perseguir.
 * - CHASE: Persigue al jugador a mayor velocidad mirando hacia su dirección.
 * - ATTACK: Embiste con impulso frontal cuando el jugador está a corta distancia.
 * - HURT: Sistema de 2 HP; recibe daño con retroceso y destello rojo.
 * - DIE: Se derrite en el suelo otorgando puntuación flotante.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} patrolRange - Distancia máxima de patrulla hacia izquierda/derecha
 * @returns {import("kaboom").GameObj} Objeto de juego del slime
 */
export function createSlime(k, x, y, patrolRange = 80) {
  let dir = -1;
  const startX = x;
  const patrolSpeed = 36;
  const chaseSpeed = 68;
  const attackLungeSpeed = 110;
  const visionDistance = 140;
  const attackDistance = 46;

  let hopTimer = 2.5 + Math.random() * 1.5;
  let attackCooldown = 0;

  const slime = k.add([
    k.sprite("slime", { anim: "walk" }),
    k.pos(x, y),
    // Hitbox ajustado al cuerpo del slime (arriba en -2, abajo en +12, al ras del suelo)
    k.area({ shape: new k.Rect(k.vec2(0, 5), 18, 14) }),
    k.body({ maxVelocity: 350 }),
    k.anchor("center"),
    k.z(5),
    "enemy",
    "slime",
    {
      hp: 2,
      maxHp: 2,
      state: "patrol", // "patrol" | "alert" | "chase" | "attack" | "hurt" | "die"
      isDead: false,
      isHurt: false,

      /**
       * Aplica daño al slime por un ataque de espada y gestiona el retroceso.
       * @param {number} [dmg=1] - Daño recibido
       * @param {number} [fromX=0] - Posición X del atacante para calcular la dirección del retroceso
       */
      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp -= dmg;
        k.play("hit");

        if (this.hp <= 0) {
          this.die();
        } else {
          this.isHurt = true;
          this.state = "hurt";
          this.play("hurt");

          // Retroceso en dirección opuesta al atacante
          const knockDir = this.pos.x >= fromX ? 1 : -1;
          this.jump(110);
          this.move(knockDir * 90, 0);

          // Destello rojo de impacto
          this.color = k.rgb(255, 110, 110);

          // Indicador flotante de daño
          const dmgPopup = k.add([
            k.text(`-${dmg}`, { font: "pressstart", size: 8 }),
            k.pos(this.pos.x, this.pos.y - 14),
            k.anchor("center"),
            k.color(255, 90, 90),
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
            // Se enfurece y persigue al jugador de inmediato
            this.state = "chase";
          });
        }
      },

      /**
       * Derrota fatal del slime (por pisotón o golpe letal) y suma +200 puntos.
       */
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = "die";

        // Sonido y recompensa de puntuación
        k.play("hit");
        gameState.addScore(200);

        // Texto flotante de puntuación (+200) en fuente pixel
        const popup = k.add([
          k.text("+200", { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 12),
          k.anchor("center"),
          k.color(255, 230, 100),
          k.z(25)
        ]);
        popup.onUpdate(() => {
          popup.pos.y -= 25 * k.dt();
        });
        k.wait(0.6, () => popup.destroy());

        // Reproduce la animación de derretimiento del spritesheet
        this.play("die");
        this.collisionIgnore = ["*"];
        k.wait(0.8, () => {
          this.destroy();
        });
      }
    }
  ]);

  // Muestra un indicador de alerta "!" sobre el slime al detectar al jugador
  function showAlertBubble() {
    const alert = k.add([
      k.text("!", { font: "pressstart", size: 9 }),
      k.pos(slime.pos.x, slime.pos.y - 18),
      k.anchor("center"),
      k.color(255, 60, 60),
      k.z(25)
    ]);
    alert.onUpdate(() => {
      alert.pos.x = slime.pos.x;
      alert.pos.y = slime.pos.y - 18;
    });
    k.wait(0.4, () => alert.destroy());
  }

  // --- Bucle principal de comportamiento de IA ---
  slime.onUpdate(() => {
    if (slime.isDead) return;

    // Seguridad: evita atravesar plataformas en caídas rápidas o picos de lag
    if (slime.vel && slime.vel.y > 350) {
      slime.vel.y = 350;
    }

    const dt = k.dt();
    if (attackCooldown > 0) attackCooldown -= dt;

    // Localiza al jugador en la escena (búsqueda rápida en O(1))
    const player = gameState.player || k.get("player")[0];
    let dx = 0;
    let dy = 0;
    let dist = Infinity;

    if (player && !player.isHurt) {
      dx = player.pos.x - slime.pos.x;
      dy = player.pos.y - slime.pos.y;
      dist = Math.hypot(dx, dy);
    }

    const playerInSight =
      player &&
      !player.isHurt &&
      Math.abs(dx) <= visionDistance &&
      Math.abs(dy) <= 50;

    switch (slime.state) {
      // 1. PATRULLA: Recorre la plataforma, da saltos ocasionales y vigila intrusos
      case "patrol": {
        slime.move(patrolSpeed * dir, 0);
        // El sprite en slime.png mira a la derecha por defecto; se voltea al ir a la izquierda (dir < 0)
        slime.flipX = dir < 0;

        if (slime.isGrounded() && slime.curAnim() !== "walk") {
          slime.play("walk");
        }

        // Giro al alcanzar los límites de patrulla
        if (slime.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (slime.pos.x > startX + patrolRange) {
          dir = -1;
        }

        // Salto natural periódico
        hopTimer -= dt;
        if (hopTimer <= 0 && slime.isGrounded()) {
          slime.jump(130);
          slime.play("jump");
          hopTimer = 3.0 + Math.random() * 1.5;
        }

        // Pasa a alerta si el jugador entra en el campo de visión
        if (playerInSight) {
          slime.state = "alert";
          slime.play("idle");
          showAlertBubble();
          k.wait(0.35, () => {
            if (!slime.isDead && slime.state === "alert") {
              slime.state = "chase";
            }
          });
        }
        break;
      }

      // 2. ALERTA: Breve pausa de reacción al descubrir al jugador
      case "alert": {
        if (player) {
          dir = dx >= 0 ? 1 : -1;
          slime.flipX = dir < 0;
        }
        break;
      }

      // 3. PERSECUCIÓN: Acorta distancia activamente hacia el jugador
      case "chase": {
        if (!player || dist > visionDistance * 1.6) {
          // El jugador escapó; vuelve a patrullar
          slime.state = "patrol";
          break;
        }

        // Orienta el movimiento hacia el jugador
        dir = dx >= 0 ? 1 : -1;
        slime.flipX = dir < 0;

        // Comprueba si está a distancia de embestida (solo si el jugador está a nivel del suelo)
        const playerAtLungeLevel = dy >= -10 && dy <= 24;
        if (Math.abs(dx) <= attackDistance && playerAtLungeLevel && attackCooldown <= 0) {
          slime.state = "attack";
          attackCooldown = 2.0;
          slime.play("attack");

          // Embestida agresiva hacia adelante con un salto bajo
          if (slime.isGrounded()) {
            slime.jump(135);
          }
          slime.move(dir * attackLungeSpeed, 0);

          k.wait(0.5, () => {
            if (!slime.isDead && slime.state === "attack") {
              slime.state = "chase";
            }
          });
          break;
        }

        // Avanza activamente hacia el jugador
        slime.move(chaseSpeed * dir, 0);

        if (slime.isGrounded() && slime.curAnim() !== "walk") {
          slime.play("walk");
        }
        break;
      }

      // 4. ATAQUE: Impulso frontal durante la mordida/embestida
      case "attack": {
        slime.move(dir * (chaseSpeed * 0.7), 0);
        break;
      }

      // 5. HERIDO: Retroceso gestionado por el temporizador en takeDamage()
      case "hurt": {
        break;
      }
    }
  });

  // Protección de uniones del suelo: evita desplazamientos horizontales en junturas planas
  slime.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= slime.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Colisión con obstáculos sólidos: invierte la dirección al chocar contra muros laterales
  slime.onCollide("solid", (obj, col) => {
    if (obj.pos.y < slime.pos.y + 4) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        slime.flipX = dir < 0;
      }
    }
  });

  // Reacciona al hitbox de la espada del jugador
  slime.onCollide("sword_hitbox", (hitbox) => {
    slime.takeDamage(1, hitbox.pos.x);
  });

  return slime;
}
