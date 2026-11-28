import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createOrc } from "../entities/orc.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Nivel 2: "Las Cavernas Oscuras y Minas Subterráneas" (versión expandida de 120 columnas).
 *
 * Características y mecánicas:
 * - Fondo atmosférico de caverna subterránea (`bg_level2`)
 * - Tileset de roca natural RottingPixels (`cave_top`, `cave_wall`, `wood_platform`, `cave_spikes`)
 * - Mecánica mística de grimorios (libros arcanos):
 *   - Grimorio Carmesí (`book_red`): abre el portal a la Cripta Carmesí
 *   - Grimorio Esmeralda (`book_green`): abre el portal a la Garganta Esmeralda
 *   - Grimorio Celestial (`book_blue`): libro sagrado que abre el Nivel 3 (El Trono del Rey Demonio)
 * - Múltiples plataformas móviles (horizontales y ascensor vertical)
 * - Trampolines elásticos (géiseres)
 * - Escuadrón de Orcos Guerreros (3 PV, ataque con maza) y Slimes cavernícolas
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initLevel2(k) {
  k.scene("level2", () => {
    gameState.currentLevel = 2;
    gameState.hasKey = false;
    gameState.collectedBook = null;

    // Reinicia la cámara y la gravedad
    k.setGravity(980);
    k.camPos(k.width() / 2, k.height() / 2);

    // --- Fondo de caverna subterránea ---
    k.add([
      k.sprite("bg_level2"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Indicación del objetivo del nivel bajo el HUD
    k.add([
      k.rect(520, 20),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(14, 12, 22),
      k.opacity(0.85),
      k.fixed(),
      k.z(80)
    ]);

    k.add([
      k.text("OBJETIVO: Explora las cavernas y encuentra un libro arcano para la puerta", {
        font: "pressstart",
        size: 6.5
      }),
      k.pos(k.width() / 2, 48),
      k.anchor("center"),
      k.color(240, 210, 110),
      k.fixed(),
      k.z(81)
    ]);

    // --- Diseño del Nivel 2 (cuadrícula ASCII: 120 columnas x 15 filas = 2880 x 360 px) ---
    // Leyenda de tiles:
    // '=' cave_top (suelo)
    // '#' cave_wall (muro de roca)
    // '-' wood_platform (plataforma de madera)
    // '^' cave_spikes (estalagmitas)
    // '$' moneda
    // 'G' gema
    // 'T' trampolín / resorte
    // '1' book_red (Grimorio Carmesí)
    // '2' book_green (Grimorio Esmeralda)
    // '3' book_blue (Grimorio Celestial - Verdadero)
    // 'D' puerta de salida de las catacumbas
    // '@' punto de aparición del jugador
    // 'S' slime
    // 'O' orco guerrero
    const mapLayout = [
      "                                                                                                                        ",
      "                                      $$$                                                       3                       ",
      "                                      ===                              ===                    ======               D    ",
      "                  $$$                                                                                                   ",
      "                 =====            1                              ---                                           =====    ",
      "                                 ---                                                                           #####    ",
      "         S              O                        O                               2                                      ",
      "        ---            =====          ---       =====                    ---         ---                                ",
      "                                                                                                                        ",
      "                                                              ---                        ---                            ",
      "      T                                    T                                    T                                       ",
      "     ===                                  ===          ^^^                     ===            ^^^^                      ",
      "     ###                                  ###        =======                   ###          =======                     ",
      "  @                                   S              #######            S                   #######        T         $$$",
      "=================                =============   ==============       ========             ============================="
    ];

    const tileSize = 24;
    const cols = mapLayout[0].length; // 120
    const rows = mapLayout.length;    // 15
    const mapWidth = cols * tileSize;  // 2880 px
    const mapHeight = rows * tileSize; // 360 px

    let player = null;
    const enemies = [];
    const movingPlatforms = [];

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
              // Moneda de oro (+100 puntos)
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
              // Gema de cristal (+250 puntos)
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
              // Estalagmitas minerales (hitbox ajustada a favor del jugador)
              k.add([
                k.sprite("cave_spikes"),
                k.pos(x, y),
                k.scale(24 / 16),
                k.area({ shape: new k.Rect(k.vec2(2, 10), 12, 6) }),
                k.z(2),
                "spikes",
                "hazard"
              ]);
              break;

            case "T":
              // Géiser / trampolín elástico
              k.add([
                k.sprite("spring"),
                k.pos(x, y),
                k.scale(24 / 18),
                k.area(),
                k.z(2),
                "spring"
              ]);
              break;

            case "1":
              // 1: Grimorio Carmesí (desvío -> Cripta Carmesí)
              k.add([
                k.sprite("book_red"),
                k.pos(x + 12, y + 12),
                k.scale(24 / 16),
                k.area(),
                k.anchor("center"),
                k.z(3),
                "book_red",
                "book"
              ]);
              break;

            case "2":
              // 2: Grimorio Esmeralda (desvío -> Garganta Esmeralda)
              k.add([
                k.sprite("book_green"),
                k.pos(x + 12, y + 12),
                k.scale(24 / 16),
                k.area(),
                k.anchor("center"),
                k.z(3),
                "book_green",
                "book"
              ]);
              break;

            case "3":
              // 3: Grimorio Celestial (verdadero -> Trono del Rey Demonio)
              k.add([
                k.sprite("book_blue"),
                k.pos(x + 12, y + 12),
                k.scale(24 / 16),
                k.area(),
                k.anchor("center"),
                k.z(3),
                "book_blue",
                "book"
              ]);
              break;

            case "D":
              // Puerta de salida sellada (16x32, 2 tiles de alto)
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

    // Límite sólido izquierdo
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(-32, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // Límite sólido derecho
    k.add([
      k.rect(32, mapHeight + 600),
      k.pos(mapWidth, -300),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "boundary"
    ]);

    // --- Múltiples plataformas móviles ---

    // Plataforma 1: horizontal sobre el primer abismo (cols 17-20)
    const plat1 = k.add([
      k.sprite("wood_platform"),
      k.pos(18 * 24, 11 * 24),
      k.scale(24 / 16),
      k.area(),
      k.body({ isStatic: true }),
      k.z(2),
      "solid",
      "ground",
      "platform",
      "moving_platform",
      { baseX: 18 * 24, deltaX: 0 }
    ]);
    plat1.onUpdate(() => {
      const prevX = plat1.pos.x;
      plat1.pos.x = plat1.baseX + Math.sin(k.time() * 2) * 45;
      plat1.deltaX = plat1.pos.x - prevX;
      carryPlayerHorizontal(plat1);
    });
    movingPlatforms.push(plat1);

    // Plataforma 2: ascensor vertical entre el túnel inferior y la cámara superior (cols 45-50)
    const plat2 = k.add([
      k.sprite("wood_platform"),
      k.pos(45 * 24, 9 * 24),
      k.scale(24 / 16),
      k.area(),
      k.body({ isStatic: true }),
      k.z(2),
      "solid",
      "ground",
      "platform",
      "moving_platform",
      { baseY: 9 * 24, deltaY: 0 }
    ]);
    plat2.onUpdate(() => {
      const prevY = plat2.pos.y;
      plat2.pos.y = plat2.baseY + Math.sin(k.time() * 1.8) * 55;
      plat2.deltaY = plat2.pos.y - prevY;
      carryPlayerVertical(plat2);
    });
    movingPlatforms.push(plat2);

    // Plataforma 3: horizontal sobre el tercer abismo (cols 72-76)
    const plat3 = k.add([
      k.sprite("wood_platform"),
      k.pos(73 * 24, 11 * 24),
      k.scale(24 / 16),
      k.area(),
      k.body({ isStatic: true }),
      k.z(2),
      "solid",
      "ground",
      "platform",
      "moving_platform",
      { baseX: 73 * 24, deltaX: 0 }
    ]);
    plat3.onUpdate(() => {
      const prevX = plat3.pos.x;
      plat3.pos.x = plat3.baseX + Math.sin(k.time() * 2.2) * 55;
      plat3.deltaX = plat3.pos.x - prevX;
      carryPlayerHorizontal(plat3);
    });
    movingPlatforms.push(plat3);

    /**
     * Traslada horizontalmente al jugador cuando está apoyado sobre una plataforma móvil.
     *
     * @param {import("kaboom").GameObj} plat - Plataforma móvil con propiedad `deltaX`
     */
    function carryPlayerHorizontal(plat) {
      if (!player || !player.isGrounded()) return;
      const isStanding =
        player.pos.x + 8 > plat.pos.x &&
        player.pos.x - 8 < plat.pos.x + 24 &&
        Math.abs((player.pos.y + 13.7) - plat.pos.y) < 6;

      if (isStanding) {
        player.pos.x += plat.deltaX;
      }
    }

    /**
     * Traslada verticalmente al jugador cuando está apoyado sobre un ascensor móvil.
     *
     * @param {import("kaboom").GameObj} plat - Plataforma móvil con propiedad `deltaY`
     */
    function carryPlayerVertical(plat) {
      if (!player || !player.isGrounded()) return;
      const isStanding =
        player.pos.x + 8 > plat.pos.x &&
        player.pos.x - 8 < plat.pos.x + 24 &&
        Math.abs((player.pos.y + 13.7) - plat.pos.y) < 6;

      if (isStanding) {
        player.pos.y += plat.deltaY;
      }
    }

    // --- Etiqueta dinámica de la puerta del portal ---
    // Col 113, fila 2 -> la puerta descansa en la fila 4 (y = 96)
    const doorLabel = k.add([
      k.text("PUERTA SELLADA: BUSCA UN LIBRO", { font: "pressstart", size: 6.5 }),
      k.pos(113 * 24 + 12, 2 * 24 - 10),
      k.anchor("center"),
      k.color(240, 80, 80),
      k.z(10)
    ]);

    doorLabel.onUpdate(() => {
      if (gameState.hasKey) {
        doorLabel.text = "¡PORTAL DESBLOQUEADO!";
        doorLabel.color = k.rgb(240, 220, 140);
        doorLabel.opacity = k.wave(0.6, 1, k.time() * 4);
      } else {
        doorLabel.text = "PUERTA SELLADA: BUSCA UN LIBRO";
        doorLabel.color = k.rgb(240, 80, 80);
        doorLabel.opacity = k.wave(0.4, 0.9, k.time() * 3);
      }
    });

    // Base sólida bajo los tiles del suelo para evitar atravesar la física
    const bedrockSegments = [
      { x: 0, w: 408 },
      { x: 792, w: 312 },
      { x: 1176, w: 336 },
      { x: 1680, w: 192 },
      { x: 2184, w: 696 }
    ];
    bedrockSegments.forEach((seg) => {
      k.add([
        k.rect(seg.w, 100),
        k.pos(seg.x, 360),
        k.area(),
        k.body({ isStatic: true }),
        k.opacity(0),
        "solid"
      ]);
    });

    // Aparición del jugador en '@' (apoyado sobre el suelo)
    player = createPlayer(k, 48, 322, true);

    // Aparición de Slimes por las cavernas (apoyados sobre plataformas o suelo)
    enemies.push(createSlime(k, 9 * 24, 156, 24));
    enemies.push(createSlime(k, 38 * 24, 324, 48));
    enemies.push(createSlime(k, 73 * 24, 324, 40));
    enemies.push(createSlime(k, 110 * 24, 324, 45));

    // Aparición de Orcos Guerreros en plataformas sólidas y campamentos
    enemies.push(createOrc(k, 25 * 24, 157, 40));
    enemies.push(createOrc(k, 50 * 24, 157, 40));
    enemies.push(createOrc(k, 56 * 24, 277, 36));
    enemies.push(createOrc(k, 104 * 24, 325, 45));

    // Inicializa el HUD
    createHUD(k, "Nivel 2: Cavernas");

    // --- Colisiones e interacciones ---

    // 1. Recolección de monedas (+100 puntos)
    player.onCollide("coin", (coin) => {
      coin.destroy();
      k.play("coin");
      gameState.addScore(100);
      showPopup(coin.pos, "+100");
    });

    // 2. Recolección de gemas (+250 puntos)
    player.onCollide("gem", (gem) => {
      gem.destroy();
      k.play("coin");
      gameState.addScore(250);
      showPopup(gem.pos, "+250", k.rgb(120, 240, 255));
    });

    // 3. Recolección de libros arcanos (misterio: sin revelar cuál es el correcto)

    // Grimorio Carmesí (libro rojo)
    player.onCollide("book_red", (book) => {
      book.destroy();
      gameState.collectedBook = "red";
      gameState.hasKey = true;
      k.play("win");
      showPopup(book.pos, "¡LIBRO OBTENIDO!", k.rgb(255, 220, 140));

      const banner = k.add([
        k.text("¡HAS RECOGIDO UN LIBRO MISTERIOSO! VE AL PORTAL...", {
          font: "pressstart",
          size: 7
        }),
        k.pos(k.width() / 2, 75),
        k.anchor("center"),
        k.color(255, 230, 150),
        k.fixed(),
        k.z(95)
      ]);
      k.wait(2.5, () => banner.destroy());
    });

    // Grimorio Esmeralda (libro verde)
    player.onCollide("book_green", (book) => {
      book.destroy();
      gameState.collectedBook = "green";
      gameState.hasKey = true;
      k.play("win");
      showPopup(book.pos, "¡LIBRO OBTENIDO!", k.rgb(255, 220, 140));

      const banner = k.add([
        k.text("¡HAS RECOGIDO UN LIBRO MISTERIOSO! VE AL PORTAL...", {
          font: "pressstart",
          size: 7
        }),
        k.pos(k.width() / 2, 75),
        k.anchor("center"),
        k.color(255, 230, 150),
        k.fixed(),
        k.z(95)
      ]);
      k.wait(2.5, () => banner.destroy());
    });

    // Grimorio Celestial (libro azul)
    player.onCollide("book_blue", (book) => {
      book.destroy();
      gameState.collectedBook = "blue";
      gameState.hasKey = true;
      k.play("win");
      showPopup(book.pos, "¡LIBRO OBTENIDO!", k.rgb(255, 220, 140));

      const banner = k.add([
        k.text("¡HAS RECOGIDO UN LIBRO MISTERIOSO! VE AL PORTAL...", {
          font: "pressstart",
          size: 7
        }),
        k.pos(k.width() / 2, 75),
        k.anchor("center"),
        k.color(255, 230, 150),
        k.fixed(),
        k.z(95)
      ]);
      k.wait(2.5, () => banner.destroy());
    });

    // 4. Peligro de estalagmitas
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // 5. Trampolines de resorte
    player.onCollide("spring", () => {
      k.play("spring");
      player.jump(player.jumpForce * 1.55);
      player.hasDoubleJumped = false;
    });

    // 6. Colisión con enemigos (pisotón vs daño lateral)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || player.isHurt) return;

      // Comprobación de pisotón: el jugador está por encima del enemigo en el aire o cayendo
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

    // 7. Hitbox del ataque de los Orcos
    player.onCollide("orc_attack", (hitbox) => {
      if (player.isHurt || player.isDead) return;
      const knockDir = player.pos.x < hitbox.pos.x ? -1 : 1;
      player.receiveDamage(knockDir);
    });

    // 8. Reacción del portal de salida según el libro equipado
    let reachedDoor = false;
    player.onCollide("exit_door", (door) => {
      if (reachedDoor) return;

      if (!gameState.hasKey || !gameState.collectedBook) {
        // Puerta bloqueada sin un libro
        k.play("hit");
        showPopup(door.pos, "¡CERRADO! ENCUENTRA UN LIBRO", k.rgb(255, 100, 100));
        return;
      }

      reachedDoor = true;
      k.play("win");
      door.use(k.sprite("door_open"));

      const book = gameState.collectedBook;

      if (book === "blue") {
        // Libro azul: lleva al Nivel 3 (jefe final)
        k.add([
          k.rect(k.width(), 70),
          k.pos(0, k.height() / 2 - 35),
          k.color(14, 18, 32),
          k.opacity(0.95),
          k.fixed(),
          k.z(150)
        ]);

        k.add([
          k.text("¡VIAJANDO A TRAVÉS DEL PORTAL...!", { font: "pressstart", size: 11 }),
          k.pos(k.width() / 2, k.height() / 2 - 10),
          k.anchor("center"),
          k.color(160, 220, 255),
          k.fixed(),
          k.z(151)
        ]);

        k.add([
          k.text("¿Hacia dónde te llevará este libro...?", {
            font: "pressstart",
            size: 8
          }),
          k.pos(k.width() / 2, k.height() / 2 + 14),
          k.anchor("center"),
          k.color(240, 220, 160),
          k.fixed(),
          k.z(151)
        ]);

        k.wait(2.0, () => {
          k.go("level3");
        });
      } else if (book === "red") {
        // Libro rojo: lleva a la Cripta Carmesí
        k.add([
          k.rect(k.width(), 70),
          k.pos(0, k.height() / 2 - 35),
          k.color(28, 10, 14),
          k.opacity(0.95),
          k.fixed(),
          k.z(150)
        ]);

        k.add([
          k.text("¡VIAJANDO A TRAVÉS DEL PORTAL...!", { font: "pressstart", size: 11 }),
          k.pos(k.width() / 2, k.height() / 2 - 10),
          k.anchor("center"),
          k.color(255, 180, 160),
          k.fixed(),
          k.z(151)
        ]);

        k.add([
          k.text("¿Hacia dónde te llevará este libro...?", { font: "pressstart", size: 8 }),
          k.pos(k.width() / 2, k.height() / 2 + 14),
          k.anchor("center"),
          k.color(255, 200, 160),
          k.fixed(),
          k.z(151)
        ]);

        k.wait(2.0, () => {
          k.go("dungeon_red");
        });
      } else if (book === "green") {
        // Libro verde: lleva a la Garganta Esmeralda
        k.add([
          k.rect(k.width(), 70),
          k.pos(0, k.height() / 2 - 35),
          k.color(10, 24, 16),
          k.opacity(0.95),
          k.fixed(),
          k.z(150)
        ]);

        k.add([
          k.text("¡VIAJANDO A TRAVÉS DEL PORTAL...!", { font: "pressstart", size: 11 }),
          k.pos(k.width() / 2, k.height() / 2 - 10),
          k.anchor("center"),
          k.color(160, 255, 190),
          k.fixed(),
          k.z(151)
        ]);

        k.add([
          k.text("¿Hacia dónde te llevará este libro...?", { font: "pressstart", size: 8 }),
          k.pos(k.width() / 2, k.height() / 2 + 14),
          k.anchor("center"),
          k.color(200, 255, 200),
          k.fixed(),
          k.z(151)
        ]);

        k.wait(2.0, () => {
          k.go("dungeon_green");
        });
      }
    });

    // Mantiene al jugador dentro de los límites del mapa (120 cols = 2880 px) y ajusta la cámara
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
