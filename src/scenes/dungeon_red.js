import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createOrc } from "../entities/orc.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Mazmorra secreta de bonificación: "La Cripta Carmesí de las Llamas".
 *
 * Características y arquitectura:
 * - Se activa al entrar al portal de las catacumbas con el Grimorio Carmesí (`book_red`).
 * - Optimización completa: recorte por frustum sin asignaciones en el tilemap estático.
 * - Colisionadores continuos consolidados para suelo, muros y plataformas.
 * - Cimiento profundo en la fila 14 para evitar que los cuerpos atraviesen el suelo.
 * - Plataforma móvil horizontal sobre el abismo con arrastre del jugador.
 * - Recompensa al jugador con +500 puntos de bono y lo devuelve al Nivel 2.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initDungeonRed(k) {
  k.scene("dungeon_red", () => {
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    const tileSize = 24;
    const cols = 40;
    const rows = 15;
    const mapWidth = cols * tileSize;   // 960 px
    const mapHeight = rows * tileSize; // 360 px

    // --- Fondo atmosférico de caverna de magma ---
    k.add([
      k.sprite("bg_level2"),
      k.pos(0, 0),
      k.color(255, 110, 110),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Tinte rojo ígneo sobre el fondo
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(30, 8, 12),
      k.opacity(0.35),
      k.fixed(),
      k.z(-8)
    ]);

    // Cartel de pista bajo el HUD
    k.add([
      k.rect(520, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(28, 10, 14),
      k.opacity(0.85),
      k.fixed(),
      k.z(80)
    ]);

    k.add([
      k.text("CRIPTA CARMESÍ: Dimensión de Fuego. Encuentra el portal de retorno", {
        font: "pressstart",
        size: 7
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(255, 140, 120),
      k.fixed(),
      k.z(81)
    ]);

    // Mapa de 40 columnas x 15 filas
    const mapLayout = [
      "                                        ", // 0
      "                                        ", // 1
      "  E                  $$$                ", // 2 
      "                    =====             D ", // 3
      "                                        ", // 4 
      "          S              G         ==== ", // 5
      "         ---            ---        #### ", // 6
      "                                        ", // 7
      "               ---             ---      ", // 8
      "        T                               ", // 9
      "       ===            M                 ", // 10
      "       ###           ---           T    ", // 11
      "                    =====         ===   ", // 12
      " @                  #####   O     ###   ", // 13
      "=================   ===================="  // 14
    ];

    let player = null;
    const enemies = [];

    /**
     * Muestra un texto flotante ascendente con puntos o avisos.
     *
     * @param {import("kaboom").Vec2} pos - Posición inicial del aviso
     * @param {string} txt - Texto a mostrar
     * @param {import("kaboom").Color} [col] - Color del texto
     */
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

    // Precalcula los tiles visuales agrupados por columna para recorte por frustum
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    let playerSpawnX = 48;
    let playerSpawnY = 322;
    let movingPlatX = 21 * tileSize;
    let movingPlatY = 10 * tileSize;

    // Analiza el diseño del mapa
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

            case "E":
              // Activador oculto e invisible hacia la dimensión secreta
              k.add([
                k.rect(tileSize, tileSize * 2),
                k.pos(x, y),
                k.opacity(0),
                k.area(),
                k.z(2),
                "secret_creep_door"
              ]);
              break;

            case "@":
              playerSpawnX = x + 12;
              playerSpawnY = y + 10;
              break;

            case "S":
              enemies.push(createSlime(k, x + 12, y + 12, 28));
              break;

            case "O":
              enemies.push(createOrc(k, x + 12, y + 12, 40));
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

    // --- Renderizador de tilemap con recorte por frustum ---
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

    // --- Colisionadores físicos estáticos consolidados ---

    // 1. Colisionadores continuos de suelo
    // Extiende el cimiento inferior (fila 14) 120 px hacia abajo para evitar atravesar el suelo
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

    // 2. Colisionadores continuos de muros
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

    // 3. Colisionadores continuos de plataformas (suelo sólido)
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

    // 4. Límites laterales del mapa
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

    // --- Plataforma móvil horizontal ---
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
        baseX: movingPlatX,
        deltaX: 0
      }
    ]);

    movingPlat.onUpdate(() => {
      const prevX = movingPlat.pos.x;
      movingPlat.pos.x = movingPlat.baseX + Math.sin(k.time() * 2) * 52;
      movingPlat.deltaX = movingPlat.pos.x - prevX;

      // Arrastra al jugador cuando está apoyado sobre la plataforma
      if (player && player.isGrounded()) {
        const platWidth = tileSize * (tileSize / 16);
        const isStanding =
          player.pos.x + 8 > movingPlat.pos.x &&
          player.pos.x - 8 < movingPlat.pos.x + platWidth &&
          Math.abs((player.pos.y + 13.7) - movingPlat.pos.y) < 6;

        if (isStanding) {
          player.pos.x += movingPlat.deltaX;
        }
      }
    });

    // Etiqueta animada sobre el portal de retorno
    const portalLabel = k.add([
      k.text("RETORNO", { font: "pressstart", size: 8 }),
      k.pos(38 * tileSize + 12, 4 * tileSize - 10),
      k.anchor("center"),
      k.color(255, 140, 100),
      k.z(10)
    ]);
    portalLabel.onUpdate(() => {
      portalLabel.opacity = k.wave(0.5, 1, k.time() * 4);
    });

    // Aparición del jugador
    player = createPlayer(k, playerSpawnX, playerSpawnY, true);

    // Inicializa el HUD
    createHUD(k, "Cripta Carmesí");

    // --- Colisiones y disparadores interactivos ---

    // 1. Monedas y coleccionables
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
      showPopup(gem.pos, "+250", k.rgb(120, 240, 255));
    });

    // 2. Peligros y trampolines
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

    // 3. Interacción con enemigos (pisotón vs daño lateral)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || player.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        if (enemy.is("orc")) {
          enemy.takeDamage(2, player.pos.x);
        } else {
          enemy.die();
        }
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
      } else {
        const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
        player.receiveDamage(knockDir);
      }
    });

    player.onCollide("orc_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    // 4. Transición del portal de retorno al Nivel 2
    let returned = false;
    player.onCollide("return_portal", () => {
      if (returned) return;
      returned = true;
      k.play("win");
      gameState.addScore(500);

      k.add([
        k.rect(k.width(), 80),
        k.pos(0, k.height() / 2 - 40),
        k.color(18, 10, 14),
        k.opacity(0.95),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡CRIPTA CARMESÍ PURIFICADA! (+500 BONUS)", { font: "pressstart", size: 10 }),
        k.pos(k.width() / 2, k.height() / 2 - 14),
        k.anchor("center"),
        k.color(255, 140, 120),
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
        // Vuelve al Nivel 2 reiniciando la llave para buscar el libro verdadero
        gameState.hasKey = false;
        gameState.collectedBook = null;
        k.go("level2");
      });
    });

    // 5. Transición por la puerta secreta oculta hacia el Vacío Carmesí
    let enteredSecretCreep = false;
    player.onCollide("secret_creep_door", () => {
      if (enteredSecretCreep) return;
      enteredSecretCreep = true;
      k.play("win");
      k.shake(8);

      k.add([
        k.rect(k.width(), 80),
        k.pos(0, k.height() / 2 - 40),
        k.color(14, 4, 8),
        k.opacity(0.95),
        k.fixed(),
        k.z(200)
      ]);

      k.add([
        k.text("¿¿¿ UNA GRIETA EN LA REALIDAD ???", { font: "pressstart", size: 9 }),
        k.pos(k.width() / 2, k.height() / 2 - 12),
        k.anchor("center"),
        k.color(255, 50, 50),
        k.fixed(),
        k.z(201)
      ]);

      k.add([
        k.text("Entrando al reino desconocido...", { font: "pressstart", size: 7 }),
        k.pos(k.width() / 2, k.height() / 2 + 12),
        k.anchor("center"),
        k.color(220, 180, 180),
        k.fixed(),
        k.z(201)
      ]);

      k.wait(1.5, () => {
        k.go("easteregg_creep");
      });
    });

    // --- Bucle principal de actualización ---
    k.onUpdate(() => {
      if (!player) return;

      // Límites laterales dentro del mapa
      if (player.pos.x < 10) player.pos.x = 10;
      else if (player.pos.x > mapWidth - 10) player.pos.x = mapWidth - 10;

      // Muerte instantánea al caer al foso sin fondo (hueco en cols 17-19)
      if (player.pos.y > mapHeight + 50 && !player.isDead) {
        player.die();
      }

      // Seguimiento horizontal suave de la cámara
      const targetCamX = Math.max(k.width() / 2, Math.min(player.pos.x, mapWidth - k.width() / 2));
      k.camPos(targetCamX, k.height() / 2);
    });
  });
}
