import { createPlayer } from "../entities/player.js";
import { createDemon } from "../entities/demon.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Escena: "La Sala del Trono del Rey Demonio" (Arena del Jefe Final).
 *
 * Características:
 * - El enfrentamiento definitivo: Mili contra el Rey Demonio.
 * - Gran salón gótico del trono (27 cols x 15 filas = 648 x 360 px).
 * - Balcones a múltiples alturas y trampolines para ganar altura y pisar al jefe.
 * - Barra de vida del jefe en el HUD, ataques de tajo y golpe al suelo, y modo furia.
 * - Transición directa al nivel secreto (si se alcanza el umbral de puntos) o a la pantalla de victoria.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initThrone(k) {
  k.scene("throne", () => {
    gameState.currentLevel = 4; // Capítulo del jefe final

    const tileSize = 24;
    const cols = 27;
    const rows = 15;
    const mapWidth = cols * tileSize;  // 648 px
    const mapHeight = rows * tileSize; // 360 px

    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    // --- Fondo atmosférico de fortaleza oscura ---
    k.add([
      k.sprite("bg_level3"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Superposición carmesí oscura para la sala del trono
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(24, 6, 12),
      k.opacity(0.42),
      k.fixed(),
      k.z(-8)
    ]);

    // Diseño de la Sala del Trono: 27 columnas x 15 filas
    const layout = [
      "##                       ##", // 0 Techo
      "##                       ##", // 1
      "##   H               H   ##", // 2 Corazones curativos en balcones altos
      "##  ---             ---  ##", // 3 Balcones altos
      "##                       ##", // 4
      "##   T       G       T   ##", // 5 Trampolines para impulsarse sobre el jefe
      "##  ===             ===  ##", // 6 Balcones medios
      "##                       ##", // 7
      "##       ---   ---       ##", // 8 Plataformas de paso para esquivar
      "##                       ##", // 9
      "##  ===             ===  ##", // 10 Plataformas laterales de acceso
      "##                       ##", // 11
      "##  ^^^^           ^^^^  ##", // 12 Pinchos perimetrales de peligro
      "##=======================##", // 13 Suelo principal de la arena (y = 312)
      "###########################"  // 14 Cimiento sólido
    ];

    // Estructuras de tiles visuales y segmentos de colisión
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

    // Renderizador de tilemap con recorte por frustum
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

    // Colisionadores estáticos consolidados:
    // Límite izquierdo
    k.add([
      k.rect(48, mapHeight),
      k.pos(0, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // Límite derecho
    k.add([
      k.rect(48, mapHeight),
      k.pos(mapWidth - 48, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // Base sólida del suelo
    k.add([
      k.rect(mapWidth, 100),
      k.pos(0, 14 * tileSize),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);

    // Colisionadores de suelo
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

    // Colisionadores de plataformas
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

    // Inicializa el HUD
    const hud = createHUD(k, "SALA DEL TRONO");

    // Aparición de Mili en la entrada sobre el balcón izquierdo
    const player = createPlayer(k, 80, 220, true, 380);

    // Crea la barra de vida del jefe en el HUD
    const bossBar = hud.createBossBar("REY DEMONIO", 10);

    // Aparición del jefe Rey Demonio en el trono a la derecha
    const demonBoss = createDemon(k, 450, 275, bossBar, () => {
      // Secuencia de victoria al derrotar al jefe
      k.wait(1.5, () => {
        if (gameState.score >= gameState.secretScoreThreshold) {
          k.go("secret");
        } else {
          k.go("victory");
        }
      });
    });

    // Cartel dramático de entrada
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

    /**
     * Muestra un texto flotante ascendente con desvanecimiento.
     *
     * @param {import("kaboom").Vec2} pos - Posición inicial del aviso
     * @param {string} txt - Texto a mostrar
     * @param {import("kaboom").Color} [col] - Color del texto
     */
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

    // --- Colisiones y disparadores interactivos ---
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

    // Trampolines (supersalto para alcanzar balcones y pisar al jefe)
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

    // Combate contra el jefe Rey Demonio
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

    // Límite lateral de la arena para el jugador
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
