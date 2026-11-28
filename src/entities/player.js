import { gameState } from "../state.js";

/**
 * Crea e inicializa al personaje jugador (Mili).
 * 
 * Incluye:
 * - Movimiento fluido y doble salto (Req-5)
 * - Ataque cuerpo a cuerpo con espada
 * - Mecánica táctica de bloqueo con escudo (Req-5)
 * - Sistema de daño, invulnerabilidad y vidas (Req-4)
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} [x=100] - Coordenada X inicial
 * @param {number} [y=200] - Coordenada Y inicial
 * @param {boolean} [allowDoubleJump=true] - Habilita la mecánica de doble salto
 * @param {number|null} [maxFallY=null] - Límite vertical opcional de caída al vacío
 * @returns {import("kaboom").GameObj} Objeto de juego del jugador
 */
export function createPlayer(k, x = 100, y = 200, allowDoubleJump = true, maxFallY = null) {
  let activeSwordHitbox = null;

  const player = k.add([
    k.sprite("player", { anim: "idle" }),
    k.pos(x, y),
    // Escala al caballero para que su altura coincida con 1 bloque del mapa (24px)
    // El sprite original en mili.png mide 21px de alto (casco y=39 a botas y=60).
    // Factor de escala: 24 / 21 = 8 / 7 (~1.143). 21 * (24/21) = 24px exactos.
    k.scale(24 / 21),
    // Hitbox de precisión alineado con los pies (y=+12 en cuadro 96x96) y casco (y=-9 desde el centro):
    // Centro del rectángulo y = 1.5, alto = 21 -> arriba = -9, abajo = +12.
    // Al escalar por 24/21, la altura total es 24px y las botas apoyan al 100% sobre el bloque.
    k.area({ shape: new k.Rect(k.vec2(0, 1.5), 14, 21) }),
    k.body({ jumpForce: 380, maxVelocity: 420 }),
    k.anchor("center"),
    k.z(10),
    "player",
    {
      speed: 160,
      canDoubleJump: allowDoubleJump,
      hasDoubleJumped: false,
      isAttacking: false,
      isBlocking: false,
      isHurt: false,
      isDead: false,
      invulnerable: false,
      facing: "right",
      prevBottom: y + 13.7,
      prevY: y,

      /**
       * Ejecuta la muerte instantánea del jugador por caída al vacío o al quedarse sin vidas.
       */
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.invulnerable = true;
        this.isHurt = true;
        this.isAttacking = false;
        if (activeSwordHitbox) {
          activeSwordHitbox.destroy();
          activeSwordHitbox = null;
        }
        this.collisionIgnore = ["*"];
        gameState.lives = 0;
        k.play("hit");

        if (this.curAnim() !== "death") {
          try {
            this.play("death");
          } catch (e) {}
        }

        k.wait(0.5, () => {
          k.go("gameover");
        });
      },

      /**
       * Gestiona la recepción de daño, el bloqueo con escudo (Req-5) y la invulnerabilidad (Req-4).
       * @param {number} [knockbackDir=0] - Dirección horizontal del empuje (-1 izquierda, 1 derecha)
       */
      receiveDamage(knockbackDir = 0) {
        if (this.invulnerable || this.isHurt || this.isDead) return;

        // --- Defensa con Escudo (Req-5) ---
        // Si está bloqueando y el ataque viene de frente, absorbe el 100% del daño
        const isFacingAttacker =
          (this.facing === "right" && knockbackDir < 0) ||
          (this.facing === "left" && knockbackDir > 0);

        if (this.isBlocking && isFacingAttacker) {
          k.play("spring"); // Sonido metálico de bloqueo
          this.move(knockbackDir * 60, 0); // Empuje ligero hacia atrás

          // Notificación flotante de bloqueo exitoso
          const blockText = k.add([
            k.text("¡BLOQUEO!", { size: 10 }),
            k.pos(this.pos.x, this.pos.y - 16),
            k.anchor("center"),
            k.color(140, 200, 255),
            k.z(25)
          ]);
          blockText.onUpdate(() => {
            blockText.pos.y -= 25 * k.dt();
          });
          k.wait(0.5, () => blockText.destroy());
          return;
        }

        // Descuenta una vida tras recibir daño
        const livesLeft = gameState.loseLife();

        if (livesLeft <= 0) {
          this.die();
          return;
        }

        this.invulnerable = true;
        this.isHurt = true;
        this.isAttacking = false;
        if (activeSwordHitbox) {
          activeSwordHitbox.destroy();
          activeSwordHitbox = null;
        }
        k.play("hit");

        // Física de retroceso tras el golpe
        this.jump(180);
        this.move(knockbackDir * 140, 0);
        this.play("hurt");

        // Parpadeo de invulnerabilidad (1.5 segundos)
        const blinkLoop = k.loop(0.1, () => {
          this.opacity = this.opacity === 1 ? 0.3 : 1;
        });

        k.wait(0.4, () => {
          this.isHurt = false;
        });

        k.wait(1.5, () => {
          blinkLoop.cancel();
          this.opacity = 1;
          this.invulnerable = false;
        });
      },

      /**
       * Ejecuta el ataque cuerpo a cuerpo con espada generando un hitbox temporal frontal.
       */
      attack() {
        if (this.isAttacking || this.isHurt || this.isBlocking) return;

        this.isAttacking = true;
        const animToPlay = Math.random() > 0.5 ? "attack1" : "attack2";
        this.play(animToPlay);

        // Genera un hitbox temporal frente al jugador durante el tajo
        const attackOffsetX = this.facing === "right" ? 18 : -18;
        if (activeSwordHitbox) {
          activeSwordHitbox.destroy();
          activeSwordHitbox = null;
        }
        const hitbox = k.add([
          k.pos(this.pos.x + attackOffsetX, this.pos.y + 2),
          k.area({ shape: new k.Rect(k.vec2(0), 22, 22) }),
          k.anchor("center"),
          "sword_hitbox"
        ]);
        activeSwordHitbox = hitbox;

        k.wait(0.25, () => {
          if (activeSwordHitbox === hitbox) {
            hitbox.destroy();
            activeSwordHitbox = null;
          }
        });

        this.onAnimEnd((anim) => {
          if (anim === "attack1" || anim === "attack2") {
            this.isAttacking = false;
          }
        });
      }
    }
  ]);

  // Auxiliares de entrada: las funciones onKey de Kaboom esperan una tecla individual, no un arreglo
  function onKeysPress(keys, action) {
    for (const key of keys) {
      k.onKeyPress(key, () => action(key));
    }
  }

  function onKeysDown(keys, action) {
    for (const key of keys) {
      k.onKeyDown(key, () => action(key));
    }
  }

  function onKeysRelease(keys, action) {
    for (const key of keys) {
      k.onKeyRelease(key, () => action(key));
    }
  }

  // Entrada de salto: Espacio, Arriba, W (con mecánica de doble salto)
  onKeysPress(["space", "up", "w"], () => {
    if (player.isHurt || player.isBlocking || player.isDead) return;

    if (player.isGrounded()) {
      player.jump(player.jumpForce);
      player.hasDoubleJumped = false;
      k.play("jump");
    } else if (player.canDoubleJump && !player.hasDoubleJumped) {
      player.jump(player.jumpForce * 0.9);
      player.hasDoubleJumped = true;
      k.play("jump");
    }
  });

  // Entrada de ataque con espada: Z, J o Enter
  onKeysPress(["z", "j", "enter"], () => {
    if (player.isDead) return;
    player.attack();
  });

  // Entrada de bloqueo con escudo: Shift o C
  onKeysDown(["shift", "c"], () => {
    if (player.isDead) return;
    if (player.isGrounded() && !player.isAttacking && !player.isHurt) {
      player.isBlocking = true;
      if (player.curAnim() !== "block") {
        player.play("block");
      }
    }
  });

  onKeysRelease(["shift", "c"], () => {
    player.isBlocking = false;
  });

  // Bucle principal de actualización: física de movimiento y máquina de estados de animación
  player.onUpdate(() => {
    if (player.isDead) return;

    // Seguridad 1: evita atravesar plataformas durante caídas rápidas o picos de lag
    if (player.vel) {
      if (player.vel.y > 420) player.vel.y = 420;
      if (player.vel.y < -590) player.vel.y = -590;
    }

    // Registra la posición previa antes de que la física mueva al jugador este cuadro
    player.prevBottom = player.pos.y + 13.7;
    player.prevY = player.pos.y;

    // Seguridad 2: umbral de muerte por caída al vacío
    // Niveles 1, 2, Mazmorras y Secreto tienen altura 360 (muerte en y > 420).
    // Nivel 3 (Torre) tiene altura 1680 (muerte en y > 1760).
    const deathY = maxFallY ?? (gameState.currentLevel === 3 ? 1760 : 420);
    if (player.pos.y > deathY) {
      player.die();
      return;
    }

    // Restablece el doble salto al tocar el suelo
    if (player.isGrounded()) {
      player.hasDoubleJumped = false;
    }

    // Movimiento horizontal (A / D / Izquierda / Derecha)
    if (!player.isHurt) {
      const moveLeft = k.isKeyDown("left") || k.isKeyDown("a");
      const moveRight = k.isKeyDown("right") || k.isKeyDown("d");

      if (moveLeft && !moveRight) {
        const currentSpeed = player.isBlocking ? player.speed * 0.4 : player.speed;
        player.move(-currentSpeed, 0);
        player.flipX = true;
        player.facing = "left";
      } else if (moveRight && !moveLeft) {
        const currentSpeed = player.isBlocking ? player.speed * 0.4 : player.speed;
        player.move(currentSpeed, 0);
        player.flipX = false;
        player.facing = "right";
      }
    }

    // No interrumpir animaciones de ataque o daño
    if (player.isAttacking || player.isHurt) return;

    if (player.isBlocking) {
      if (player.curAnim() !== "block") {
        player.play("block");
      }
      return;
    }

    // Animación en el aire
    if (!player.isGrounded()) {
      if (player.curAnim() !== "jump") {
        player.play("jump");
      }
      return;
    }

    // Animaciones en tierra: caminar vs reposo
    const isMovingHorizontally =
      k.isKeyDown("left") ||
      k.isKeyDown("a") ||
      k.isKeyDown("right") ||
      k.isKeyDown("d");

    if (isMovingHorizontally) {
      if (player.curAnim() !== "walk") {
        player.play("walk");
      }
    } else {
      if (player.curAnim() !== "idle") {
        player.play("idle");
      }
    }
  });

  // --- Resolución de Física y Manejo de Geometría de Colisiones ---
  // Corrige:
  // 1. PLATAFORMAS Y SUELOS SÓLIDOS: Las plataformas funcionan 100% como suelo sólido sin atravesarse.
  // 2. GOLPES DE CABEZA EN TECHOS: Detiene la velocidad ascendente y separa hacia abajo al chocar por debajo.
  // 3. MUROS Y BORDES LATERALES: Conserva el desplazamiento horizontal (displacement.x) en caras laterales.
  // 4. SUELOS CONTINUOS: Mantiene las botas al ras y elimina enganches en las uniones entre bloques.
  player.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;

    const targetLeft = col.target.pos.x;
    const targetWidth = col.target.width ?? (col.target.area?.shape?.width ? col.target.area.shape.width * (col.target.scale?.x ?? 1) : 24);
    const targetRight = targetLeft + targetWidth;
    const targetTop = col.target.pos.y;
    const targetHeight = col.target.height ?? 24;
    const targetBottom = targetTop + targetHeight;

    const playerLeft = player.pos.x - 8;
    const playerRight = player.pos.x + 8;
    const playerTop = player.pos.y - 10.3;
    const playerBottom = player.pos.y + 13.7;

    // Solapamiento horizontal entre el cuerpo del jugador y el bloque objetivo
    const overlapX = Math.min(playerRight, targetRight) - Math.max(playerLeft, targetLeft);
    const isHorizontallyOver = overlapX >= 3;

    // =========================================================================
    // 1. ASCENDIENDO (VELOCIDAD VERTICAL NEGATIVA): player.vel.y < 0
    // =========================================================================
    if (player.vel && player.vel.y < 0) {
      // TECHOS Y PLATAFORMAS SÓLIDAS:
      // Al golpear la parte inferior de un bloque desde abajo, detiene el ascenso y separa hacia abajo.
      if (isHorizontallyOver && targetBottom <= player.pos.y + 6 && playerTop <= targetBottom + 4) {
        player.vel.y = 0;
        const penetrationY = targetBottom - playerTop;
        col.displacement.x = 0;
        col.displacement.y = Math.max(penetrationY, 1);
        return;
      }

      // Si roza el COSTADO de un muro mientras salta hacia arriba:
      // Permite la resolución lateral normal sin anular la velocidad vertical.
      return;
    }

    // =========================================================================
    // 2. DESCENDIENDO O EN TIERRA (VELOCIDAD VERTICAL >= 0): player.vel.y >= 0
    // =========================================================================
    if (!player.vel || player.vel.y >= 0) {
      const penetrationY = playerBottom - targetTop;

      // Contacto con la superficie superior de un bloque o plataforma:
      const isVerticalLanding = col.isBottom() || Math.abs(col.displacement.y) >= Math.abs(col.displacement.x) || (penetrationY >= 0 && penetrationY <= 8);

      if (isHorizontallyOver && player.pos.y < targetTop + 10 && penetrationY >= -2 && isVerticalLanding) {
        // Evita que SAT empuje lateralmente al jugador en las uniones planas del suelo
        col.displacement.x = 0;

        // Fuerza el desplazamiento vertical hacia arriba para mantener las botas al ras de la superficie
        if (penetrationY > 0) {
          col.displacement.y = -penetrationY;
        } else if (col.displacement.y >= 0) {
          col.displacement.y = -0.1;
        }
        return;
      }

      // En caso contrario (contacto lateral con muro o esquina), conserva displacement.x para deslizarse suavemente.
    }
  });

  // Comprobaciones adicionales de seguridad para contacto superior con techos
  player.onCollide("solid", (solid) => {
    if (player.vel && player.vel.y < 0) {
      const solidHeight = solid.height ?? 24;
      const solidBottom = solid.pos.y + solidHeight;
      const solidWidth = solid.width ?? 24;
      const overlapX = Math.min(player.pos.x + 8, solid.pos.x + solidWidth) - Math.max(player.pos.x - 8, solid.pos.x);
      if (overlapX >= 4 && solidBottom <= player.pos.y + 6) {
        player.vel.y = 0;
      }
    }
  });

  player.onCollideUpdate("solid", (solid) => {
    if (player.vel && player.vel.y < 0) {
      const solidHeight = solid.height ?? 24;
      const solidBottom = solid.pos.y + solidHeight;
      const solidWidth = solid.width ?? 24;
      const overlapX = Math.min(player.pos.x + 8, solid.pos.x + solidWidth) - Math.max(player.pos.x - 8, solid.pos.x);
      if (overlapX >= 4 && solidBottom <= player.pos.y + 6) {
        player.vel.y = 0;
      }
    }
  });

  player.onHeadbutt(() => {
    if (player.vel) {
      player.vel.y = 0;
    }
  });

  // Referencia rápida en O(1) al jugador para los agentes de IA entre escenas
  gameState.player = player;
  player.onDestroy(() => {
    if (gameState.player === player) {
      gameState.player = null;
    }
  });

  return player;
}
