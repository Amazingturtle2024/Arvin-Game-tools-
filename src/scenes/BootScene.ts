import Phaser from "phaser";

/**
 * Procedural pixel textures inspired by Docs/reference/jungle-pixel-style.jpg
 * (bright top-down 16-bit jungle: cliffs, river, bridge, mushrooms, pines).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // Player art from Docs/reference/player-knight.png (user-provided knight theme)
    this.load.image("player", "assets/player-knight.png");
  }

  create(): void {
    this.createTextures();
    this.scene.start("MainMenu");
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Round deciduous tree
    g.clear();
    g.fillStyle(0x6b3f1f, 1);
    g.fillRect(14, 28, 6, 16);
    g.fillStyle(0x1f7a3a, 1);
    g.fillCircle(17, 20, 14);
    g.fillStyle(0x2f9e4f, 1);
    g.fillCircle(10, 22, 9);
    g.fillCircle(24, 22, 9);
    g.fillStyle(0x48c46a, 0.7);
    g.fillCircle(17, 14, 7);
    g.generateTexture("tree", 34, 46);

    // Layered pine
    g.clear();
    g.fillStyle(0x5a3a18, 1);
    g.fillRect(15, 34, 5, 12);
    g.fillStyle(0x0f4d2c, 1);
    g.fillTriangle(17, 4, 4, 22, 30, 22);
    g.fillStyle(0x176b3c, 1);
    g.fillTriangle(17, 12, 6, 30, 28, 30);
    g.fillStyle(0x1f8a4a, 1);
    g.fillTriangle(17, 20, 8, 38, 26, 38);
    g.generateTexture("pine", 34, 48);

    // Bush
    g.clear();
    g.fillStyle(0x1f6b38, 1);
    g.fillEllipse(16, 16, 28, 18);
    g.fillStyle(0x2f9e55, 1);
    g.fillEllipse(10, 14, 12, 10);
    g.fillEllipse(22, 14, 12, 10);
    g.generateTexture("bush", 32, 26);

    // Red spotted mushroom
    g.clear();
    g.fillStyle(0xf2eee4, 1);
    g.fillRect(13, 14, 6, 12);
    g.fillStyle(0xd63a3a, 1);
    g.fillEllipse(16, 12, 22, 14);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(10, 11, 2);
    g.fillCircle(18, 8, 2.5);
    g.fillCircle(22, 13, 2);
    g.generateTexture("mushroomRed", 32, 28);

    // Cyan glow mushroom
    g.clear();
    g.fillStyle(0xdce8ef, 1);
    g.fillRect(14, 14, 5, 12);
    g.fillStyle(0x3ad0d8, 1);
    g.fillEllipse(16, 12, 18, 12);
    g.fillStyle(0xb8ffff, 0.9);
    g.fillCircle(16, 10, 3);
    g.generateTexture("mushroomBlue", 32, 28);

    // Brown shelf mushroom
    g.clear();
    g.fillStyle(0x8b5a2b, 1);
    g.fillEllipse(16, 16, 22, 12);
    g.fillStyle(0xc49a6c, 1);
    g.fillEllipse(16, 14, 14, 7);
    g.generateTexture("mushroomBrown", 32, 24);

    // Flowers cluster
    g.clear();
    g.fillStyle(0x3aa34f, 1);
    g.fillCircle(8, 20, 2);
    g.fillCircle(16, 22, 2);
    g.fillCircle(24, 18, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 16, 3);
    g.fillStyle(0xf2d84a, 1);
    g.fillCircle(16, 18, 3);
    g.fillStyle(0xe85a5a, 1);
    g.fillCircle(24, 14, 3);
    g.fillStyle(0xfff6b0, 1);
    g.fillCircle(8, 16, 1);
    g.fillCircle(16, 18, 1);
    g.fillCircle(24, 14, 1);
    g.generateTexture("flowers", 32, 28);

    // Grass tuft
    g.clear();
    g.lineStyle(2, 0x3cb371, 1);
    g.lineBetween(8, 20, 6, 8);
    g.lineBetween(12, 20, 12, 6);
    g.lineBetween(16, 20, 18, 9);
    g.lineStyle(2, 0x2f9e55, 1);
    g.lineBetween(10, 20, 9, 10);
    g.lineBetween(14, 20, 15, 8);
    g.generateTexture("grassTuft", 24, 22);

    // Reeds / cattails
    g.clear();
    g.lineStyle(2, 0x3d7a45, 1);
    g.lineBetween(8, 30, 7, 6);
    g.lineBetween(16, 30, 16, 4);
    g.lineBetween(24, 30, 25, 8);
    g.fillStyle(0x8b5a2b, 1);
    g.fillEllipse(7, 8, 5, 8);
    g.fillEllipse(16, 6, 5, 8);
    g.fillEllipse(25, 10, 5, 8);
    g.generateTexture("reeds", 32, 32);

    // Lily pad
    g.clear();
    g.fillStyle(0x2f9e55, 1);
    g.fillEllipse(16, 14, 24, 16);
    g.fillStyle(0x1f7a3a, 1);
    g.fillTriangle(16, 14, 28, 10, 28, 18);
    g.fillStyle(0xf0d878, 1);
    g.fillCircle(12, 12, 3);
    g.generateTexture("lily", 32, 24);

    // Rock
    g.clear();
    g.fillStyle(0x7a7568, 1);
    g.fillEllipse(16, 14, 26, 16);
    g.fillStyle(0xa8a295, 1);
    g.fillEllipse(12, 11, 10, 6);
    g.fillStyle(0x4e4a40, 0.45);
    g.fillEllipse(20, 16, 8, 5);
    g.generateTexture("rock", 32, 24);

    // Floating log
    g.clear();
    g.fillStyle(0x6b4423, 1);
    g.fillRoundedRect(2, 10, 44, 12, 5);
    g.fillStyle(0x8b5e34, 1);
    g.fillRoundedRect(4, 12, 40, 5, 3);
    g.fillStyle(0x3d2814, 1);
    g.fillCircle(4, 16, 5);
    g.fillCircle(44, 16, 5);
    g.generateTexture("log", 48, 28);

    // Cliff face (brown rocky wall)
    g.clear();
    g.fillStyle(0x8b5a3c, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xa06a45, 1);
    g.fillRect(0, 0, 32, 6);
    g.fillStyle(0x6e422c, 1);
    g.fillRect(4, 10, 10, 4);
    g.fillRect(18, 18, 10, 4);
    g.fillStyle(0xb88a62, 0.5);
    g.fillRect(2, 2, 8, 3);
    g.generateTexture("cliff", 32, 32);

    // Cliff top grass overhang
    g.clear();
    g.fillStyle(0x8b5a3c, 1);
    g.fillRect(0, 10, 32, 22);
    g.fillStyle(0x3cb371, 1);
    g.fillRect(0, 0, 32, 14);
    g.fillStyle(0x2f9e55, 1);
    g.fillRect(0, 10, 32, 4);
    g.fillStyle(0x48c46a, 0.5);
    g.fillRect(4, 2, 8, 4);
    g.generateTexture("cliffTop", 32, 32);

    // Wooden stairs
    g.clear();
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(4, 22, 24, 6);
    g.fillRect(6, 14, 20, 6);
    g.fillRect(8, 6, 16, 6);
    g.fillStyle(0xc49a6c, 1);
    g.fillRect(4, 22, 24, 2);
    g.fillRect(6, 14, 20, 2);
    g.fillRect(8, 6, 16, 2);
    g.generateTexture("stairs", 32, 32);

    // Wooden bridge plank tile
    g.clear();
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xa8743b, 1);
    g.fillRect(2, 0, 6, 32);
    g.fillRect(12, 0, 6, 32);
    g.fillRect(22, 0, 6, 32);
    g.fillStyle(0x5c3a18, 1);
    g.fillRect(0, 2, 32, 3);
    g.fillRect(0, 27, 32, 3);
    g.fillStyle(0xd2a36a, 0.35);
    g.fillRect(3, 6, 4, 8);
    g.generateTexture("bridge", 32, 32);

    // Ruin slab (kept for goal area)
    g.clear();
    g.fillStyle(0x9a917c, 1);
    g.fillRect(2, 8, 28, 16);
    g.fillStyle(0xb0a78f, 1);
    g.fillRect(4, 10, 10, 5);
    g.fillStyle(0x6f6858, 1);
    g.fillTriangle(22, 8, 30, 24, 18, 24);
    g.generateTexture("ruinSlab", 32, 28);

    g.clear();
    g.fillStyle(0x8d8674, 1);
    g.fillRect(8, 4, 20, 36);
    g.fillStyle(0xa9a08c, 1);
    g.fillRect(8, 4, 20, 6);
    g.fillStyle(0x6e6858, 1);
    g.fillRect(10, 14, 16, 3);
    g.fillRect(10, 24, 16, 3);
    g.generateTexture("ruinPillar", 36, 44);

    // Bright grass
    g.clear();
    g.fillStyle(0x3cb371, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x48c46a, 0.55);
    g.fillRect(3, 4, 6, 5);
    g.fillRect(18, 16, 8, 4);
    g.fillStyle(0x2f9e55, 0.4);
    g.fillRect(12, 22, 10, 3);
    g.fillStyle(0xd8d2c0, 0.5);
    g.fillCircle(22, 8, 1.5);
    g.fillCircle(9, 18, 1);
    g.generateTexture("grass", 32, 32);

    g.clear();
    g.fillStyle(0x2f9e55, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x248a48, 0.5);
    g.fillRect(2, 2, 12, 10);
    g.fillRect(16, 18, 12, 8);
    g.generateTexture("grassDark", 32, 32);

    g.clear();
    g.fillStyle(0x4ecf72, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x6ae08a, 0.45);
    g.fillCircle(10, 12, 5);
    g.fillCircle(22, 20, 4);
    g.generateTexture("grassMoss", 32, 32);

    // Warm dirt path (reference orange-tan)
    g.clear();
    g.fillStyle(0xd2a35c, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xe0b56e, 0.55);
    g.fillRect(2, 8, 28, 3);
    g.fillRect(6, 18, 18, 2);
    g.fillStyle(0xb88945, 0.35);
    g.fillCircle(10, 12, 2);
    g.fillCircle(22, 22, 1.5);
    g.generateTexture("path", 32, 32);

    g.clear();
    g.fillStyle(0xb88945, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3cb371, 0.4);
    g.fillRect(0, 0, 12, 32);
    g.fillStyle(0xd2a35c, 0.55);
    g.fillRect(14, 0, 18, 32);
    g.generateTexture("pathEdge", 32, 32);

    // Mud bank
    g.clear();
    g.fillStyle(0x8a6a3c, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xa48450, 0.45);
    g.fillEllipse(12, 14, 14, 8);
    g.generateTexture("mud", 32, 32);

    // Bright patterned water
    g.clear();
    g.fillStyle(0x2a8fc4, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4eb3e0, 0.65);
    g.fillEllipse(8, 10, 12, 6);
    g.fillEllipse(22, 20, 12, 6);
    g.fillStyle(0x7fd0ef, 0.35);
    g.fillEllipse(16, 6, 10, 3);
    g.fillStyle(0xb8e8ff, 0.25);
    g.fillCircle(12, 16, 2);
    g.fillCircle(24, 12, 2);
    g.generateTexture("water", 32, 32);

    // Foam / shoreline highlight
    g.clear();
    g.fillStyle(0xffffff, 0.75);
    g.fillEllipse(16, 8, 28, 8);
    g.fillStyle(0xd8f0ff, 0.5);
    g.fillEllipse(16, 10, 20, 4);
    g.generateTexture("foam", 32, 16);

    // Map scrap goal
    g.clear();
    g.fillStyle(0xe8d5a3, 1);
    g.fillRoundedRect(2, 2, 28, 28, 3);
    g.lineStyle(2, 0x8b5a2b, 1);
    g.strokeRoundedRect(2, 2, 28, 28, 3);
    g.lineStyle(1.5, 0xb33a2b, 1);
    g.strokeCircle(16, 16, 6);
    g.lineBetween(16, 10, 16, 22);
    g.lineBetween(10, 16, 22, 16);
    g.generateTexture("mapScrap", 32, 32);

    // Firefly
    g.clear();
    g.fillStyle(0xf5e6a3, 1);
    g.fillCircle(4, 4, 3);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(3, 3, 1);
    g.generateTexture("firefly", 8, 8);

    g.destroy();
  }
}
