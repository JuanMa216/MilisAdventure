import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Secret Bonus Dungeon: "La Garganta Esmeralda"
 * 
 * Features & Architecture:
 * - Triggered when entering the catacomb portal with the Green Grimoire (book_green).
 * - Full performance optimization: zero-allocation frustum culling on static tilemap.
 * - Continuous consolidated colliders for ground, walls, and platforms (eliminates floor phasing).
 * - Deep foundation bedrock on row 14 to eliminate physics tunneling.
 * - Vertical moving platform over toxic stalagmites with zero-allocation passenger dragging.
 * - Rewards player with +500 bonus points and returns safely to Level 2.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initDungeonGreen(k) {
  k.scene("dungeon_green", () => {
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    const tileSize = 24;
    const cols = 40;
    const rows = 15;
    const mapWidth = cols * tileSize;   // 960 px
    const mapHeight = rows * tileSize; // 360 px

    // --- Atmospheric Toxic Emerald Cavern Background ---
    k.add([
      k.sprite("bg_level2"),
      k.pos(0, 0),
      k.color(100, 240, 160),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Ominous emerald green overlay
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(8, 26, 16),
      k.opacity(0.35),
      k.fixed(),
      k.z(-8)
    ]);

    // Hint banner under HUD
    k.add([
      k.rect(520, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(10, 24, 16),
      k.opacity(0.85),
      k.fixed(),
      k.z(80)
    ]);

    k.add([
      k.text("GARGANTA ESMERALDA: Foso Tóxico. Encuentra el portal de retorno", {
        font: "pressstart",
        size: 7
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(140, 255, 180),
      k.fixed(),
      k.z(81)
    ]);

    // 40 columns x 15 rows map
    const mapLayout = [
      " G G G                                  ", // 0
      " G G                  $$$               ", // 1
      "                    =====            D  ", // 2
      "                                        ", // 3
      "          G              G         ==== ", // 4
      "         ---            ---        #### ", // 5
      "                                S       ", // 6
      "    S          ---             ---      ", // 7
      "   ---                                  ", // 8
      "        T             M                 ", // 9
      "       ===           ---           T    ", // 10
      "       ###   ^^^^^          ^^^^  ===   ", // 11
      "            =======        ====== ###   ", // 12
      " @          #######   S    ######       ", // 13
      "=========   ============================"  // 14
    ];

    let player = null;
    const enemies = [];

    // Helper for score/text popups
    function showPopup(pos, txt, col = k.rgb(255, 230, 80)) {
      const popup = k.add([
        k.text(txt, { font: "pressstart", size: 8 }),
        k.pos(pos.x, pos.y - 12),
        k.anchor("center"),
        k.color(col),
        k.z(30)
      ]);
      popup.onUpdate(() => {
        popup.pos.y -= 25 * k.dt();
      });
      k.wait(0.6, () => popup.destroy());
    }

    // Pre-calculate visual tiles grouped by column for frustum culling
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    let playerSpawnX = 48;
    let playerSpawnY = 322;
    let movingPlatX = 22 * tileSize;
    let movingPlatY = 9 * tileSize;

    // Parse map layout
    for (let row = 0; row < rows; row++) {
      const line = mapLayout[row];
      let col = 0;

      while (col < cols) {
        const char = line[col];
        const x = col * tileSize;
        const y = row * tileSize;

        if (char === "=") {
          const startCol = col;
          while (col < cols && line[col] === "=") {
            visualCols[col].push({ sprite: "cave_top", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          groundSegments.push({ row, col: startCol, len: length });
        } else if (char === "#") {
          const startCol = col;
          while (col < cols && line[col] === "#") {
            visualCols[col].push({ sprite: "cave_wall", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          wallSegments.push({ row, col: startCol, len: length });
        } else if (char === "-") {
          const startCol = col;
          while (col < cols && line[col] === "-") {
            visualCols[col].push({ sprite: "wood_platform", pos: k.vec2(col * tileSize, y) });
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
                k.sprite("cave_spikes"),
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

            case "D":
              k.add([
                k.sprite("door_open"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
                k.z(2),
                "return_portal"
              ]);
              break;

            case "@":
              playerSpawnX = x + 12;
              playerSpawnY = y + 10;
              break;

            case "S":
              enemies.push(createSlime(k, x + 12, y + 12, 28));
              break;

            case "M":
              movingPlatX = x;
              movingPlatY = y;
              break;

            default:
              break;
          }
          col++;
        }
      }
    }

    // --- Dedicated Frustum-Culled Tilemap Renderer ---
    const tilemap = k.add([k.z(1)]);
    const tileScale = k.vec2(tileSize / 16, tileSize / 16);

    tilemap.onDraw(() => {
      const camX = k.camPos().x;
      const minCol = Math.max(0, Math.floor((camX - 368) / tileSize));
      const maxCol = Math.min(cols - 1, Math.ceil((camX + 368) / tileSize));

      for (let c = minCol; c <= maxCol; c++) {
        const colTiles = visualCols[c];
        for (let i = 0; i < colTiles.length; i++) {
          const t = colTiles[i];
          k.drawSprite({
            sprite: t.sprite,
            pos: t.pos,
            scale: tileScale
          });
        }
      }
    });

    // --- Consolidated Static Physics Colliders (Zero Seam Hitching & Zero Phasing) ---

    // 1. Continuous Ground Colliders
    // Extends bottom foundation ground (row 14) 120px deep to completely eliminate physics tunneling
    for (const seg of groundSegments) {
      const height = seg.row === 14 ? 120 : tileSize;
      k.add([
        k.rect(seg.len * tileSize, height),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid",
        "ground"
      ]);
    }

    // 2. Continuous Wall Colliders
    for (const seg of wallSegments) {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid",
        "wall"
      ]);
    }

    // 3. Continuous One-Way Floating Platform Colliders
    for (const seg of platformSegments) {
      k.add([
        k.rect(seg.len * tileSize, tileSize),
        k.pos(seg.col * tileSize, seg.row * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid",
        "ground",
        "platform"
      ]);
    }

    // 4. Map Boundaries (Lateral Walls)
    k.add([
      k.rect(48, mapHeight + 600),
      k.pos(-48, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    k.add([
      k.rect(48, mapHeight + 600),
      k.pos(mapWidth, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // --- Vertical Moving Platform (Zero-Allocation Performance) ---
    const movingPlat = k.add([
      k.sprite("wood_platform"),
      k.pos(movingPlatX, movingPlatY),
      k.scale(tileSize / 16),
      k.area(),
      k.body({ isStatic: true }),
      k.z(2),
      "solid",
      "platform",
      {
        baseY: movingPlatY,
        deltaY: 0
      }
    ]);

    movingPlat.onUpdate(() => {
      const prevY = movingPlat.pos.y;
      movingPlat.pos.y = movingPlat.baseY + Math.sin(k.time() * 2) * 45;
      movingPlat.deltaY = movingPlat.pos.y - prevY;

      // Drag player if standing on the platform (fast check without bbox allocations)
      if (player && player.isGrounded()) {
        const platWidth = tileSize * (tileSize / 16);
        const isStanding =
          player.pos.x + 8 > movingPlat.pos.x &&
          player.pos.x - 8 < movingPlat.pos.x + platWidth &&
          Math.abs((player.pos.y + 13.7) - movingPlat.pos.y) < 6;

        if (isStanding) {
          player.pos.y += movingPlat.deltaY;
        }
      }
    });

    // Animated glowing label above Return Portal
    const portalLabel = k.add([
      k.text("RETORNO", { font: "pressstart", size: 8 }),
      k.pos(38 * tileSize + 12, 3 * tileSize - 10),
      k.anchor("center"),
      k.color(120, 240, 160),
      k.z(10)
    ]);
    portalLabel.onUpdate(() => {
      portalLabel.opacity = k.wave(0.5, 1, k.time() * 4);
    });

    // --- Secret Sanctuary Portal (Only spawned if all Level 1 flower vases were destroyed) ---
    if (gameState.allVasesDestroyed) {
      const doorCol = 3;
      const doorRow = 2;
      const doorX = doorCol * tileSize;
      const doorY = doorRow * tileSize;

      // Platform under the secret door (cols 2, 3, 4 at row 3)
      for (let c = 2; c <= 4; c++) {
        k.add([
          k.sprite("wood_platform"),
          k.pos(c * tileSize, (doorRow + 1) * tileSize),
          k.scale(tileSize / 16),
          k.z(2)
        ]);
      }

      k.add([
        k.rect(tileSize * 3, tileSize),
        k.pos(2 * tileSize, (doorRow + 1) * tileSize),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        k.z(1),
        "solid",
        "platform"
      ]);

      const secretDoor = k.add([
        k.sprite("door_open"),
        k.pos(doorX, doorY),
        k.scale(tileSize / 16),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
        k.color(140, 220, 255),
        k.z(3),
        "secret_sanctuary_door"
      ]);

      secretDoor.onUpdate(() => {
        secretDoor.opacity = k.wave(0.75, 1, k.time() * 3.5);
      });

      const secretLabel = k.add([
        k.text("SANTUARIO", { font: "pressstart", size: 6.5 }),
        k.pos(doorX + 12, doorY - 10),
        k.anchor("center"),
        k.color(160, 230, 255),
        k.z(10)
      ]);
      secretLabel.onUpdate(() => {
        secretLabel.opacity = k.wave(0.6, 1, k.time() * 3.5);
      });
    }

    // Spawn player
    player = createPlayer(k, playerSpawnX, playerSpawnY, true);

    // Initialize HUD
    createHUD(k, "Cámara Esmeralda");

    // --- Interactive Collisions & Triggers ---

    // 1. Coins & Collectibles
    player.onCollide("coin", (coin) => {
      coin.destroy();
      k.play("coin");
      gameState.addScore(100);
      showPopup(coin.pos, "+100");
    });

    player.onCollide("gem", (gem) => {
      gem.destroy();
      k.play("coin");
      gameState.addScore(250);
      showPopup(gem.pos, "+250", k.rgb(120, 255, 180));
    });

    // 2. Hazards & Springs
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    player.onCollide("spring", (spr) => {
      k.play("spring");
      player.jump(player.jumpForce * 1.55);
      player.hasDoubleJumped = false;
      spr.scale = k.vec2((tileSize / 16) * 1.3, (tileSize / 16) * 0.7);
      k.wait(0.15, () => {
        spr.scale = k.vec2(tileSize / 16, tileSize / 16);
      });
    });

    // 3. Enemy Interaction (Stomp vs Shield Block vs Lateral Hit)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || player.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        enemy.die();
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
      } else {
        const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
        player.receiveDamage(knockDir);
      }
    });

    // 4. Return Portal Transition back to Level 2
    let returned = false;
    player.onCollide("return_portal", () => {
      if (returned) return;
      returned = true;
      k.play("win");
      gameState.addScore(500);

      k.add([
        k.rect(k.width(), 80),
        k.pos(0, k.height() / 2 - 40),
        k.color(10, 24, 16),
        k.opacity(0.95),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡GARGANTA ESMERALDA SUPERADA! (+500 BONUS)", { font: "pressstart", size: 9 }),
        k.pos(k.width() / 2, k.height() / 2 - 14),
        k.anchor("center"),
        k.color(140, 255, 180),
        k.fixed(),
        k.z(151)
      ]);

      k.add([
        k.text("¡Este libro no conducía al Trono Real! Prueba otro...", {
          font: "pressstart",
          size: 7
        }),
        k.pos(k.width() / 2, k.height() / 2 + 10),
        k.anchor("center"),
        k.color(240, 220, 180),
        k.fixed(),
        k.z(151)
      ]);

      k.wait(2.8, () => {
        // Return to Level 2 with key reset so player can search for the true book
        gameState.hasKey = false;
        gameState.collectedBook = null;
        k.go("level2");
      });
    });

    // 5. Secret Sanctuary Portal Transition
    let enteredSanctuary = false;
    player.onCollide("secret_sanctuary_door", () => {
      if (enteredSanctuary) return;
      enteredSanctuary = true;
      k.play("win");
      k.shake(8);

      k.add([
        k.rect(k.width(), 80),
        k.pos(0, k.height() / 2 - 40),
        k.color(10, 18, 28),
        k.opacity(0.95),
        k.fixed(),
        k.z(200)
      ]);

      k.add([
        k.text("¿¿¿ PORTAL ANCESTRAL DESPERTADO ???", { font: "pressstart", size: 9 }),
        k.pos(k.width() / 2, k.height() / 2 - 12),
        k.anchor("center"),
        k.color(120, 220, 255),
        k.fixed(),
        k.z(201)
      ]);

      k.add([
        k.text("Viajando al santuario olvidado...", { font: "pressstart", size: 7 }),
        k.pos(k.width() / 2, k.height() / 2 + 12),
        k.anchor("center"),
        k.color(200, 230, 255),
        k.fixed(),
        k.z(201)
      ]);

      k.wait(1.5, () => {
        k.go("sanctuary");
      });
    });

    // --- Main Update Loop ---
    k.onUpdate(() => {
      if (!player) return;

      // Clamping within map lateral bounds
      if (player.pos.x < 10) player.pos.x = 10;
      else if (player.pos.x > mapWidth - 10) player.pos.x = mapWidth - 10;

      // Instant fatal death if falling into the bottomless pit (gap at col 9-11)
      if (player.pos.y > mapHeight + 50 && !player.isDead) {
        player.die();
      }

      // Smooth horizontal camera tracking
      const targetCamX = Math.max(k.width() / 2, Math.min(player.pos.x, mapWidth - k.width() / 2));
      k.camPos(targetCamX, k.height() / 2);
    });
  });
}
