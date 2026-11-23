import { gameState } from "../state.js";

/**
 * Creates and initializes the player character (Mili).
 * 
 * Includes:
 * - Fluent movement and double jump (Req-5)
 * - Sword melee attack
 * - Tactical Shield Block mechanic (Req-5)
 * - Damage, invulnerability and lives system (Req-4)
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 * @param {number} x - Initial X coordinate
 * @param {number} y - Initial Y coordinate
 * @param {boolean} allowDoubleJump - Enables double jump mechanic
 * @returns {import("kaboom").GameObj} The player game object
 */
export function createPlayer(k, x = 100, y = 200, allowDoubleJump = true, maxFallY = null) {
  const player = k.add([
    k.sprite("player", { anim: "idle" }),
    k.pos(x, y),
    // Scale knight so height matches 1 map block (24px)
    // Raw knight sprite in mili.png is 21px tall (helmet y=39 to boots y=60).
    // Scale factor: 24 / 21 = 8 / 7 (~1.143). 21 * (24/21) = 24px exactly.
    k.scale(24 / 21),
    // Precision hitbox aligned to feet (y=+12 in 96x96 frame) and helmet (y=-9 from center):
    // Rect center y = 1.5, height = 21 -> top = -9, bottom = +12.
    // When scaled by 24/21, total height is 24px and boots rest 100% flush on the block surface.
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

      // Fatal death: Instant kill from bottomless pit or 0 lives
      die() {
        if (this.isDead) return;
        this.isDead = true;
        this.invulnerable = true;
        this.isHurt = true;
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

      // Damage & invulnerability system (Req-4) with Shield Block defense
      receiveDamage(knockbackDir = 0) {
        if (this.invulnerable || this.isHurt || this.isDead) return;

        // --- Shield Block Defense (Req-5) ---
        // If blocking and attack comes from the front: Absorb 100% damage!
        const isFacingAttacker =
          (this.facing === "right" && knockbackDir < 0) ||
          (this.facing === "left" && knockbackDir > 0);

        if (this.isBlocking && isFacingAttacker) {
          k.play("spring"); // Metal clink feedback sound
          this.move(knockbackDir * 60, 0); // Light pushback

          // Floating block notification
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

        // Damage received
        const livesLeft = gameState.loseLife();

        if (livesLeft <= 0) {
          this.die();
          return;
        }

        this.invulnerable = true;
        this.isHurt = true;
        k.play("hit");

        // Knockback physics
        this.jump(180);
        this.move(knockbackDir * 140, 0);
        this.play("hurt");

        // Invulnerability blinking effect (1.5 seconds)
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

      // Sword attack mechanic
      attack() {
        if (this.isAttacking || this.isHurt || this.isBlocking) return;

        this.isAttacking = true;
        const animToPlay = Math.random() > 0.5 ? "attack1" : "attack2";
        this.play(animToPlay);

        // Spawn a temporary melee attack hitbox in front of the player
        const attackOffsetX = this.facing === "right" ? 18 : -18;
        const hitbox = k.add([
          k.pos(this.pos.x + attackOffsetX, this.pos.y + 2),
          k.area({ shape: new k.Rect(k.vec2(0), 22, 22) }),
          k.anchor("center"),
          "sword_hitbox"
        ]);

        k.wait(0.25, () => {
          hitbox.destroy();
        });

        this.onAnimEnd((anim) => {
          if (anim === "attack1" || anim === "attack2") {
            this.isAttacking = false;
          }
        });
      }
    }
  ]);

  // Input helpers: Kaboom's onKey functions expect a single key string, not an array
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

  // Jump input: Space, Up, W (With double jump mechanic)
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

  // Sword Attack input: Z or J or Enter
  onKeysPress(["z", "j", "enter"], () => {
    if (player.isDead) return;
    player.attack();
  });

  // Shield Block input: Shift or C
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

  // Core update loop: movement physics and animation state machine
  player.onUpdate(() => {
    if (player.isDead) return;

    // Safety 1: Prevent physics tunneling during high falls or delta time lag spikes
    if (player.vel) {
      if (player.vel.y > 420) player.vel.y = 420;
      if (player.vel.y < -590) player.vel.y = -590;
    }

    // Safety 2: Bottomless pit death threshold
    // Level 1, 2, Dungeons & Secret have map height 360 (pit death at y > 420, well off-screen).
    // Level 3 (Tower) has map height 1680 (pit death at y > 1760).
    const deathY = maxFallY ?? (gameState.currentLevel === 3 ? 1760 : 420);
    if (player.pos.y > deathY) {
      player.die();
      return;
    }

    // Reset double jump when touching ground
    if (player.isGrounded()) {
      player.hasDoubleJumped = false;
    }

    // Horizontal movement physics (A / D / Left / Right)
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

    // Don't interrupt attack, hurt, or blocking animations
    if (player.isAttacking || player.isHurt) return;

    if (player.isBlocking) {
      if (player.curAnim() !== "block") {
        player.play("block");
      }
      return;
    }

    // Air animation
    if (!player.isGrounded()) {
      if (player.curAnim() !== "jump") {
        player.play("jump");
      }
      return;
    }

    // Ground animations: Walk vs Idle
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

  // --- Ceiling & Floor Internal Seam Glitch Prevention ---
  // Collision seam, platform, and trampoline physics handling:
  // 1. ONE-WAY PLATFORMS: Mili can jump up freely through thin floating platforms from below,
  //    and lands firmly on top when falling onto them.
  // 2. CEILING COLLISIONS: Halts upward momentum immediately and forces downward separation
  //    so high-speed jumps (trampolines) can never phase up through solid ceiling blocks.
  // 3. FLOOR & PLATFORM LANDINGS: Prevents SAT from pushing downward or sideways on high falls,
  //    ensuring boots land solidly on top and Kaboom grounds the player.
  player.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;

    const isPlatform = col.target.is("platform");
    const tileTop = col.target.pos.y;
    const tileHeight = col.target.height ?? 24;
    const tileBottom = tileTop + tileHeight;
    const playerBottom = player.pos.y + 13.71; // Bottom of boots
    const playerTop = player.pos.y - 10.3; // Top of helmet

    // =========================================================================
    // 1. ASCENDING (UPWARD VELOCITY): player.vel.y < 0
    // =========================================================================
    if (player.vel && player.vel.y < 0) {
      // ONE-WAY FLOATING PLATFORMS: Jump through freely from below!
      if (isPlatform) {
        col.preventResolution();
        return;
      }

      // SOLID CEILING BLOCKS (walls, stone ground blocks, masonry):
      // When moving upward and hitting any overhead solid obstacle:
      if (col.target.pos.y < player.pos.y + 10) {
        // Halt all upward momentum immediately
        player.vel.y = 0;

        // Force downward separation so Mili never pops through the ceiling
        const penetrationY = tileBottom - playerTop;
        col.displacement.x = 0;
        col.displacement.y = Math.max(penetrationY, 1);
        return;
      }
    }

    // =========================================================================
    // 2. DESCENDING OR GROUNDED (DOWNWARD / ZERO VELOCITY): player.vel.y >= 0
    // =========================================================================
    if (!player.vel || player.vel.y >= 0) {
      const penetrationY = playerBottom - tileTop;

      // Contact with the top surface of a floor block or platform:
      // Player center is above the tile top surface (player.pos.y < tileTop + 10)
      // and boots are at or penetrating into the surface (penetrationY >= -2)
      if (player.pos.y < tileTop + 10 && penetrationY >= -2) {
        // Prevent SAT from kicking player sideways across seams
        col.displacement.x = 0;

        // Force upward displacement to keep boots firmly flush on the surface
        if (penetrationY > 0) {
          col.displacement.y = -penetrationY;
        } else if (col.displacement.y >= 0) {
          col.displacement.y = -0.1;
        }
        // If col.displacement.y < 0, it is already pushing up: keep it intact!
        return;
      }

      // ONE-WAY PLATFORMS: If falling but player's feet are completely below
      // the platform's top surface (e.g. falling alongside underneath the platform):
      if (isPlatform && playerBottom > tileTop + 10) {
        col.preventResolution();
        return;
      }
    }
  });

  // Additional safety callbacks for upward ceiling contact (ignore one-way platforms)
  player.onCollide("solid", (solid) => {
    if (player.vel && player.vel.y < 0 && solid.pos.y < player.pos.y && !solid.is("platform")) {
      player.vel.y = 0;
    }
  });

  player.onCollideUpdate("solid", (solid) => {
    if (player.vel && player.vel.y < 0 && solid.pos.y < player.pos.y && !solid.is("platform")) {
      player.vel.y = 0;
    }
  });

  player.onHeadbutt(() => {
    if (player.vel) {
      player.vel.y = 0;
    }
  });

  return player;
}
