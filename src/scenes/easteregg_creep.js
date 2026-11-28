import { createPlayer } from "../entities/player.js";
import { createBloodMonster } from "../entities/blood_monster.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Escena secreta (Easter Egg): "You Shouldn't Be Here!" (El Vacío Carmesí).
 *
 * Características y ambientación:
 * - Reino oculto de pesadilla accesible únicamente mediante la puerta secreta de la Mazmorra Roja.
 * - Fondo fotográfico inquietante con viñeta carmesí atmosférica.
 * - Mensaje parpadeante destacado: "You Should'nt be here!".
 * - 3 temibles Blood Monsters (10 PV cada uno) patrullando la arena.
 * - Trampolines aéreos y balcones en múltiples niveles para esquivar y ejecutar pisotones críticos.
 * - Al derrotar a los 3 Blood Monsters aparece el portal de escape con un bono de +2000 pts.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initEasterEggCreep(k) {
  k.scene("easteregg_creep", () => {
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    const tileSize = 24;
    const cols = 28;
    const rows = 15;
    const mapWidth = cols * tileSize;  // 672 px
    const mapHeight = rows * tileSize; // 360 px

    // --- Fondo fotográfico inquietante ---
    k.add([
      k.sprite("bg_easteregg_face"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 768, k.height() / 1024),
      k.z(-10)
    ]);

    // Viñeta oscura en tono rojo sangre
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(18, 4, 8),
      k.opacity(0.45),
      k.fixed(),
      k.z(-8)
    ]);

    // --- Texto de advertencia inquietante ---
    const warningText = k.add([
      k.text("You Should'nt be here!", {
        font: "pressstart",
        size: 13
      }),
      k.pos(k.width() / 2, 44),
      k.anchor("center"),
      k.color(255, 30, 30),
      k.fixed(),
      k.z(90)
    ]);

    // Pulso inquietante de opacidad
    warningText.onUpdate(() => {
      warningText.opacity = k.wave(0.65, 1, k.time() * 3.5);
    });

    // Diseño de la arena: 28 columnas x 15 filas
    const layout = [
      "##                        ##", // 0
      "##                        ##", // 1
      "##  ---              ---  ##", // 2 Balcones altos con gemas y corazones
      "##                        ##", // 3
      "##   T                T   ##", // 4 Trampolines
      "##  ===              ===  ##", // 5 Balcones medios (Monstruos 1 y 3)
      "##                        ##", // 6
      "##       ---    ---       ##", // 7 Plataformas intermedias
      "##                        ##", // 8
      "##  ===              ===  ##", // 9 Cornisas laterales de acceso
      "##                        ##", // 10
      "##  ^^^^            ^^^^  ##", // 11 Pinchos laterales de peligro
      "##========================##", // 12 Suelo principal de la arena (y = 288)
      "############################", // 13 Base sólida
      "############################"  // 14 Cimiento
    ];

    const visualCols = Array.from({ length: cols }, () => []);
    const groundSegments = [];
    const wallSegments = [];
    const platformSegments = [];

    // Análisis del mapa por filas y columnas
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

            default:
              break;
          }
          col++;
        }
      }
    }

    // Objetos de bonificación en los balcones altos
    // Corazones en los balcones superiores
    k.add([
      k.sprite("heart_full"),
      k.pos(3 * tileSize + 4, 1 * tileSize + 4),
      k.scale(tileSize / 16),
      k.area(),
      k.z(5),
      "heart_item"
    ]);
    k.add([
      k.sprite("heart_full"),
      k.pos(24 * tileSize + 4, 1 * tileSize + 4),
      k.scale(tileSize / 16),
      k.area(),
      k.z(5),
      "heart_item"
    ]);

    // Gemas en la zona central
    k.add([
      k.sprite("gem"),
      k.pos(11 * tileSize + 4, 6 * tileSize + 4),
      k.scale(tileSize / 16),
      k.area(),
      k.z(5),
      "gem"
    ]);
    k.add([
      k.sprite("gem"),
      k.pos(16 * tileSize + 4, 6 * tileSize + 4),
      k.scale(tileSize / 16),
      k.area(),
      k.z(5),
      "gem"
    ]);

    // --- Renderizador de tilemap con recorte por frustum de cámara ---
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

    // --- Colisionadores estáticos consolidados ---

    // 1. Colisionadores continuos de suelo (se extienden 120 px hacia abajo en la fila 12)
    for (const seg of groundSegments) {
      const height = seg.row >= 12 ? 120 : tileSize;
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

    // 2. Colisionadores de muros
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

    // 3. Colisionadores de plataformas
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

    // 4. Límites laterales del mapa
    k.add([
      k.rect(48, mapHeight),
      k.pos(0, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    k.add([
      k.rect(48, mapHeight),
      k.pos(mapWidth - 48, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // Inicializa el HUD
    createHUD(k, "DIMENSIÓN SECRETA");

    // Aparición de Mili en la entrada izquierda del suelo de la arena
    const player = createPlayer(k, 80, 260, true, 400);

    // --- Aparición de 3 Blood Monsters (10 PV cada uno) ---
    let monstersRemaining = 3;

    // Indicador en HUD de monstruos restantes
    const statusLabel = k.add([
      k.text(`BLOOD MONSTERS: ${monstersRemaining}/3`, {
        font: "pressstart",
        size: 7
      }),
      k.pos(k.width() / 2, 68),
      k.anchor("center"),
      k.color(255, 180, 180),
      k.fixed(),
      k.z(91)
    ]);

    /**
     * Actualiza el contador de Blood Monsters restantes y activa el portal al eliminarlos todos.
     */
    function onMonsterDefeated() {
      monstersRemaining = Math.max(0, monstersRemaining - 1);
      statusLabel.text = `BLOOD MONSTERS: ${monstersRemaining}/3`;

      // Verifica si los 3 Blood Monsters han sido derrotados
      if (monstersRemaining === 0) {
        onAllMonstersDefeated();
      }
    }

    // Monstruo 1: balcón medio izquierdo
    createBloodMonster(k, 100, 100, 35, onMonsterDefeated);

    // Monstruo 2: centro del suelo de la arena
    createBloodMonster(k, 336, 265, 80, onMonsterDefeated);

    // Monstruo 3: balcón medio derecho
    createBloodMonster(k, 570, 100, 35, onMonsterDefeated);

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

    // Trampolines (supersalto para alcanzar balcones y pisar a las bestias)
    player.onCollide("spring", (spr) => {
      k.play("spring");
      player.jump(player.jumpForce * 1.5);
      player.hasDoubleJumped = false;
      spr.scale = k.vec2((tileSize / 16) * 1.3, (tileSize / 16) * 0.7);
      k.wait(0.15, () => {
        spr.scale = k.vec2(tileSize / 16, tileSize / 16);
      });
    });

    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // Combate contra los Blood Monsters
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        // El pisotón inflige 2 de daño crítico al monstruo de 10 PV
        enemy.takeDamage(2, player.pos.x);
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
        return;
      }

      const knockDir = player.pos.x < enemy.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    player.onCollide("blood_monster_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    /**
     * Secuencia de victoria al derrotar a los 3 Blood Monsters: otorga +2000 pts
     * y genera el portal de escape en el centro de la arena.
     */
    function onAllMonstersDefeated() {
      k.play("win");
      k.shake(12);
      gameState.addScore(2000);

      // Cartel principal de escape
      k.add([
        k.rect(520, 70),
        k.pos(k.width() / 2, k.height() / 2 - 20),
        k.anchor("center"),
        k.color(18, 10, 16),
        k.opacity(0.95),
        k.fixed(),
        k.z(150)
      ]);

      k.add([
        k.text("¡PESADILLA PURIFICADA! (+2000 BONUS)", {
          font: "pressstart",
          size: 9.5
        }),
        k.pos(k.width() / 2, k.height() / 2 - 32),
        k.anchor("center"),
        k.color(255, 140, 140),
        k.fixed(),
        k.z(151)
      ]);

      k.add([
        k.text("El portal de escape ha aparecido en el centro...", {
          font: "pressstart",
          size: 7.5
        }),
        k.pos(k.width() / 2, k.height() / 2 - 8),
        k.anchor("center"),
        k.color(240, 220, 180),
        k.fixed(),
        k.z(151)
      ]);

      // Genera el portal dorado de escape en el centro del suelo (col 13, fila 11)
      const escapePortal = k.add([
        k.sprite("door_open"),
        k.pos(13 * tileSize + 12, 12 * tileSize),
        k.scale(tileSize / 16),
        k.anchor("bot"),
        k.area({ shape: new k.Rect(k.vec2(0, -16), 16, 32) }),
        k.z(4),
        "secret_escape_door"
      ]);

      const escapeLabel = k.add([
        k.text("PORTAL DE ESCAPE", { font: "pressstart", size: 7 }),
        k.pos(13 * tileSize + 12, 10 * tileSize + 10),
        k.anchor("center"),
        k.color(255, 230, 80),
        k.z(10)
      ]);
      escapeLabel.onUpdate(() => {
        escapeLabel.opacity = k.wave(0.5, 1, k.time() * 4);
      });
    }

    // Colisión con el portal de escape
    let escaping = false;
    player.onCollide("secret_escape_door", () => {
      if (escaping) return;
      escaping = true;
      k.play("win");

      k.wait(1.5, () => {
        // Regresa triunfante a la Mazmorra Roja
        k.go("dungeon_red");
      });
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
