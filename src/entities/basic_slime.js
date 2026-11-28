import { gameState } from "../state.js";

/**
 * Crea e inicializa un enemigo Slime Básico (Basic Slime / Cavern Ooze).
 * 
 * Características:
 * - Enemigo gelatinoso de 1 HP del paquete Pixel Enemies.
 * - Se comprime y lanza hacia adelante cuando el jugador se acerca.
 * - Puede ser derrotado saltando encima o con un corte de espada.
 * - Seguimiento rápido del jugador en O(1).
 * 
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 * @param {number} x - Coordenada X inicial
 * @param {number} y - Coordenada Y inicial
 * @param {number} patrolRange - Distancia máxima de patrulla hacia izquierda/derecha
 * @returns {import("kaboom").GameObj} Objeto de juego del slime
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
    // El cuadro mide 96x64; el slime mide ~29x12 px centrado. Escala 1.0 encaja con tiles de 24px
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

      /**
       * Ejecuta la secuencia de derrota del slime, otorga puntos y destruye la entidad.
       */
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = "die";

        k.play("hit");
        gameState.addScore(150);

        // Texto flotante de puntuación (+150)
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

  // Bucle de actualización de la IA del slime
  slime.onUpdate(() => {
    if (slime.isDead) return;

    if (slime.vel && slime.vel.y > 350) {
      slime.vel.y = 350;
    }

    const dt = k.dt();
    if (attackCooldown > 0) attackCooldown -= dt;

    // Búsqueda rápida del jugador en O(1)
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

        // Cambio de dirección al alcanzar los límites de patrulla
        if (slime.pos.x < startX - patrolRange) {
          dir = 1;
        } else if (slime.pos.x > startX + patrolRange) {
          dir = -1;
        }

        // Comprobación de embestida: el jugador está cerca y a nivel del suelo
        const playerAtLungeLevel = dy >= -10 && dy <= 24;
        if (Math.abs(dx) <= attackDistance && playerAtLungeLevel && attackCooldown <= 0) {
          slime.state = "attack";
          attackCooldown = 1.8;
          dir = dx >= 0 ? 1 : -1;
          slime.flipX = dir < 0;
          slime.play("attack");

          // Salto corto hacia adelante para embestir
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

  // Protección contra uniones del suelo (evita desplazamientos horizontales indeseados)
  slime.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;
    if (col.target.pos.y >= slime.pos.y && col.displacement.x !== 0) {
      col.displacement.x = 0;
    }
  });

  // Da la vuelta al chocar contra obstáculos sólidos laterales
  slime.onCollide("solid", (obj, col) => {
    if (obj.pos.y < slime.pos.y + 2) {
      if (!col || col.isLeft() || col.isRight() || Math.abs(col.normal?.x || 0) > 0.5) {
        dir = -dir;
        slime.flipX = dir < 0;
      }
    }
  });

  // Impacto de espada cuerpo a cuerpo del jugador
  slime.onCollide("sword_hitbox", () => {
    if (slime.isDead) return;
    slime.die();
  });

  return slime;
}
