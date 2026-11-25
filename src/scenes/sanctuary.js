import { createPlayer } from "../entities/player.js";
import {
  createBloodshotEye,
  createRedCap,
  createCrushingCyclops,
  createStoneTroll
} from "../entities/basic_monsters.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Secret Ancient Sanctuary (Disguised 3rd Easter Egg Realm)
 * 
 * Unlocked only when all decorative flower vases in Level 1 are broken,
 * revealing an ethereal portal within Dungeon Green.
 * 
 * Features:
 * - Real-world mysterious photo background with atmospheric cosmic vignette.
 * - Basic Asset Pack enemy roster:
 *   - Bloodshot Eyes (aerial hovering sentries)
 *   - Red Caps (rapid subterranean goblins)
 *   - Crushing Cyclops (imposing 6 HP brute mini-boss)
 * - Aerial trampolines and multi-tier platforms.
 * - Defeating the sanctuary guardians activates the celestial exit portal (+3000 bonus).
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initSanctuary(k) {
  k.scene("sanctuary", () => {
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    const tileSize = 24;
    const cols = 30;
    const rows = 15;
    const mapWidth = cols * tileSize;  // 720 px
    const mapHeight = rows * tileSize; // 360 px

    // --- Atmospheric Photo Background ---
    k.add([
      k.sprite("bg_sanctuary"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 306, k.height() / 908),
      k.z(-10)
    ]);

    // Cosmic atmospheric vignette overlay
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(10, 16, 26),
      k.opacity(0.42),
      k.fixed(),
      k.z(-8)
    ]);

    // Title banner under HUD
    k.add([
      k.rect(520, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(12, 18, 28),
      k.opacity(0.88),
      k.fixed(),
      k.z(80)
    ]);

    const titleText = k.add([
      k.text("SANTUARIO ANCESTRAL: Juicio de los Guardianes", {
        font: "pressstart",
        size: 7.5
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(150, 220, 255),
      k.fixed(),
      k.z(81)
    ]);

    titleText.onUpdate(() => {
      titleText.opacity = k.wave(0.7, 1, k.time() * 3);
    });

    // 30 cols x 15 rows arena layout
    const layout = [
      "##                          ##", // 0
      "##                          ##", // 1
      "##  G   ---        ---   G  ##", // 2 High ledges with gems
      "##                          ##", // 3
      "##   T                  T   ##", // 4 Trampolines
      "##  ===    $$$  $$$    ===  ##", // 5 Mid balconies
      "##                          ##", // 6
      "##       ---      ---       ##", // 7 Stepping platforms
      "##                          ##", // 8
      "##   ---              ---   ##", // 9 Lower ledges
      "##                          ##", // 10
      "##  ^^^^              ^^^^  ##", // 11 Hazard spikes on sides
      "## ======            ====== ##", // 12
      "## @                      D ##", // 13 Ground floor: Mili & Return portal
      "=============================="  // 14 Solid ground foundation
    ];

    let player = null;
    const enemies = [];
    let exitPortal = null;
    let totalEnemies = 0;
    let defeatedEnemies = 0;

    // Helper for score/floating popups
    function showPopup(pos, txt, col = k.rgb(255, 230, 80)) {
      const popup = k.add([
        k.text(txt, { font: "pressstart", size: 8 }),
        k.pos(pos.x, pos.y - 12),
        k.anchor("center"),
        k.color(col),
        k.z(35)
      ]);
      popup.onUpdate(() => {
        popup.pos.y -= 25 * k.dt();
      });
      k.wait(0.6, () => popup.destroy());
    }

    // Consolidated colliders
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    let playerSpawnX = 72;
    let playerSpawnY = 300;
    let exitPortalX = 640;
    let exitPortalY = 290;

    for (let row = 0; row < rows; row++) {
      const line = layout[row];
      let col = 0;

      while (col < cols) {
        const char = line[col];
        const x = col * tileSize;
        const y = row * tileSize;

        if (char === "=") {
          const startCol = col;
          while (col < cols && line[col] === "=") {
            visualCols[col].push({ sprite: "dungeon_top", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          groundSegments.push({ row, col: startCol, len: length });
        } else if (char === "#") {
          const startCol = col;
          while (col < cols && line[col] === "#") {
            visualCols[col].push({ sprite: "dungeon_wall", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          wallSegments.push({ row, col: startCol, len: length });
        } else if (char === "-") {
          const startCol = col;
          while (col < cols && line[col] === "-") {
            visualCols[col].push({ sprite: "dungeon_platform", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          platformSegments.push({ row, col: startCol, len: length });
        } else {
          switch (char) {
            case "$":
              k.add([
                k.sprite("coin"),
                k.pos(x + 12, y + 12),
                k.scale(tileSize / 18),
                k.area(),
                k.anchor("center"),
                k.z(2),
                "coin"
              ]);
              break;

            case "G":
              k.add([
                k.sprite("gem"),
                k.pos(x + 12, y + 12),
                k.scale(tileSize / 18),
                k.area(),
                k.anchor("center"),
                k.z(2),
                "gem"
              ]);
              break;

            case "^":
              k.add([
                k.sprite("dungeon_spikes"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(2, 10), 12, 6) }),
                k.z(2),
                "spikes",
                "hazard"
              ]);
              break;

            case "T":
              k.add([
                k.sprite("spring"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(0), 16, 16) }),
                k.z(2),
                "spring"
              ]);
              break;

            case "@":
              playerSpawnX = x + 12;
              playerSpawnY = y + 10;
              break;

            case "D":
              exitPortalX = x + 12;
              exitPortalY = y + 4;
              break;

            default:
              break;
          }
          col++;
        }
      }
    }

    // Consolidated ground colliders
    groundSegments.forEach((seg) => {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        k.z(1),
        "ground",
        "solid"
      ]);
    });

    // Consolidated wall colliders
    wallSegments.forEach((seg) => {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        k.z(1),
        "wall",
        "solid"
      ]);
    });

    // Solid platform colliders
    platformSegments.forEach((seg) => {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        k.z(1),
        "platform",
        "solid"
      ]);
    });

    // Spawn player
    player = createPlayer(k, playerSpawnX, playerSpawnY);
    gameState.player = player;

    // Zero-allocation camera frustum culling on static visuals
    const spawnedVisualsByCol = Array.from({ length: cols }, () => []);
    let prevMinCol = -1;
    let prevMaxCol = -1;

    function updateTileVisibility() {
      const camX = k.camPos().x;
      const halfW = k.width() / 2;
      const minCol = Math.max(0, Math.floor((camX - halfW - 48) / tileSize));
      const maxCol = Math.min(cols - 1, Math.floor((camX + halfW + 48) / tileSize));

      if (minCol === prevMinCol && maxCol === prevMaxCol) return;

      for (let c = prevMinCol; c <= prevMaxCol; c++) {
        if (c < 0 || c >= cols) continue;
        if (c < minCol || c > maxCol) {
          const list = spawnedVisualsByCol[c];
          for (let i = 0; i < list.length; i++) {
            list[i].destroy();
          }
          list.length = 0;
        }
      }

      for (let c = minCol; c <= maxCol; c++) {
        if (c < prevMinCol || c > prevMaxCol) {
          const tiles = visualCols[c];
          const list = spawnedVisualsByCol[c];
          for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            const obj = k.add([
              k.sprite(t.sprite),
              k.pos(t.pos),
              k.scale(tileSize / 16),
              k.z(0)
            ]);
            list.push(obj);
          }
        }
      }

      prevMinCol = minCol;
      prevMaxCol = maxCol;
    }

    updateTileVisibility();

    // --- Spawn Basic Monster Pack Guardians ---
    function onMonsterDied() {
      defeatedEnemies++;
      if (defeatedEnemies >= totalEnemies) {
        onAllMonstersDefeated();
      }
    }

    // 1. Two Bloodshot Eyes patrolling the high skies
    enemies.push(createBloodshotEye(k, 180, 75, 70, onMonsterDied));
    enemies.push(createBloodshotEye(k, 500, 75, 70, onMonsterDied));

    // 2. Two Red Cap goblins patrolling mid balconies
    enemies.push(createRedCap(k, 250, 105, 50, onMonsterDied));
    enemies.push(createRedCap(k, 430, 105, 50, onMonsterDied));

    // 3. One Crushing Cyclops brute guarding the central sanctum floor
    enemies.push(createCrushingCyclops(k, 360, 300, 80, onMonsterDied));

    totalEnemies = enemies.length; // 5 monsters

    // Spawn the return portal initially closed / dormant
    exitPortal = k.add([
      k.sprite("door_closed"),
      k.pos(exitPortalX, exitPortalY),
      k.scale(tileSize / 16),
      k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
      k.anchor("center"),
      k.z(2),
      "sanctuary_portal"
    ]);

    // Victorious sequence when all monsters are defeated
    let trialCompleted = false;
    function onAllMonstersDefeated() {
      if (trialCompleted) return;
      trialCompleted = true;

      k.play("win");
      k.shake(10);
      gameState.addScore(3000);

      // Transform exit portal to radiant open portal
      if (exitPortal) {
        exitPortal.use(k.sprite("door_open"));
        exitPortal.color = k.rgb(160, 255, 210);

        // Radiant pulsing glow
        exitPortal.onUpdate(() => {
          exitPortal.scale = k.vec2(tileSize / 16 * k.wave(0.95, 1.15, k.time() * 4));
        });
      }

      // Grand Victory Banner
      k.add([
        k.rect(540, 70),
        k.pos(k.width() / 2, k.height() / 2 - 20),
        k.anchor("center"),
        k.color(10, 24, 30),
        k.opacity(0.95),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡SANTUARIO PURIFICADO! (+3000 BONUS)", {
          font: "pressstart",
          size: 9.5
        }),
        k.pos(k.width() / 2, k.height() / 2 - 32),
        k.anchor("center"),
        k.color(140, 255, 200),
        k.fixed(),
        k.z(151)
      ]);

      k.add([
        k.text("¡El portal ancestral se ha despertado!", {
          font: "pressstart",
          size: 7.5
        }),
        k.pos(k.width() / 2, k.height() / 2 - 8),
        k.anchor("center"),
        k.color(240, 240, 255),
        k.fixed(),
        k.z(151)
      ]);
    }

    // Portal Exit Interaction
    let enteredExit = false;
    player.onCollide("sanctuary_portal", () => {
      if (enteredExit) return;
      enteredExit = true;
      k.play("win");

      k.add([
        k.rect(k.width(), 80),
        k.pos(0, k.height() / 2 - 40),
        k.color(10, 16, 26),
        k.opacity(0.95),
        k.fixed(),
        k.z(200)
      ]);

      k.add([
        k.text("RETORNANDO DEL SANTUARIO", { font: "pressstart", size: 10 }),
        k.pos(k.width() / 2, k.height() / 2 - 10),
        k.anchor("center"),
        k.color(140, 255, 220),
        k.fixed(),
        k.z(201)
      ]);

      k.add([
        k.text("La aventura continúa...", { font: "pressstart", size: 7.5 }),
        k.pos(k.width() / 2, k.height() / 2 + 12),
        k.anchor("center"),
        k.color(220, 220, 240),
        k.fixed(),
        k.z(201)
      ]);

      k.wait(2.0, () => {
        // Return safely to Level 2
        gameState.currentLevel = 2;
        k.go("level2");
      });
    });

    // Combat with Basic Monsters (Sword Melee & Aerial Stomps)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        // Stomp deals 2 critical damage with bounce
        enemy.takeDamage(2, player.pos.x);
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
        return;
      }

      // If Mili is actively shielding and facing the monster, block the strike
      if (player.isShielding) {
        const facingEnemy = (player.flipX && enemy.pos.x < player.pos.x) ||
                            (!player.flipX && enemy.pos.x > player.pos.x);
        if (facingEnemy) {
          k.play("hit");
          showPopup(player.pos, "¡BLOQUEO!", k.rgb(180, 220, 255));
          const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
          player.move(knockDir * 60, 0);
          return;
        }
      }

      const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    // Spring trampoline bounce
    player.onCollide("spring", (s) => {
      k.play("jump");
      player.jump(player.jumpForce * 1.55);
      player.hasDoubleJumped = false;
      showPopup(s.pos, "¡IMPULSO!", k.rgb(120, 255, 200));
    });

    // Spikes hazard
    player.onCollide("spikes", () => {
      if (player.isHurt || player.isDead) return;
      player.receiveDamage(0);
    });

    // Coins (+100)
    player.onCollide("coin", (c) => {
      c.destroy();
      k.play("coin");
      gameState.addScore(100);
      showPopup(c.pos, "+100");
    });

    // Gems (+250)
    player.onCollide("gem", (g) => {
      g.destroy();
      k.play("coin");
      gameState.addScore(250);
      showPopup(g.pos, "+250", k.rgb(120, 220, 255));
    });

    // Heart drops
    player.onCollide("heart_drop", (h) => {
      h.destroy();
      k.play("powerup");
      gameState.gainLife();
      showPopup(h.pos, "+1 VIDA", k.rgb(255, 100, 140));
    });

    // Main Update Loop
    k.onUpdate(() => {
      if (!player) return;

      // Lateral bounds
      if (player.pos.x < 16) player.pos.x = 16;
      if (player.pos.x > mapWidth - 16) player.pos.x = mapWidth - 16;

      // Bottom pit safety
      if (player.pos.y > mapHeight + 50 && !player.isDead) {
        player.receiveDamage(0);
        player.pos.x = playerSpawnX;
        player.pos.y = playerSpawnY;
      }

      // Smooth camera follow
      const targetCamX = Math.max(
        k.width() / 2,
        Math.min(mapWidth - k.width() / 2, player.pos.x)
      );
      k.camPos(
        k.camPos().x + (targetCamX - k.camPos().x) * 5 * k.dt(),
        k.height() / 2
      );

      updateTileVisibility();
    });

    // Initialize HUD
    createHUD(k);
  });
}
