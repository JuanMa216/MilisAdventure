/**
 * Estado global persistente entre escenas del juego.
 * Almacena la puntuación, vidas, progreso de niveles, llaves, libros y secretos desbloqueados.
 */
export const gameState = {
  score: 0,
  lives: 3,
  maxLives: 3,
  currentLevel: 1,
  hasKey: false,
  collectedBook: null, // null | "red" | "green" | "blue"
  secretScoreThreshold: 15000,
  foundEasterEgg: false,
  vasesBrokenCount: 0,
  allVasesDestroyed: false,
  player: null,

  /**
   * Restablece todas las variables de progreso a sus valores iniciales para una nueva partida.
   */
  reset() {
    this.score = 0;
    this.lives = this.maxLives;
    this.currentLevel = 1;
    this.hasKey = false;
    this.collectedBook = null;
    this.foundEasterEgg = false;
    this.vasesBrokenCount = 0;
    this.allVasesDestroyed = false;
    this.player = null;
  },

  /**
   * Resta una vida al jugador sin bajar de 0.
   * @returns {number} Cantidad de vidas restantes.
   */
  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives;
  },

  /**
   * Suma una vida al jugador sin superar el máximo permitido.
   */
  gainLife() {
    this.lives = Math.min(this.maxLives, this.lives + 1);
  },

  /**
   * Añade puntos al marcador global.
   * @param {number} pts - Puntos a sumar.
   */
  addScore(pts) {
    this.score += pts;
  }
};
