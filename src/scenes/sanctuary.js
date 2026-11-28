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
 * Escena del Santuario Ancestral.
 *
 * Se desbloquea únicamente al romper todos los jarrones decorativos del Nivel 1,
 * revelando un portal etéreo dentro de la Mazmorra Verde.
 *
 * Características:
 * - Fondo fotográfico misterioso con viñeta cósmica atmosférica.
 * - Guardianes del Santuario:
 *   - Bloodshot Eyes (centinelas aéreos)
 *   - Red Caps (duendes subterráneos rápidos)
 *   - Crushing Cyclops (bruto imponente de 6 PV)
 * - Trampolines aéreos y plataformas en múltiples alturas.
 * - Al derrotar a los guardianes se activa el portal celestial de salida (+3000 bono).
 *
 * @param {import("kaboom").KaboomCtx} k - Contexto de Kaboom
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

    // --- Fondo fotográfico atmosférico ---
    k.add([
      k.sprite("bg_sanctuary"),
      k.pos(0, 0),
      k.fixed(),
      k.scale(k.width() / 306, k.height() / 908),
      k.z(-10)
    ]);

    // Viñeta cósmica atmosférica
    k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(10, 16, 26),
      k.opacity(0.42),
      k.fixed(),
      k.z(-8)
    ]);

    // Cartel de título bajo el HUD
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

    // Diseño de la arena: 30 columnas x 15 filas
    const layout = [
      "##                          ##", // 0
      "##                          ##", // 1
      "##  G   ---        ---   G  ##", // 2 Cornisas altas con gemas
      "##                          ##", // 3
      "##   T                  T   ##", // 4 Trampolines
      "##  ===    $$$  $$$    ===  ##", // 5 Balcones medios
      "##                          ##", // 6
      "##       ---      ---       ##", // 7 Plataformas de paso
      "##                          ##", // 8
      "##   ---              ---   ##", // 9 Cornisas inferiores
      "##                          ##", // 10
      "##  ^^^^              ^^^^  ##", // 11 Pinchos laterales de peligro
      "## ======            ====== ##", // 12
      "## @                      D ##", // 13 Suelo: aparición de Mili y portal de retorno
      "=============================="  // 14 Base sólida del suelo
    ];

    let player = null;
    const enemies = [];
    let exitPortal = null;
    let totalEnemies = 0;
    let defeatedEnemies = 0;

    /**
     * Muestra un texto flotante ascendente en la posición indicada.
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
        k.z(35)
      ]);
      popup.onUpdate(() => {
        popup.pos.y -= 25 * k.dt();
      });
      k.wait(0.6, () => popup.destroy());
    }

    // Estructuras para colisionadores consolidados y columnas visuales
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

    // Colisionadores consolidados de suelo
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

    // Colisionadores consolidados de muros
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

    // Colisionadores sólidos de plataformas
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

    // Aparición del jugador
    player = createPlayer(k, playerSpawnX, playerSpawnY);
    gameState.player = player;

    // Recorte por frustum de cámara sin asignaciones extra para los tiles visuales estáticos
    const spawnedVisualsByCol = Array.from({ length: cols }, () => []);
    let prevMinCol = -1;
    let prevMaxCol = -1;

    /**
     * Crea o destruye las columnas de tiles visibles según el rango horizontal de la cámara.
     */
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

    // --- Aparición de los guardianes del Santuario ---
    /**
     * Registra la derrota de un guardián y dispara la victoria cuando caen todos.
     */
    function onMonsterDied() {
      defeatedEnemies++;
      if (defeatedEnemies >= totalEnemies) {
        onAllMonstersDefeated();
      }
    }

    // 1. Dos Bloodshot Eyes patrullando la zona alta
    enemies.push(createBloodshotEye(k, 180, 75, 70, onMonsterDied));
    enemies.push(createBloodshotEye(k, 500, 75, 70, onMonsterDied));

    // 2. Dos duendes Red Cap patrullando los balcones medios
    enemies.push(createRedCap(k, 250, 105, 50, onMonsterDied));
    enemies.push(createRedCap(k, 430, 105, 50, onMonsterDied));

    // 3. Un Crushing Cyclops custodiando el suelo central del santuario
    enemies.push(createCrushingCyclops(k, 360, 300, 80, onMonsterDied));

    totalEnemies = enemies.length; // 5 guardianes

    // Portal de retorno inicialmente cerrado / latente
    exitPortal = k.add([
      k.sprite("door_closed"),
      k.pos(exitPortalX, exitPortalY),
      k.scale(tileSize / 16),
      k.area({ shape: new k.Rect(k.vec2(0, 0), 16, 32) }),
      k.anchor("center"),
      k.z(2),
      "sanctuary_portal"
    ]);

    // Secuencia de victoria al derrotar a todos los guardianes
    let trialCompleted = false;
    /**
     * Otorga el bono de purificación del Santuario y despierta el portal de retorno.
     */
    function onAllMonstersDefeated() {
      if (trialCompleted) return;
      trialCompleted = true;

      k.play("win");
      k.shake(10);
      gameState.addScore(3000);

      // Transforma el portal de salida en un portal abierto radiante
      if (exitPortal) {
        exitPortal.use(k.sprite("door_open"));
        exitPortal.color = k.rgb(160, 255, 210);

        // Brillo pulsante del portal
        exitPortal.onUpdate(() => {
          exitPortal.scale = k.vec2(tileSize / 16 * k.wave(0.95, 1.15, k.time() * 4));
        });
      }

      // Cartel principal de victoria
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

    // Interacción al entrar en el portal de salida
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
        // Regresa de forma segura al Nivel 2
        gameState.currentLevel = 2;
        k.go("level2");
      });
    });

    // Combate contra los guardianes (espada y pisotones aéreos)
    player.onCollide("enemy", (enemy) => {
      if (enemy.isDead || enemy.isHurt) return;

      const isStomping =
        (player.pos.y < enemy.pos.y - 2 && !player.isGrounded()) ||
        (player.vel && player.vel.y > 0 && player.pos.y < enemy.pos.y);

      if (isStomping) {
        // El pisotón inflige 2 de daño crítico con rebote
        enemy.takeDamage(2, player.pos.x);
        player.jump(player.jumpForce * 0.85);
        player.hasDoubleJumped = false;
        k.play("jump");
        return;
      }

      // Si Mili cubre con el escudo mirando al enemigo, bloquea el golpe
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

    // Rebote en trampolines
    player.onCollide("spring", (s) => {
      k.play("jump");
      player.jump(player.jumpForce * 1.55);
      player.hasDoubleJumped = false;
      showPopup(s.pos, "¡IMPULSO!", k.rgb(120, 255, 200));
    });

    // Peligro de pinchos
    player.onCollide("spikes", () => {
      if (player.isHurt || player.isDead) return;
      player.receiveDamage(0);
    });

    // Monedas (+100)
    player.onCollide("coin", (c) => {
      c.destroy();
      k.play("coin");
      gameState.addScore(100);
      showPopup(c.pos, "+100");
    });

    // Gemas (+250)
    player.onCollide("gem", (g) => {
      g.destroy();
      k.play("coin");
      gameState.addScore(250);
      showPopup(g.pos, "+250", k.rgb(120, 220, 255));
    });

    // Corazones soltados por enemigos
    player.onCollide("heart_drop", (h) => {
      h.destroy();
      k.play("powerup");
      gameState.gainLife();
      showPopup(h.pos, "+1 VIDA", k.rgb(255, 100, 140));
    });

    // Bucle principal de actualización
    k.onUpdate(() => {
      if (!player) return;

      // Límites laterales
      if (player.pos.x < 16) player.pos.x = 16;
      if (player.pos.x > mapWidth - 16) player.pos.x = mapWidth - 16;

      // Seguridad ante caída al vacío inferior
      if (player.pos.y > mapHeight + 50 && !player.isDead) {
        player.receiveDamage(0);
        player.pos.x = playerSpawnX;
        player.pos.y = playerSpawnY;
      }

      // Seguimiento suave de la cámara
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

    // Inicializa el HUD
    createHUD(k);
  });
}
