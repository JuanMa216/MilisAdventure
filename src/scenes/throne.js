import { createPlayer } from "../entities/player.js";
import { createDemon } from "../entities/demon.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Scene: "La Sala del Trono del Rey Demonio" (Final Boss Arena)
 * 
 * Features:
 * - The ultimate confrontation: Mili vs. Rey Demonio (Demon King).
 * - Grand Gothic throne room (27 cols x 15 rows = 648 x 360 px).
 * - Multi-tier balconies and trampolines allowing Mili to gain aerial height to stomp the boss.
 * - Dynamic HUD Boss Health Bar, cleave & ground slam mechanics, and enrage mode.
 * - Direct transition to secret level (if Easter egg score requirement met) or victory screen.
 * 
 * @param {import("kaboom").KaboomCtx} k - Kaboom context
 */
export function initThrone(k) {
  k.scene("throne", () => {
    gameState.currentLevel = 4; // Final Boss Chapter

    const tileSize = 24;
    const cols = 27;
    const rows = 15;
    const mapWidth = cols * tileSize;  // 648 px
    const mapHeight = rows * tileSize; // 360 px

    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    // --- Atmospheric Dark Fortress Background ---
    k.add([
      k.sprite("bg_level3"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Ominous deep crimson overlay for the throne room
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(24, 6, 12),
      k.opacity(0.42),
      k.fixed(),
      k.z(-8)
    ]);

    // Throne Room Layout:
    // Columns: 27, Rows: 15
    const layout = [
      "##                       ##", // 0 Ceiling
      "##                       ##", // 1
      "##   H               H   ##", // 2 Restorative hearts on high balconies
      "##  ---             ---  ##", // 3 High balconies
      "##                       ##", // 4
      "##   T       G       T   ##", // 5 Trampolines to launch above boss
      "##  ===             ===  ##", // 6 Mid balconies
      "##                       ##", // 7
      "##       ---   ---       ##", // 8 Stepping platforms for evasion
      "##                       ##", // 9
      "##  ===             ===  ##", // 10 Side approach platforms
      "##                       ##", // 11
      "##  ^^^^           ^^^^  ##", // 12 Perimeter hazard spikes
      "##=======================##", // 13 Main Throne Arena Floor (y = 312)
      "###########################"  // 14 Bedrock foundation
    ];

    // Visual tiles and segment colliders
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    for (let row = 0; row < rows; row++) {
      const line = layout[row];
      let col = 0;

      while (col < cols) {
        const char = line[col];
        const x = col * tileSize;
        const y = row * tileSize;

        if (char === "#") {
          const startCol = col;
          while (col < cols && line[col] === "#") {
            visualCols[col].push({ sprite: "dungeon_wall", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          wallSegments.push({ row, col: startCol, len: length });
        } else if (char === "=") {
          const startCol = col;
          while (col < cols && line[col] === "=") {
            visualCols[col].push({ sprite: "dungeon_top", pos: k.vec2(col * tileSize, y) });
            col++;
          }
          const length = col - startCol;
          groundSegments.push({ row, col: startCol, len: length });
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
            case "^":
              k.add([
                k.sprite("dungeon_spikes"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(2, 10), 12, 6) }),
                k.z(3),
                "spikes"
              ]);
              break;

            case "T":
              k.add([
                k.sprite("spring"),
                k.pos(x, y),
                k.scale(tileSize / 16),
                k.area({ shape: new k.Rect(k.vec2(0, 4), 16, 12) }),
                k.z(4),
                "spring"
              ]);
              break;

            case "H":
              k.add([
                k.sprite("heart_full"),
                k.pos(x + 4, y + 4),
                k.scale(tileSize / 16),
                k.area(),
                k.z(5),
                "heart_item"
              ]);
              break;

            case "G":
              k.add([
                k.sprite("gem"),
                k.pos(x + 4, y + 4),
                k.scale(tileSize / 16),
                k.area(),
                k.z(5),
                "gem"
              ]);
              break;

            default:
              break;
          }
          col++;
        }
      }
    }

    // Frustum-culled tilemap renderer
    const tilemap = k.add([
      k.z(1)
    ]);
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

    // Consolidated Static Colliders:
    // Left boundary
    k.add([
      k.rect(48, mapHeight),
      k.pos(0, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // Right boundary
    k.add([
      k.rect(48, mapHeight),
      k.pos(mapWidth - 48, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // Bedrock base
    k.add([
      k.rect(mapWidth, 100),
      k.pos(0, 14 * tileSize),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);

    // Ground colliders
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

    // Platform colliders
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

    // Initialize HUD
    const hud = createHUD(k, "SALA DEL TRONO");

    // Spawn Mili at the entrance on the left balcony
    const player = createPlayer(k, 80, 220, true, 380);

    // Spawn Boss Health Bar in the HUD
    const bossBar = hud.createBossBar("REY DEMONIO", 10);

    // Spawn Demon King Boss at the throne on the right
    const demonBoss = createDemon(k, 450, 275, bossBar, () => {
      // Victory Sequence callback upon boss defeat
      k.wait(1.5, () => {
        if (gameState.score >= gameState.secretScoreThreshold) {
          k.go("secret");
        } else {
          k.go("victory");
        }
      });
    });

    // Dramatic Entrance Banner
    const arenaBanner = k.add([
      k.text("¡SALA DEL TRONO: EL REY DEMONIO!", {
        font: "pressstart",
        size: 9
      }),
      k.pos(k.width() / 2, 75),
      k.anchor("center"),
      k.color(255, 60, 60),
      k.fixed(),
      k.z(100)
    ]);
    k.wait(3.0, () => arenaBanner.destroy());

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

    // --- Interactive Collisions & Triggers ---
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

    // Trampolines (Super jump to reach balconies and stomp boss)
    player.onCollide("spring", (spr) => {
      k.play("spring");
      player.jump(player.jumpForce * 1.45);
      player.hasDoubleJumped = false;
      spr.scale = k.vec2((tileSize / 16) * 1.3, (tileSize / 16) * 0.7);
      k.wait(0.15, () => {
        spr.scale = k.vec2(tileSize / 16, tileSize / 16);
      });
    });

    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // Combat with Demon Boss
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        if (enemy.is("demon")) {
          enemy.takeDamage(1, player.pos.x);
        } else {
          enemy.die();
        }
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
        return;
      }

      const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    player.onCollide("demon_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    // Arena lateral clamping
    k.onUpdate(() => {
      if (!player) return;
      if (player.pos.x < 55) {
        player.pos.x = 55;
      } else if (player.pos.x > mapWidth - 55) {
        player.pos.x = mapWidth - 55;
      }
    });
  });
}
