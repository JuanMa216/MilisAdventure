import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createFlowerVase } from "../entities/flower_vase.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Nivel 1: "Castillo y Ruinas Medievales".
 *
 * Utiliza el tileset medieval de RottingPixels:
 * - Suelo de ladrillo de piedra (`stone_top`)
 * - Muros de mampostería del castillo (`stone_wall`)
 * - Plataformas de vigas de madera (`wood_platform`)
 * - Pinchos de hierro del castillo (`castle_spikes`)
 * - Mecánicas de bloqueo con escudo y salto
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initLevel1(k) {
  k.scene("level1", () => {
    gameState.currentLevel = 1;
    gameState.vasesBrokenCount = 0;
    gameState.allVasesDestroyed = false;

    // Reinicia la cámara y la gravedad
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    // --- Fondo del castillo al crepúsculo ---
    k.add([
      k.sprite("bg_level1"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Aviso discreto de controles debajo del HUD
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

    // --- Diseño del nivel (cuadrícula ASCII) ---
    // Tamaño de tile: 24x24 px. 15 filas = 360 px
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

    // Cuenta el total de jarrones rompibles en el nivel
    let totalVasesInLevel = 0;
    for (const r of mapLayout) {
      for (const ch of r) {
        if (ch === "V") totalVasesInLevel++;
      }
    }

    /**
     * Muestra un texto flotante ascendente con la puntuación obtenida.
     *
     * @param {import("kaboom").Vec2} pos - Posición inicial del aviso
     * @param {number|string} pts - Puntos o etiqueta a mostrar
     */
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

    // Precalcula los tiles visuales agrupados por columna para recorte horizontal sin asignaciones
    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

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
        } else {
          // Objetos interactivos
          switch (char) {
            case "V":
              // Jarrón decorativo rompible con espada (suelta fragmentos y recompensas)
              createFlowerVase(k, x + 12, y + 12, showScorePopup, () => {
                gameState.vasesBrokenCount++;
                if (gameState.vasesBrokenCount >= totalVasesInLevel) {
                  gameState.allVasesDestroyed = true;
                  k.play("win");
                  const secretCue = k.add([
                    k.text("Algo ha cambiado en las profundidades...", { font: "pressstart", size: 7 }),
                    k.pos(k.width() / 2, 68),
                    k.anchor("center"),
                    k.color(120, 255, 160),
                    k.fixed(),
                    k.z(95)
                  ]);
                  k.wait(2.5, () => secretCue.destroy());
                }
              });
              break;

            case "$":
              // Moneda (+100 puntos)
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
              // Gema (+250 puntos)
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
              // Pinchos de hierro del castillo (hitbox ajustada a favor del jugador)
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
              // Trampolín / resorte de impulso
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
              // Puerta de salida del nivel (puerta medieval arqueada de madera, 16x32)
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

    // Renderizador de tilemap con recorte por frustum:
    // Solo dibuja columnas visibles dentro del viewport horizontal (+48 px de margen)
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

    // Colisionadores físicos estáticos consolidados:
    // Reemplaza cuerpos individuales por segmentos continuos sin costuras

    // 1. Colisionadores consolidados de suelo (segmentos '=')
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

    // 2. Colisionadores consolidados de muros (segmentos '#')
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

    // 3. Colisionadores consolidados de plataformas (segmentos '-')
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

    // --- Límites del mapa ---
    // Evitan que el jugador y los enemigos salgan por los extremos izquierdo o derecho

    // Límite sólido izquierdo (x <= 0)
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(-32, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // Límite sólido derecho (x >= mapWidth)
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(mapWidth, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // Base sólida bajo los tiles del suelo para evitar atravesar la física
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

    // Indicador animado "SALIDA" sobre la puerta del castillo
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

    // Aparición del jugador en la posición '@' (apoyado sobre el suelo)
    player = createPlayer(k, 40, 322, true);

    // Aparición de Slimes sobre las superficies de sus plataformas
    slimes.push(createSlime(k, 312, 180, 24));
    slimes.push(createSlime(k, 1008, 132, 36));
    slimes.push(createSlime(k, 1128, 204, 24));
    slimes.push(createSlime(k, 1320, 276, 24));

    // Inicializa el HUD
    createHUD(k, "Nivel 1: Castillo");

    // --- Colisiones e interacciones ---

    // 1. Recolección de monedas (+100 pts)
    player.onCollide("coin", (coin) => {
      coin.destroy();
      k.play("coin");
      gameState.addScore(100);
      showScorePopup(coin.pos, 100);
    });

    // 2. Recolección de gemas (+250 pts)
    player.onCollide("gem", (gem) => {
      gem.destroy();
      k.play("coin");
      gameState.addScore(250);
      showScorePopup(gem.pos, 250);
    });

    // 2b. Recolección de corazones soltados por jarrones rotos
    player.onCollide("heart_drop", (heart) => {
      heart.destroy();
      k.play("coin");
      if (gameState.lives < gameState.maxLives) {
        gameState.lives++;
        showScorePopup(heart.pos, "VIDA");
      } else {
        gameState.addScore(150);
        showScorePopup(heart.pos, 150);
      }
    });

    // 3. Peligro de pinchos (quita vida)
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // 4. Mecánica de trampolín / resorte
    player.onCollide("spring", () => {
      k.play("spring");
      player.jump(player.jumpForce * 1.5);
      player.hasDoubleJumped = false;
    });

    // 5. Interacción con enemigos (pisotón vs bloqueo con escudo vs golpe lateral)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead) return;

      // Comprobación de pisotón: el jugador está por encima del enemigo en el aire o cayendo
      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        enemy.die();
        player.jump(player.jumpForce * 0.85); // Rebote hacia arriba
        player.hasDoubleJumped = false;
        k.play("jump");
      } else {
        // Golpe lateral: verifica bloqueo con escudo o aplica daño
        const knockbackDirection = player.pos.x < enemy.pos.x ? -1 : 1;
        player.receiveDamage(knockbackDirection);
      }
    });

    // 6. Nivel completado / transición por la puerta de salida
    let levelFinished = false;
    player.onCollide("exit_door", (door) => {
      if (levelFinished) return;
      levelFinished = true;

      door.use(k.sprite("door_open"));
      k.play("win");

      // Cartel de transición
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

    // Mantiene al jugador dentro de los límites del mapa y ajusta la cámara horizontalmente
    k.onUpdate(() => {
      if (!player) return;

      // Límite estricto dentro de los bordes del mapa
      if (player.pos.x < 10) {
        player.pos.x = 10;
      } else if (player.pos.x > mapWidth - 10) {
        player.pos.x = mapWidth - 10;
      }

      // La cámara sigue suavemente al jugador en horizontal dentro de los límites del mundo
      const targetCamX = Math.max(k.width() / 2, Math.min(player.pos.x, mapWidth - k.width() / 2));
      k.camPos(targetCamX, k.height() / 2);
    });
  });
}
