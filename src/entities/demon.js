import { gameState } from "../state.js";

/**
 * Crea e inicializa al Jefe Final Rey Demonio (Demon King) para el Nivel 3.
 * Cumple con Req-10: mecánicas de combate contra jefe, IA multifase, integración con barra de salud,
 * hitboxes de ataque personalizados, modo furia y secuencia de victoria.
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial (Arena del Trono)
 * @param {number} y - Coordenada Y inicial
 * @param {object} bossBar - Controlador obtenido de hud.createBossBar()
 * @param {Function} onDefeated - Callback invocado al derrotar al jefe
 * @returns {import("kaboom").GameObj} Objeto de juego del Rey Demonio
 */
export function createDemon(k, x, y, bossBar, onDefeated) {
  let dir = -1;
  const normalSpeed = 48;
  const enragedSpeed = 78;
  const attackDistance = 52;
  const visionDistance = 320;

  let attackCooldown = 1.0;
  let isAttacking = false;
  let activeHitbox = null;

  const demon = k.add([
    k.sprite("demon", { anim: "idle" }),
    k.pos(x, y),
    // Escala al demonio a 1.8x (~36px de altura visual, estatura imponente de jefe)
    k.scale(1.8),
    // Hitbox de precisión calibrado con los pies (y=+9 en cuadro 100x100) y los cuernos (y=-11)
    k.area({ shape: new k.Rect(k.vec2(2, -1), 20, 20) }),
    k.body({ maxVelocity: 400 }),
    k.anchor("center"),
    k.z(15),
    "enemy",
    "boss",
    "demon",
    {
      hp: 10,
      maxHp: 10,
      isEnraged: false,
      isDead: false,
      isHurt: false,

      /**
       * Aplica daño al jefe por ataques de espada o pisotón del jugador.
       * @param {number} [dmg=1] - Cantidad de daño recibido
       * @param {number} [fromX=0] - Coordenada X del atacante para calcular el retroceso
       */
      takeDamage(dmg = 1, fromX = 0) {
        if (this.isDead || this.isHurt) return;
        this.hp -= dmg;
        if (this.hp < 0) this.hp = 0;

        k.play("hit");

        // Actualiza la barra de salud del jefe en el HUD
        const bar = this.bossBar || bossBar;
        if (bar && bar.update) {
          bar.update(this.hp);
        }

        // Indicador flotante de daño
        const dmgPopup = k.add([
          k.text(`-${dmg}`, { font: "pressstart", size: 9 }),
          k.pos(this.pos.x, this.pos.y - 28),
          k.anchor("center"),
          k.color(255, dmg > 1 ? 60 : 220, 60),
          k.z(50)
        ]);
        dmgPopup.onUpdate(() => {
          dmgPopup.pos.y -= 35 * k.dt();
          dmgPopup.opacity = Math.max(0, (dmgPopup.opacity || 1) - 1.2 * k.dt());
          if (dmgPopup.opacity <= 0) dmgPopup.destroy();
        });

        // Verifica si ha sido derrotado
        if (this.hp <= 0) {
          this.die();
          return;
        }

        // Activa la Fase 2 (Modo Cólera) al bajar al 50% de vida o menos
        if (!this.isEnraged && this.hp <= this.maxHp / 2) {
          this.triggerEnrage();
        }

        // Estado de daño y breve invulnerabilidad
        this.isHurt = true;
        this.color = k.rgb(255, 80, 80);
        k.shake(4);

        // Resistencia al retroceso (el jefe apenas retrocede)
        const knockDir = this.pos.x >= fromX ? 1 : -1;
        this.move(knockDir * 40, 0);

        k.wait(0.35, () => {
          if (this.isDead) return;
          this.isHurt = false;
          this.color = this.isEnraged ? k.rgb(255, 140, 140) : k.rgb(255, 255, 255);
        });
      },

      /**
       * Activa la Fase 2: estado de cólera con mayor velocidad y agresividad.
       */
      triggerEnrage() {
        this.isEnraged = true;
        this.color = k.rgb(255, 120, 120);
        k.shake(8);

        // Aviso en pantalla de cambio de fase
        const roarBanner = k.add([
          k.text("¡EL REY DEMONIO ENTRA EN CÓLERA!", {
            font: "pressstart",
            size: 8
          }),
          k.pos(k.width() / 2, 85),
          k.anchor("center"),
          k.color(255, 60, 60),
          k.fixed(),
          k.z(100)
        ]);
        k.wait(2.5, () => roarBanner.destroy());
      },

      /**
       * Ejecuta el ataque de tajo frontal (attack1) hacia la posición objetivo.
       * @param {number} targetX - Coordenada X del jugador objetivo
       */
      performAttack1(targetX) {
        if (isAttacking || this.isDead || this.isHurt) return;
        isAttacking = true;
        dir = targetX < this.pos.x ? -1 : 1;
        this.flipX = dir < 0;
        this.play("attack1");

        // Genera el hitbox de daño durante el cuadro de impacto
        k.wait(0.2, () => {
          if (this.isDead) return;
          k.play("hit");

          activeHitbox = k.add([
            k.pos(this.pos.x + dir * 26, this.pos.y),
            k.area({ shape: new k.Rect(k.vec2(0, 0), 30, 26) }),
            k.anchor("center"),
            "demon_attack",
            { damage: 1, dir: dir }
          ]);

          k.wait(0.25, () => {
            if (activeHitbox) {
              activeHitbox.destroy();
              activeHitbox = null;
            }
          });
        });

        k.wait(0.65, () => {
          isAttacking = false;
          attackCooldown = this.isEnraged ? 0.7 : 1.3;
        });
      },

      /**
       * Ejecuta el golpe pesado contra el suelo (attack2) generando onda expansiva.
       * @param {number} targetX - Coordenada X del jugador objetivo
       */
      performAttack2(targetX) {
        if (isAttacking || this.isDead || this.isHurt) return;
        isAttacking = true;
        dir = targetX < this.pos.x ? -1 : 1;
        this.flipX = dir < 0;
        this.play("attack2");

        // El impacto contra el suelo provoca sacudida de cámara
        k.wait(0.3, () => {
          if (this.isDead) return;
          k.shake(this.isEnraged ? 7 : 5);
          k.play("hit");

          activeHitbox = k.add([
            k.pos(this.pos.x + dir * 32, this.pos.y + 4),
            k.area({ shape: new k.Rect(k.vec2(0, 0), 38, 22) }),
            k.anchor("center"),
            "demon_attack",
            { damage: 1, dir: dir }
          ]);

          k.wait(0.25, () => {
            if (activeHitbox) {
              activeHitbox.destroy();
              activeHitbox = null;
            }
          });
        });

        k.wait(0.75, () => {
          isAttacking = false;
          attackCooldown = this.isEnraged ? 0.9 : 1.6;
        });
      },

      /**
       * Ejecuta la secuencia de derrota del jefe, otorga +2500 puntos y llama a onDefeated.
       */
      die() {
        if (this.isDead) return;
        this.isDead = true;
        if (activeHitbox) {
          activeHitbox.destroy();
          activeHitbox = null;
        }

        this.play("death");
        this.collisionIgnore = ["*"];
        k.shake(14);
        k.play("win");
        gameState.addScore(2500);

        // Efecto de muerte lenta y llamada al callback de victoria
        this.color = k.rgb(180, 50, 50);

        k.wait(2.2, () => {
          if (onDefeated) {
            onDefeated();
          }
        });
      }
    }
  ]);

  // Bucle principal de la IA del jefe
  demon.onUpdate(() => {
    if (demon.isDead) return;

    // Seguridad: evita atravesar el suelo de la arena del trono por caída rápida
    if (demon.vel && demon.vel.y > 400) {
      demon.vel.y = 400;
    }

    if (attackCooldown > 0) {
      attackCooldown -= k.dt();
    }

    // Pulso de aura roja cuando está enfurecido
    if (demon.isEnraged) {
      const pulse = k.wave(180, 255, k.time() * 8);
      demon.color = k.rgb(255, pulse * 0.4, pulse * 0.4);
    }

    if (isAttacking || demon.isHurt) return;

    // Busca al jugador en la arena (búsqueda rápida en O(1))
    const player = gameState.player || k.get("player")[0];
    if (!player || player.isDead) {
      if (demon.curAnim() !== "idle") demon.play("idle");
      return;
    }

    const dist = Math.abs(player.pos.x - demon.pos.x);
    const vertDist = Math.abs(player.pos.y - demon.pos.y);

    // Solo entra en combate si el jugador está sobre o cerca de la plataforma del trono
    if (dist < visionDistance && vertDist < 120) {
      dir = player.pos.x < demon.pos.x ? -1 : 1;
      demon.flipX = dir < 0;

      // Dentro del rango de ataque
      if (dist <= attackDistance && attackCooldown <= 0) {
        // Alterna o elige aleatoriamente el patrón de ataque
        if (Math.random() < 0.55 || !demon.isEnraged) {
          demon.performAttack1(player.pos.x);
        } else {
          demon.performAttack2(player.pos.x);
        }
        return;
      }

      // Se acerca al jugador por la arena
      if (dist > attackDistance) {
        const currentSpeed = demon.isEnraged ? enragedSpeed : normalSpeed;
        demon.move(dir * currentSpeed, 0);

        if (demon.curAnim() !== "walk") {
          demon.play("walk");
        }
      } else {
        if (demon.curAnim() !== "idle") {
          demon.play("idle");
        }
      }
    } else {
      if (demon.curAnim() !== "idle") {
        demon.play("idle");
      }
    }
    // Mantiene al Rey Demonio estrictamente dentro de los límites de su trono (cols 6..22)
    const minThroneX = 160;
    const maxThroneX = 512;
    if (demon.pos.x < minThroneX) {
      demon.pos.x = minThroneX;
    } else if (demon.pos.x > maxThroneX) {
      demon.pos.x = maxThroneX;
    }
  });

  // Gestiona los impactos de la espada del jugador
  demon.onCollide("sword_hitbox", (hitbox) => {
    if (demon.isDead || demon.isHurt) return;
    const player = gameState.player || k.get("player")[0];
    const fromX = player ? player.pos.x : hitbox.pos.x;
    demon.takeDamage(1, fromX);
  });

  // Dirección inicial por defecto (mirando hacia la entrada del trono a la izquierda)
  demon.flipX = true;

  return demon;
}
