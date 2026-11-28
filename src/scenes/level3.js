import { createPlayer } from "../entities/player.js";
import { createSlime } from "../entities/slime.js";
import { createBasicSlime } from "../entities/basic_slime.js";
import { createOrc } from "../entities/orc.js";
import { createSkeleton } from "../entities/skeleton.js";
import { createHUD } from "../entities/hud.js";
import { gameState } from "../state.js";

/**
 * Nivel 3: "La Gran Torre de la Fortaleza Maldita" (diseño vertical: 27 cols x 70 filas).
 *
 * Características y arquitectura:
 * - Torre vertical: el jugador inicia en la base de la mazmorra (y ≈ 1618 px)
 *   y asciende por 5 tramos de ruinas hasta la Puerta al Trono en la cima.
 * - Seguimiento vertical dinámico de la cámara: centrada en `width / 2` y siguiendo a Mili en Y,
 *   acotada entre `[height / 2, mapHeight - height / 2]`.
 * - Plataforma móvil horizontal y ascensor vertical sobre el abismo de la torre.
 * - Trampolines géiser para impulsar al jugador entre pasillos de pinchos.
 * - Repertorio de enemigos: Skeleton Warriors (2 PV), Basic Slimes, Orc Warriors (3 PV) y Slimes clásicos.
 * - Puerta en la cima: al alcanzarla da paso a la arena del jefe final (`throne`).
 * - Recorte por frustum y colisionadores físicos consolidados.
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
 */
export function initLevel3(k) {
  k.scene("level3", () => {
    gameState.currentLevel = 3;
    gameState.hasKey = false;
    gameState.collectedBook = null;

    const tileSize = 24;
    const cols = 27;
    const rows = 70;
    const mapWidth = cols * tileSize;   // 648 px (ancho exacto de pantalla)
    const mapHeight = rows * tileSize; // 1680 px (ascenso vertical de ~4.7 pantallas)

    k.setGravity(980);
    // Inicia la cámara en la base de la torre donde aparece el jugador
    k.camPos(k.width() / 2, mapHeight - k.height() / 2);

    // --- Fondo atmosférico de fortaleza oscura ---
    k.add([
      k.sprite("bg_level3"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 640, k.height() / 360),
      k.z(-10)
    ]);

    // Superposición oscura para reforzar la atmósfera de la torre
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(12, 8, 20),
      k.opacity(0.35),
      k.fixed(),
      k.z(-8)
    ]);

    // Cartel de objetivo bajo el HUD
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

    // --- Mapa vertical de la torre (27 columnas x 70 filas = 648 x 1680 px) ---
    // Leyenda:
    // '#' dungeon_wall (límite / mampostería)
    // '=' dungeon_top (suelo)
    // '-' dungeon_platform (plataforma)
    // '^' dungeon_spikes (pinchos)
    // '$' moneda
    // 'G' gema
    // 'H' corazón
    // 'T' trampolín
    // 'D' puerta hacia la Sala del Trono
    // '1' plataforma móvil horizontal
    // '2' ascensor móvil vertical
    const layout = [
      "##                       ##", // 0
      "##           D           ##", // 1 Puerta del Trono (acceso al jefe)
      "##                       ##", // 2 Espacio para la altura de 2 tiles de la puerta
      "##        =======        ##", // 3 Suelo del umbral de salida
      "##   =                =  ##", // 4
      "##       ^^^^ ^^^^       ##", // 5 Pinchos de la cima
      "##==  ===============  ==##", // 6 Suelo de la ciudadela en la cima (Esqueletos)
      "##                       ##", // 7
      "##   T                 T ##", // 8 Trampolines hacia la cima
      "##  ===       G       ===##", // 9 Balcones altos con gema
      "##           ---         ##", // 10 Peldaño central
      "##                       ##", // 11
      "##       ---     ---     ##", // 12 Cornisas de acceso
      "##===                 ===##", // 13 Nivel de puerta de fortaleza
      "##                       ##", // 14
      "##         ^^^^^         ##", // 15 Pinchos
      "##        =======        ##", // 16 Suelo de piedra (Esqueleto)
      "##                       ##", // 17
      "##   T       $       T   ##", // 18 Trampolines
      "##  ===             ===  ##", // 19
      "##         -----         ##", // 20 Puente de madera (Basic Slime)
      "##                       ##", // 21
      "##          HHH          ##", // 22 Corazones
      "##        =======        ##", // 23 Suelo de piedra (Orco guardia)
      "##                       ##", // 24
      "##   ---           ---   ##", // 25 Cornisas laterales
      "##                       ##", // 26
      "##=================   ===##", // 27 Muralla del tramo 3
      "##                       ##", // 28
      "##  ===                  ##", // 29
      "##         1             ##", // 30 Plataforma móvil 1
      "##                       ##", // 31
      "##                 ====  ##", // 32 Plataforma (Esqueleto)
      "##                       ##", // 33
      "##       ---   ---       ##", // 34 Plataformas de madera de paso
      "##                       ##", // 35
      "##                  ===  ##", // 36
      "##                ====== ##", // 37 Plataforma de piedra (Orco guardia)
      "##         2             ##", // 38 Ascensor vertical
      "##                       ##", // 39
      "##   ======              ##", // 40 Cornisa de piedra (Basic Slime)
      "##           $$$         ##", // 41 Monedas de oro
      "##                       ##", // 42
      "##                       ##", // 43
      "##===   =================##", // 44 Suelo del tramo 2
      "##                       ##", // 45
      "##                       ##", // 46 Plataforma de madera (Esqueleto)
      "##       =======         ##", // 47
      "##    G                  ##", // 48 Gema
      "##  ---             ---  ##", // 49 Plataformas laterales
      "##                       ##", // 50
      "##         ^^^^^         ##", // 51 Pinchos
      "##        =======        ##", // 52 Plataforma de piedra (Orco guardia)
      "##   T                   ##", // 53 Trampolín
      "##  ===           ===    ##", // 54
      "##                       ##", // 55 Viga de madera (Basic Slime)
      "##              =======  ##", // 56
      "##                       ##", // 57
      "##        -----          ##", // 58 Plataforma de madera (Slime)
      "##                       ##", // 59
      "##                  ===  ##", // 60 Peldaño de piedra
      "##                       ##", // 61
      "##  ===                  ##", // 62 Peldaño de piedra (Esqueleto)
      "##          T            ##", // 63 Trampolín
      "##         ===           ##", // 64 Bloque sólido
      "##                       ##", // 65
      "##    @                  ##", // 66 Aparición del jugador
      "##                       ##", // 67
      "##=======================##", // 68 Suelo base
      "###########################"  // 69 Cimiento sólido
    ];

    let player = null;
    const movingPlatforms = [];
    const enemies = [];

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

    // Precalcula los tiles visuales agrupados por fila para recorte por frustum sin asignaciones
    const visualRows = [];
    const groundSegments = [];
    const platformSegments = [];

    // Construye la torre vertical de 70 filas
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
              // Pinchos mortales de mazmorra (hitbox ajustada a favor del jugador)
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
              // Moneda de oro
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
              // Gema preciosa
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
              // Corazón curativo
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
              // Géiser / trampolín de resorte (apoyado sobre el bloque inferior)
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
              // Puerta al Trono (lleva a la arena del jefe final)
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
              // Plataforma móvil 1 (patrulla horizontal en la fila 30: x = 168 a 432)
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
              // Ascensor móvil 2 (recorrido vertical: y = 888 a 1032)
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

    // Renderizador de tilemap con recorte por frustum vertical:
    // Solo dibuja las filas visibles en el viewport (+48 px de margen vertical)
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

    // Colisionadores físicos estáticos consolidados:
    // 1. Muro límite izquierdo continuo de la torre (cols 0-1: x = 0..48)
    k.add([
      k.rect(48, mapHeight),
      k.pos(0, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // 2. Muro límite derecho continuo de la torre (cols 25-26: x = 600..648)
    k.add([
      k.rect(48, mapHeight),
      k.pos(mapWidth - 48, 0),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid",
      "wall"
    ]);

    // 3. Cimiento continuo de la base (fila 69 y por debajo: y = 1656+)
    k.add([
      k.rect(mapWidth, 120),
      k.pos(0, 69 * tileSize),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      "solid"
    ]);

    // 4. Colisionadores consolidados de suelo
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

    // 5. Colisionadores consolidados de plataformas
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

    // Etiqueta animada sobre la Puerta al Trono
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

    // Inicializa el HUD
    createHUD(k, "NIVEL 3: LA TORRE");

    // Aparición del jugador en '@' (fila 66, apoyado en el suelo base y = 1618)
    player = createPlayer(k, 120, 1618, true, 1760);

    // =========================================================================
    // Aparición del repertorio de enemigos en los 5 tramos de la torre
    // =========================================================================

    // Tramo 1 (Base y ascenso inferior: filas 55-66)
    enemies.push(createSkeleton(k, 4 * tileSize, 1475, 24));      // Peldaño de piedra fila 62
    enemies.push(createSlime(k, 12 * tileSize, 1378, 30));         // Plataforma de madera fila 58
    enemies.push(createBasicSlime(k, 20 * tileSize, 1307, 24));    // Viga de madera fila 55

    // Tramo 2 (Murallas medio-bajas: filas 44-54)
    enemies.push(createOrc(k, 12 * tileSize, 1235, 36));          // Plataforma de piedra fila 52
    enemies.push(createSkeleton(k, 12 * tileSize, 1090, 28));     // Plataforma de madera fila 46
    enemies.push(createBasicSlime(k, 6 * tileSize, 946, 36));      // Cornisa de piedra fila 40

    // Tramo 3 (Fortaleza media y abismo: filas 30-43)
    enemies.push(createOrc(k, 19 * tileSize, 874, 36));           // Plataforma de piedra fila 37
    enemies.push(createSkeleton(k, 20 * tileSize, 755, 24));      // Plataforma fila 32

    // Tramo 4 (Puerta superior y sala de pinchos: filas 13-29)
    enemies.push(createOrc(k, 13 * tileSize, 538, 36));           // Suelo de piedra fila 23
    enemies.push(createBasicSlime(k, 12 * tileSize, 467, 30));     // Puente de madera fila 20
    enemies.push(createSkeleton(k, 12 * tileSize, 370, 32));      // Suelo de piedra fila 16

    // Tramo 5 (Ciudadela de la cima / guardias de la puerta: filas 4-9)
    enemies.push(createSkeleton(k, 7 * tileSize, 130, 36));       // Guardia izquierdo de la cima (fila 6)
    enemies.push(createSkeleton(k, 18 * tileSize, 130, 36));      // Guardia derecho de la cima (fila 6)
    enemies.push(createSlime(k, 12 * tileSize, 202, 24));         // Cornisa central fila 9

    // Actualiza las plataformas móviles y arrastra al jugador si está apoyado
    k.onUpdate(() => {
      for (const plat of movingPlatforms) {
        if (plat.startX !== undefined) {
          // Plataforma móvil horizontal
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
          // Ascensor vertical
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

        // Arrastra al jugador cuando está apoyado sobre la plataforma móvil
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

    // --- Colisiones y disparadores interactivos ---

    // 1. Monedas y coleccionables
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

    // 2. Trampolines géiser (supersalto)
    player.onCollide("spring", (spr) => {
      k.play("spring");
      player.jump(player.jumpForce * 1.45);
      player.hasDoubleJumped = false;
      spr.scale = k.vec2((tileSize / 16) * 1.3, (tileSize / 16) * 0.7);
      k.wait(0.15, () => {
        spr.scale = k.vec2(tileSize / 16, tileSize / 16);
      });
    });

    // 3. Peligro de pinchos
    player.onCollide("spikes", () => {
      player.receiveDamage(0);
    });

    // 4. Colisiones de combate contra enemigos
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      // Comprobación de pisotón: el jugador está por encima del enemigo en el aire o cayendo
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

      // El jugador recibe daño y empuje
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

    // 5. Transición por la puerta de salida hacia la Sala del Trono ("throne")
    let enteringThrone = false;
    player.onCollide("exit_door", (door) => {
      if (enteringThrone) return;
      enteringThrone = true;

      door.use(k.sprite("door_open"));
      k.play("win");

      // Cartel de transición hacia el portal del trono
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

    // --- Bucle principal: seguimiento vertical de cámara y límites ---
    k.onUpdate(() => {
      if (!player) return;

      // Mantiene al jugador dentro de los muros laterales de la torre (x = 55 a 593)
      if (player.pos.x < 55) {
        player.pos.x = 55;
      } else if (player.pos.x > mapWidth - 55) {
        player.pos.x = mapWidth - 55;
      }

      // Muerte instantánea al caer al vacío inferior (y > 1720)
      if (player.pos.y > 1720 && !player.isDead) {
        player.die();
      }

      // Seguimiento vertical de cámara: fijo en width/2 y siguiendo a Mili en Y
      const targetCamY = Math.max(k.height() / 2, Math.min(player.pos.y, mapHeight - k.height() / 2));
      k.camPos(k.width() / 2, targetCamY);
    });
  });
}
