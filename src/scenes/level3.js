import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createBasicSlime } from "../entities/basic_slime.js";
import { createOrc } from "../entities/orc.js";
import { createSkeleton } from "../entities/skeleton.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Level 3: "La Gran Torre de la Fortaleza Maldita" (Diseño Vertical: 27 cols x 70 filas)
 * 
 * Features & Architecture:
 * - Vertical tower layout: Player begins at the dungeon foundation (y ≈ 1618px)
 *   and ascends 5 vertical tiers of ancient fortress ruins to the rooftop Throne Gateway.
 * - Dynamic vertical camera tracking: Smoothly locks at width/2 and tracks Mili in Y,
 *   clamped precisely within [height/2, mapHeight - height/2].
 * - Moving platform elevator & horizontal gears across the tower abyss.
 * - Geyser trampoline mushrooms propelling the player through spike corridors.
 * - New Enemy Roster:
 *     * Skeleton Warriors (ancient swordsmen, 2 HP, melee slash attack)
 *     * Basic Slimes (bouncy toxic ooze, jump lunges)
 *     * Orc Warriors (heavy club attack, 3 HP)
 *     * Classic Slimes (patrol hazards)
 * - Summit Gateway: Reaching the summit reveals the Throne Gate (exit door) leading
 *   to the new dedicated Boss Arena scene ("throne").
 * - High-performance Frustum Culling & Consolidated Physics Colliders (solid 60 FPS).
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initLevel3(k) {
  k.scene("level3", () => {
    gameState.currentLevel = 3;
    gameState.hasKey = false;
    gameState.collectedBook = null;

    const tileSize = 24;
    const cols = 27;
    const rows = 70;
    const mapWidth = cols * tileSize;   // 648 px (exact full-screen width)
    const mapHeight = rows * tileSize; // 1680 px (epic 4.7-screen vertical ascent)

    k.setGravity(980);
    // Start camera at the tower bottom where player teleports in
    k.camPos(k.width() / 2, mapHeight - k.height() / 2);

    // --- Atmospheric Dark Fortress Background ---
    k.add([
      k.sprite("bg_level3"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Dark moody overlay for tower atmosphere
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(12, 8, 20),
      k.opacity(0.35),
      k.fixed(),
      k.z(-8)
    ]);

    // Objective banner under HUD
    k.add([
      k.rect(520, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(20, 10, 18),
      k.opacity(0.85),
      k.fixed(),
      k.z(80)
    ]);

    k.add([
      k.text("OBJETIVO: ¡Asciende por la torre hasta la Puerta del Trono!", {
        font: "pressstart",
        size: 6.5
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(255, 140, 140),
      k.fixed(),
      k.z(81)
    ]);

    // --- Vertical Tower Map Grid (27 columns x 70 rows = 648 x 1680 px) ---
    // Legend:
    // '#' dungeon_wall (boundary / masonry)
    // '=' dungeon_top (ground)
    // '-' dungeon_platform (one-way platform)
    // '^' dungeon_spikes (hazard)
    // '$' coin
    // 'G' gem
    // 'H' heart
    // 'T' trampoline
    // 'D' door to Throne Room
    // '1' horizontal moving platform
    // '2' vertical moving elevator
    const layout = [
      "##                       ##", // 0
      "##           D           ##", // 1 Throne Gate (Door to Boss Arena)
      "##                       ##", // 2 Space for 2-tile door height
      "##        =======        ##", // 3 Gate threshold floor
      "##                       ##", // 4
      "##   ^^^^         ^^^^   ##", // 5 Summit spikes
      "##=======================##", // 6 Summit Citadel floor (Skeletons)
      "##                       ##", // 7
      "##   T                 T ##", // 8 Trampolines to Summit
      "##  ===       G       ===##", // 9 High balconies with Gem
      "##           ---         ##", // 10 Center step
      "##                       ##", // 11
      "##       ---     ---     ##", // 12 Approach ledges
      "##===                 ===##", // 13 Fortress Gate tier
      "##                       ##", // 14
      "##         ^^^^^         ##", // 15 Spikes
      "##        =======        ##", // 16 Stone floor (Skeleton)
      "##                       ##", // 17
      "##   T       $       T   ##", // 18 Trampolines
      "##  ===             ===  ##", // 19
      "##         -----         ##", // 20 Wooden bridge (Basic Slime)
      "##                       ##", // 21
      "##          HHH          ##", // 22 Hearts
      "##        =======        ##", // 23 Stone floor (Orc Guard)
      "##                       ##", // 24
      "##   ---           ---   ##", // 25 Side ledges
      "##                       ##", // 26
      "##=================   ===##", // 27 Tier 3 rampart
      "##                       ##", // 28
      "##  ===                  ##", // 29
      "##         1             ##", // 30 Moving platform 1
      "##                       ##", // 31
      "##                 ====  ##", // 32 Platform (Skeleton)
      "##                       ##", // 33
      "##       ---   ---       ##", // 34 Wooden stepping platforms
      "##                       ##", // 35
      "##                  ===  ##", // 36
      "##                ====== ##", // 37 Stone platform (Orc Guard)
      "##         2             ##", // 38 Vertical elevator
      "##                       ##", // 39
      "##   ======              ##", // 40 Stone ledge (Basic Slime)
      "##           $$$         ##", // 41 Gold coins
      "##                       ##", // 42
      "##   ^^^^^               ##", // 43 Spikes
      "##===   =================##", // 44 Tier 2 floor
      "##                       ##", // 45
      "##          ---          ##", // 46 Wood platform (Skeleton)
      "##       =======         ##", // 47
      "##    G                  ##", // 48 Gem
      "##  ---             ---  ##", // 49 Side platforms
      "##                       ##", // 50
      "##         ^^^^^         ##", // 51 Spikes
      "##        =======        ##", // 52 Stone platform (Orc Guard)
      "##   T                   ##", // 53 Trampoline
      "##  ===           ===    ##", // 54
      "##                 ---   ##", // 55 Wooden beam (Basic Slime)
      "##              =======  ##", // 56
      "##                       ##", // 57
      "##        -----          ##", // 58 Wood platform (Slime)
      "##                       ##", // 59
      "##                  ===  ##", // 60 Stone step
      "##                       ##", // 61
      "##  ===                  ##", // 62 Stone step (Skeleton)
      "##          T            ##", // 63 Trampoline
      "##         ===           ##", // 64 Solid block
      "##                       ##", // 65
      "##    @                  ##", // 66 Player spawn
      "##                       ##", // 67
      "##=======================##", // 68 Base floor
      "###########################"  // 69 Solid bedrock
    ];

    let player = null;
    const movingPlatforms = [];
    const enemies = [];

    // Helper for floating text notifications
    function showPopup(pos, txt, col = k.rgb(255, 230, 100)) {
      const pop = k.add([
        k.text(txt, { font: "pressstart", size: 8 }),
        k.pos(pos.x, pos.y - 12),
        k.anchor("center"),
        k.color(col),
        k.z(50)
      ]);
      pop.onUpdate(() => {
        pop.pos.y -= 25 * k.dt();
        pop.opacity = Math.max(0, (pop.opacity || 1) - 1.2 * k.dt());
        if (pop.opacity <= 0) pop.destroy();
      });
    }

    // Pre-calculate visual tiles grouped by row for zero-allocation, frustum-culled rendering
    const visualRows = [];
    const groundSegments = [];
    const platformSegments = [];

    // Build the 70-row vertical tower
    for (let row = 0; row < rows; row++) {
      const line = layout[row];
      const rowTiles = [];
      let col = 0;

      while (col < cols) {
        const char = line[col];
        const x = col * tileSize;
        const y = row * tileSize;

        if (char === "#") {
          rowTiles.push({ sprite: "dungeon_wall", pos: k.vec2(x, y) });
          col++;
        } else if (char === "=") {
          const startCol = col;
          while (col < cols && line[col] === "=") {
            rowTiles.push({ sprite: "dungeon_top", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          groundSegments.push({ row, col: startCol, len: length });
        } else if (char === "-") {
          const startCol = col;
          while (col < cols && line[col] === "-") {
            rowTiles.push({ sprite: "dungeon_platform", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          platformSegments.push({ row, col: startCol, len: length });
        } else {
          switch (char) {
            case "^":
              // Deadly dungeon spikes (precise player-favorable hazard hitbox)
              k.add([
                k.sprite("dungeon_spikes"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(2, 10), 12, 6) }),
                k.z(3),
                "spikes"
              ]);
              break;

            case "$":
              // Gold coin
              k.add([
                k.sprite("coin"),
                k.pos(x + 4, y + 4),
                k.scale(tileSize / 16),
                k.area(),
                k.z(5),
                "coin"
              ]);
              break;

            case "G":
              // Precious gem
              k.add([
                k.sprite("gem"),
                k.pos(x + 4, y + 4),
                k.scale(tileSize / 16),
                k.area(),
                k.z(5),
                "gem"
              ]);
              break;

            case "H":
              // Restorative Heart
              k.add([
                k.sprite("heart_full"),
                k.pos(x + 4, y + 4),
                k.scale(tileSize / 16),
                k.area(),
                k.z(5),
                "heart_item"
              ]);
              break;

            case "T":
              // Geyser / spring trampoline (flush on block below)
              k.add([
                k.sprite("spring"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(0, 4), 16, 12) }),
                k.z(4),
                "spring"
              ]);
              break;

            case "D":
              // Throne Gateway Door (Leads to Boss Arena)
              k.add([
                k.sprite("door_closed"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
                k.z(4),
                "exit_door"
              ]);
              break;

            case "1":
              // Moving Platform 1 (Horizontal patrol across row 30: x = 168 to 432)
              {
                const plat = k.add([
                  k.sprite("dungeon_platform_2x"),
                  k.pos(x, y),
                  k.scale(tileSize / 16),
                  k.area(),
                  k.body({ isStatic: true }),
                  k.z(4),
                  "solid",
                  "platform",
                  "moving_platform",
                  {
                    startX: 168,
                    endX: 432,
                    speed: 55,
                    dir: 1,
                    deltaX: 0,
                    deltaY: 0
                  }
                ]);
                movingPlatforms.push(plat);
              }
              break;

            case "2":
              // Moving Elevator 2 (Vertical ascent: y = 888 to 1032)
              {
                const elevator = k.add([
                  k.sprite("dungeon_platform_2x"),
                  k.pos(x, y),
                  k.scale(tileSize / 16),
                  k.area(),
                  k.body({ isStatic: true }),
                  k.z(4),
                  "solid",
                  "platform",
                  "moving_platform",
                  {
                    startY: 888,
                    endY: 1032,
                    speed: 48,
                    dir: -1,
                    deltaX: 0,
                    deltaY: 0
                  }
                ]);
                movingPlatforms.push(elevator);
              }
              break;

            default:
              break;
          }
          col++;
        }
      }
      visualRows.push(rowTiles);
    }

    // Dedicated frustum-culled tilemap renderer:
    // Only draws the rows visible within viewport (+ 48px vertical safety margin)
    // Zero WebGL overhead for off-screen rows!
    const tilemap = k.add([
      k.z(1)
    ]);
    const tileScale = k.vec2(tileSize / 16, tileSize / 16);

    tilemap.onDraw(() => {
      const camY = k.camPos().y;
      const minRow = Math.max(0, Math.floor((camY - 228) / tileSize));
      const maxRow = Math.min(rows - 1, Math.ceil((camY + 228) / tileSize));

      for (let r = minRow; r <= maxRow; r++) {
        const rowTiles = visualRows[r];
        for (let i = 0; i < rowTiles.length; i++) {
          const t = rowTiles[i];
          k.drawSprite({
            sprite: t.sprite,
            pos: t.pos,
            scale: tileScale
          });
        }
      }
    });

    // Consolidated Static Physics Colliders:
    // 1. Continuous Left Tower Wall Boundary (cols 0-1: x = 0..48)
    k.add([
      k.rect(48, mapHeight),
      k.pos(0, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // 2. Continuous Right Tower Wall Boundary (cols 25-26: x = 600..648)
    k.add([
      k.rect(48, mapHeight),
      k.pos(mapWidth - 48, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // 3. Continuous Bedrock Base Boundary (Row 69 and beneath: y = 1656+)
    k.add([
      k.rect(mapWidth, 120),
      k.pos(0, 69 * tileSize),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);

    // 4. Consolidated Ground Colliders
    for (const seg of groundSegments) {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid",
        "ground"
      ]);
    }

    // 5. Consolidated Platform Colliders
    for (const seg of platformSegments) {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid",
        "platform"
      ]);
    }

    // Animated glowing label above Throne Gate Door
    const throneDoorLabel = k.add([
      k.text("PUERTA AL TRONO", { font: "pressstart", size: 7 }),
      k.pos(13 * tileSize + 12, 1 * tileSize - 8),
      k.anchor("center"),
      k.color(255, 140, 140),
      k.z(10)
    ]);
    throneDoorLabel.onUpdate(() => {
      throneDoorLabel.opacity = k.wave(0.5, 1, k.time() * 4);
    });

    // Initialize HUD
    createHUD(k, "NIVEL 3: LA TORRE");

    // Spawn player at "@" position (row 66, flush on base floor at y = 1618)
    player = createPlayer(k, 120, 1618, true, 1760);

    // =========================================================================
    // Spawn Expanded Enemy Roster across the 5 Tiers of the Tower
    // =========================================================================

    // Tier 1 (Base & Lower Ascent: rows 55-66)
    enemies.push(createSkeleton(k, 4 * tileSize, 1475, 24));      // Row 62 stone step
    enemies.push(createSlime(k, 12 * tileSize, 1378, 30));         // Row 58 wood platform
    enemies.push(createBasicSlime(k, 20 * tileSize, 1307, 24));    // Row 55 wooden beam

    // Tier 2 (Mid-Lower Ramparts: rows 44-54)
    enemies.push(createOrc(k, 12 * tileSize, 1235, 36));          // Row 52 stone platform
    enemies.push(createSkeleton(k, 12 * tileSize, 1090, 28));     // Row 46 wood platform
    enemies.push(createBasicSlime(k, 6 * tileSize, 946, 36));      // Row 40 stone ledge

    // Tier 3 (Middle Fortress & Chasm: rows 30-43)
    enemies.push(createOrc(k, 19 * tileSize, 874, 36));           // Row 37 stone platform
    enemies.push(createSkeleton(k, 20 * tileSize, 755, 24));      // Row 32 platform

    // Tier 4 (Upper Gate & Spike Hall: rows 13-29)
    enemies.push(createOrc(k, 13 * tileSize, 538, 36));           // Row 23 stone floor
    enemies.push(createBasicSlime(k, 12 * tileSize, 467, 30));     // Row 20 wooden bridge
    enemies.push(createSkeleton(k, 12 * tileSize, 370, 32));      // Row 16 stone floor

    // Tier 5 (Summit Citadel / Throne Gate Guards: rows 4-9)
    enemies.push(createSkeleton(k, 7 * tileSize, 130, 36));       // Row 6 Summit Citadel guard (left)
    enemies.push(createSkeleton(k, 18 * tileSize, 130, 36));      // Row 6 Summit Citadel guard (right)
    enemies.push(createSlime(k, 12 * tileSize, 202, 24));         // Row 9 center stepping ledge

    // Update moving platforms with player drag physics
    k.onUpdate(() => {
      for (const plat of movingPlatforms) {
        if (plat.startX !== undefined) {
          // Horizontal moving platform
          const oldX = plat.pos.x;
          plat.pos.x += plat.speed * plat.dir * k.dt();
          plat.deltaX = plat.pos.x - oldX;
          plat.deltaY = 0;

          if (plat.pos.x >= plat.endX) {
            plat.pos.x = plat.endX;
            plat.dir = -1;
          } else if (plat.pos.x <= plat.startX) {
            plat.pos.x = plat.startX;
            plat.dir = 1;
          }
        } else if (plat.startY !== undefined) {
          // Vertical elevator
          const oldY = plat.pos.y;
          plat.pos.y += plat.speed * plat.dir * k.dt();
          plat.deltaX = 0;
          plat.deltaY = plat.pos.y - oldY;

          if (plat.pos.y >= plat.endY) {
            plat.pos.y = plat.endY;
            plat.dir = -1;
          } else if (plat.pos.y <= plat.startY) {
            plat.pos.y = plat.startY;
            plat.dir = 1;
          }
        }

        // Drag player if standing on moving platform (fast zero-allocation check)
        if (player && player.isGrounded()) {
          const platWidth = 48;
          const isStanding =
            player.pos.x + 8 > plat.pos.x &&
            player.pos.x - 8 < plat.pos.x + platWidth &&
            Math.abs((player.pos.y + 12) - plat.pos.y) < 6;

          if (isStanding) {
            player.pos.x += plat.deltaX;
            player.pos.y += plat.deltaY;
          }
        }
      }
    });

    // --- Interactive Collisions & Triggers ---

    // 1. Coins & Collectibles
    player.onCollide("coin", (coin) => {
      coin.destroy();
      gameState.addScore(100);
      k.play("coin");
      showPopup(coin.pos, "+100", k.rgb(255, 230, 80));
    });

    player.onCollide("gem", (gem) => {
      gem.destroy();
      gameState.addScore(300);
      k.play("win");
      showPopup(gem.pos, "+300", k.rgb(100, 240, 255));
    });

    player.onCollide("heart_item", (heart) => {
      heart.destroy();
      if (gameState.lives < gameState.maxLives) {
        gameState.lives++;
        showPopup(heart.pos, "+1 VIDA", k.rgb(255, 120, 150));
      } else {
        gameState.addScore(250);
        showPopup(heart.pos, "+250", k.rgb(255, 200, 100));
      }
      k.play("win");
    });

    // 2. Geyser Trampolines (Super jump)
    player.onCollide("spring", (spr) => {
      k.play("spring");
      player.jump(player.jumpForce * 1.45);
      player.hasDoubleJumped = false;
      spr.scale = k.vec2((tileSize / 16) * 1.3, (tileSize / 16) * 0.7);
      k.wait(0.15, () => {
        spr.scale = k.vec2(tileSize / 16, tileSize / 16);
      });
    });

    // 3. Spikes Hazard
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // 4. Combat collisions with enemies
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      // Robust stomp check: Player is above enemy in the air or falling
      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        if (enemy.is("orc") || enemy.is("skeleton")) {
          enemy.takeDamage(2, player.pos.x);
        } else {
          enemy.die();
        }
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
        return;
      }

      // Player receives damage and knockback
      const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    player.onCollide("orc_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    player.onCollide("skeleton_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    // 5. Level Exit Door Transition: Enters the Throne Room ("throne")
    let enteringThrone = false;
    player.onCollide("exit_door", (door) => {
      if (enteringThrone) return;
      enteringThrone = true;

      door.use(k.sprite("door_open"));
      k.play("win");

      // Grand Portal Transition Banner
      k.add([
        k.rect(500, 60),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(24, 8, 20),
        k.opacity(0.92),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡ENTRANDO A LA SALA DEL TRONO...!", { font: "pressstart", size: 9 }),
        k.pos(k.width() / 2, k.height() / 2 - 8),
        k.anchor("center"),
        k.color(255, 120, 120),
        k.fixed(),
        k.z(151)
      ]);

      k.add([
        k.text("El Rey Demonio te espera...", { font: "pressstart", size: 7.5 }),
        k.pos(k.width() / 2, k.height() / 2 + 12),
        k.anchor("center"),
        k.color(240, 200, 200),
        k.fixed(),
        k.z(151)
      ]);

      k.wait(2.0, () => {
        k.go("throne");
      });
    });

    // --- Main Update Loop: Vertical Camera Tracking & Clamp ---
    k.onUpdate(() => {
      if (!player) return;

      // Clamp player within horizontal tower walls (lateral bounds: x = 55 to 593)
      if (player.pos.x < 55) {
        player.pos.x = 55;
      } else if (player.pos.x > mapWidth - 55) {
        player.pos.x = mapWidth - 55;
      }

      // Instant death if falling into bottom pit (y > 1720)
      if (player.pos.y > 1720 && !player.isDead) {
        player.die();
      }

      // Vertical Camera Tracking: Locks horizontally at width/2 and smoothly follows Mili in Y
      const targetCamY = Math.max(k.height() / 2, Math.min(player.pos.y, mapHeight - k.height() / 2));
      k.camPos(k.width() / 2, targetCamY);
    });
  });
}
