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
  let activeSwordHitbox = null;

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
        this.isAttacking = false;
        if (activeSwordHitbox) {
          activeSwordHitbox.destroy();
          activeSwordHitbox = null;
        }
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

  // --- Physics Resolution & Collision Geometry Handling ---
  // Fixes:
  // 1. ONE-WAY FLOATING PLATFORMS: Jump through freely from below, land solidly from above.
  // 2. CEILING HEADBUTTS: Halts upward velocity and forces downward separation only when
  //    player is horizontally underneath the ceiling, preventing high-speed phase-through (trampolines).
  // 3. WALLS & LATERAL EDGES: Preserves SAT horizontal displacement (displacement.x) when
  //    touching side faces or corners, preventing "invisible ledges" or floating in mid-air.
  // 4. FLOORS & PLATFORMS: Keeps boots flush and eliminates seam hitching when player is
  //    genuinely horizontally positioned over the top surface.
  player.onBeforePhysicsResolve((col) => {
    if (!col.target.is("solid")) return;

    const isPlatform = col.target.is("platform");
    const targetLeft = col.target.pos.x;
    const targetWidth = col.target.width ?? 24;
    const targetRight = targetLeft + targetWidth;
    const targetTop = col.target.pos.y;
    const targetHeight = col.target.height ?? 24;
    const targetBottom = targetTop + targetHeight;

    const playerLeft = player.pos.x - 8;
    const playerRight = player.pos.x + 8;
    const playerTop = player.pos.y - 10.3;
    const playerBottom = player.pos.y + 13.7;

    // Horizontal overlap between player's body and the target block
    const overlapX = Math.min(playerRight, targetRight) - Math.max(playerLeft, targetLeft);
    // Mili is genuinely over the block (at least 4px of horizontal body overlap)
    const isHorizontallyOver = overlapX >= 4;

    // =========================================================================
    // 1. ASCENDING (UPWARD VELOCITY): player.vel.y < 0
    // =========================================================================
    if (player.vel && player.vel.y < 0) {
      // ONE-WAY FLOATING PLATFORMS: Jump through freely from below!
      if (isPlatform) {
        col.preventResolution();
        return;
      }

      // SOLID CEILING BLOCKS:
      // Only trigger ceiling collision if player is actually UNDER the block horizontally
      // and hitting the underside of the block with their head
      if (isHorizontallyOver && targetBottom <= player.pos.y + 6 && playerTop <= targetBottom + 4) {
        // Halt upward momentum
        player.vel.y = 0;
        // Separate downward
        const penetrationY = targetBottom - playerTop;
        col.displacement.x = 0;
        col.displacement.y = Math.max(penetrationY, 1);
        return;
      }

      // If grazing the SIDE of a wall while jumping upward:
      // It's a wall collision! Allow normal lateral resolution (push player away horizontally)
      // and do NOT kill upward velocity or push vertically!
      return;
    }

    // =========================================================================
    // 2. DESCENDING OR GROUNDED (DOWNWARD / ZERO VELOCITY): player.vel.y >= 0
    // =========================================================================
    if (!player.vel || player.vel.y >= 0) {
      // ONE-WAY PLATFORMS: If falling but feet are below the platform top surface
      if (isPlatform && (playerBottom > targetTop + 8 || !isHorizontallyOver)) {
        col.preventResolution();
        return;
      }

      const penetrationY = playerBottom - targetTop;

      // Contact with the top surface of a floor block or platform:
      // 1. Player is horizontally over the block (overlapX >= 4)
      // 2. Player's feet are contacting the top surface (penetrationY between -2 and 14)
      // 3. Collision resolution is predominantly vertical (landing) or boots are at the surface
      const isVerticalLanding = col.isBottom() || Math.abs(col.displacement.y) >= Math.abs(col.displacement.x);

      if (isHorizontallyOver && player.pos.y < targetTop + 10 && penetrationY >= -2 && isVerticalLanding) {
        // Prevent SAT from kicking player sideways across flat floor seams
        col.displacement.x = 0;

        // Force upward displacement to keep boots firmly flush on the surface
        if (penetrationY > 0) {
          col.displacement.y = -penetrationY;
        } else if (col.displacement.y >= 0) {
          col.displacement.y = -0.1;
        }
        return;
      }

      // Otherwise, if player is touching the SIDE of the block (e.g. wall or corner):
      // Keep SAT's lateral displacement (displacement.x) and DO NOT force vertical displacement!
      // This ensures the player slides down the wall without getting stuck on an "invisible block".
    }
  });

  // Additional safety callbacks for upward ceiling contact
  player.onCollide("solid", (solid) => {
    if (player.vel && player.vel.y < 0 && !solid.is("platform")) {
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
    if (player.vel && player.vel.y < 0 && !solid.is("platform")) {
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

  // Fast O(1) player lookup reference for AI agents across scenes
  gameState.player = player;
  player.onDestroy(() => {
    if (gameState.player === player) {
      gameState.player = null;
    }
  });

  return player;
}
