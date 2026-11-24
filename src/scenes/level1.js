import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Level 1: "Castillo y Ruinas Medievales"
 * 
 * Uses the authentic RottingPixels medieval castle tileset:
 * - Stone brick floor (stone_top)
 * - Castle masonry wall (stone_wall)
 * - Wooden beam platforms (wood_platform)
 * - Castle iron spikes (castle_spikes)
 * - Shield Block + Jump mechanics (Req-5)
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initLevel1(k) {
  k.scene("level1", () => {
    gameState.currentLevel = 1;

    // Reset camera and gravity
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    // --- Req-8: Twilight Castle Background ---
    k.add([
      k.sprite("bg_level1"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Discrete controls hint under HUD banner
    k.add([
      k.rect(460, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(14, 12, 22),
      k.opacity(0.85),
      k.fixed(),
      k.z(80)
    ]);

    k.add([
      k.text("Z/J: Atacar  •  SHIFT/C: Escudo  •  ESPACIO: Saltar", {
        font: "pressstart",
        size: 8
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(210, 200, 240),
      k.fixed(),
      k.z(81)
    ]);

    // --- Level Layout (ASCII Grid) ---
    // Tile size: 24x24 px. 15 rows = 360 px
    const mapLayout = [
      "                                                                            ",
      "                                                                            ",
      "                                                      $$$            D      ",
      "               $$$                 G                                        ",
      "              ====                ---                              =====    ",
      "                       VVV                S                        #####    ",
      "                       ---              ====             ---                ",
      "             S                          ####                                ",
      "            ===                ---             S               ---          ",
      "            ###                               ===                           ",
      "     $$               T                       ###                           ",
      "    ====             ===               ^^^^^           T                    ",
      "    ####             ###              =======         ===           ^^      ",
      "  @         V                         #######                     ====      ",
      "====================      =================================================="
    ];

    const tileSize = 24;
    const cols = mapLayout[0].length; // 76
    const rows = mapLayout.length;    // 15
    const mapWidth = cols * tileSize;  // 1824 px
    const mapHeight = rows * tileSize; // 360 px

    let player = null;
    const slimes = [];

    // Helper to spawn floating score text
    function showScorePopup(pos, pts) {
      const popup = k.add([
        k.text(`+${pts}`, { font: "pressstart", size: 8 }),
        k.pos(pos.x, pos.y - 10),
        k.anchor("center"),
        k.color(255, 230, 80),
        k.z(30)
      ]);
      popup.onUpdate(() => {
        popup.pos.y -= 25 * k.dt();
      });
      k.wait(0.5, () => popup.destroy());
    }

    // Pre-calculate visual tiles grouped by column for zero-allocation horizontal frustum culling
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    // Parse the map layout
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
            visualCols[col].push({ sprite: "stone_top", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          groundSegments.push({ row, col: startCol, len: length });
        } else if (char === "#") {
          const startCol = col;
          while (col < cols && line[col] === "#") {
            visualCols[col].push({ sprite: "stone_wall", pos: k.vec2(col * tileSize, y) });
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
        } else if (char === "V") {
          // Decorative flower vase
          visualCols[col].push({ sprite: "flower_vase", pos: k.vec2(x, y) });
          col++;
        } else {
          // Interactive objects
          switch (char) {
            case "$":
              // Coin (+100 points)
              k.add([
                k.sprite("coin"),
                k.pos(x + 12, y + 12),
                k.scale(24 / 18),
                k.area(),
                k.anchor("center"),
                k.z(2),
                "coin"
              ]);
              break;

            case "G":
              // Gem (+250 points)
              k.add([
                k.sprite("gem"),
                k.pos(x + 12, y + 12),
                k.scale(24 / 18),
                k.area(),
                k.anchor("center"),
                k.z(2),
                "gem"
              ]);
              break;

            case "^":
              // Castle iron spikes (precise player-favorable hazard hitbox)
              k.add([
                k.sprite("castle_spikes"),
                k.pos(x, y),
                k.scale(24 / 16),
                k.area({ shape: new k.Rect(k.vec2(2, 10), 12, 6) }),
                k.z(2),
                "hazard",
                "spikes"
              ]);
              break;

            case "T":
              // Trampoline / Spring mechanic
              k.add([
                k.sprite("spring"),
                k.pos(x, y),
                k.scale(24 / 18),
                k.area(),
                k.z(2),
                "spring"
              ]);
              break;

            case "D":
              // Level exit door (Authentic medieval arched wooden door, 16x32)
              k.add([
                k.sprite("door_closed"),
                k.pos(x, y),
                k.scale(24 / 16),
                k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
                k.z(2),
                "exit_door"
              ]);
              break;

            default:
              break;
          }
          col++;
        }
      }
    }

    // Dedicated frustum-culled tilemap renderer:
    // Only draws columns visible within horizontal viewport (+48px padding)
    // Zero WebGL draw calls for off-screen tiles!
    const tilemap = k.add([
      k.z(1)
    ]);
    const tileScale = k.vec2(24 / 16, 24 / 16);

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

    // Consolidated Static Physics Colliders:
    // Replaces 154 individual tile bodies with 24 seamless bodies!

    // 1. Consolidated Ground Colliders (Continuous seamless rectangles for all '=' segments)
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

    // 2. Consolidated Wall Colliders (Continuous seamless rectangles for all '#' segments)
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

    // 3. Consolidated Platform Colliders (Continuous seamless rectangles for all '-' segments)
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

    // --- Map Boundaries (Req-5) ---
    // Prevent player and enemies from falling off the start (left) or end (right) of the map

    // Left solid boundary (x <= 0)
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(-32, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // Right solid boundary (x >= mapWidth)
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(mapWidth, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // Solid foundation bedrock under ground tiles to prevent physics tunneling
    k.add([
      k.rect(480, 100),
      k.pos(0, 360),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);
    k.add([
      k.rect(1200, 100),
      k.pos(624, 360),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);

    // Animated glowing "SALIDA" indicator above the castle door
    const exitLabel = k.add([
      k.text("SALIDA", { font: "pressstart", size: 8 }),
      k.pos(69 * 24 + 12, 2 * 24 - 10),
      k.anchor("center"),
      k.color(255, 230, 100),
      k.z(10)
    ]);
    exitLabel.onUpdate(() => {
      exitLabel.opacity = k.wave(0.4, 1, k.time() * 4);
    });

    // Spawn player at "@" symbol position (aligned flush with ground)
    player = createPlayer(k, 40, 322, true);

    // Spawn Slime enemies resting flush on their platform surfaces
    slimes.push(createSlime(k, 312, 180, 24));
    slimes.push(createSlime(k, 1008, 132, 36));
    slimes.push(createSlime(k, 1128, 204, 24));
    slimes.push(createSlime(k, 1320, 276, 24));

    // Initialize HUD (Req-3 & Req-4)
    createHUD(k, "Nivel 1: Castillo");

    // --- Collisions & Interactions ---

    // 1. Collect Coins (Req-3: Score counter)
    player.onCollide("coin", (coin) => {
      coin.destroy();
      k.play("coin");
      gameState.addScore(100);
      showScorePopup(coin.pos, 100);
    });

    // 2. Collect Gems (Req-3: Score counter)
    player.onCollide("gem", (gem) => {
      gem.destroy();
      k.play("coin");
      gameState.addScore(250);
      showScorePopup(gem.pos, 250);
    });

    // 3. Spikes Hazard (Req-4: Lose life)
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // 4. Spring / Trampoline Mechanic (Req-5: Level mechanic)
    player.onCollide("spring", () => {
      k.play("spring");
      player.jump(player.jumpForce * 1.5);
      player.hasDoubleJumped = false;
    });

    // 5. Enemy Interaction (Req-5: Stomp vs Shield Block vs Lateral Hit)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead) return;

      // Robust stomp check: Player is above enemy in the air or falling
      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        enemy.die();
        player.jump(player.jumpForce * 0.85); // Bounce up
        player.hasDoubleJumped = false;
        k.play("jump");
      } else {
        // Lateral hit: Checks shield block or takes damage
        const knockbackDirection = player.pos.x < enemy.pos.x ? -1 : 1;
        player.receiveDamage(knockbackDirection);
      }
    });

    // 6. Level Complete / Exit Door Transition
    let levelFinished = false;
    player.onCollide("exit_door", (door) => {
      if (levelFinished) return;
      levelFinished = true;

      door.use(k.sprite("door_open"));
      k.play("win");

      // Banner message
      k.add([
        k.rect(360, 60),
        k.pos(k.width() / 2, k.height() / 2),
        k.anchor("center"),
        k.color(18, 14, 28),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡NIVEL 1 SUPERADO!", { font: "pressstart", size: 12 }),
        k.pos(k.width() / 2, k.height() / 2 - 10),
        k.anchor("center"),
        k.color(100, 240, 140),
        k.fixed(),
        k.z(151)
      ]);

      k.add([
        k.text("Entrando a las Catacumbas...", { font: "pressstart", size: 8 }),
        k.pos(k.width() / 2, k.height() / 2 + 14),
        k.anchor("center"),
        k.color(220, 220, 220),
        k.fixed(),
        k.z(151)
      ]);

      k.wait(2.0, () => {
        k.go("level2");
      });
    });

    // Keep player strictly within map limits and smoothly follow with camera
    k.onUpdate(() => {
      if (!player) return;

      // Hard clamp within map boundaries
      if (player.pos.x < 10) {
        player.pos.x = 10;
      } else if (player.pos.x > mapWidth - 10) {
        player.pos.x = mapWidth - 10;
      }

      // Camera smoothly follows player horizontally within world bounds
      const targetCamX = Math.max(k.width() / 2, Math.min(player.pos.x, mapWidth - k.width() / 2));
      k.camPos(targetCamX, k.height() / 2);
    });
  });
}
