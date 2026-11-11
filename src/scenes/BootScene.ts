import Phaser from "phaser";

/** Generates simple placeholder textures so Phase 1 needs no external art. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // Intentionally empty — textures are drawn in create().
  }

  create(): void {
    this.createTextures();
    this.scene.start("MainMenu");
  }

  private createTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Player (explorer)
    g.clear();
    g.fillStyle(0xc4a574, 1);
    g.fillCircle(16, 16, 12);
    g.fillStyle(0x2f5d3a, 1);
    g.fillRect(8, 20, 16, 10);
    g.fillStyle(0x1b1b1b, 1);
    g.fillCircle(12, 14, 2);
    g.fillCircle(20, 14, 2);
    g.generateTexture("player", 32, 32);

    // Tree canopy
    g.clear();
    g.fillStyle(0x5a3a1a, 1);
    g.fillRect(14, 28, 8, 20);
    g.fillStyle(0x1f6b3a, 1);
    g.fillCircle(18, 22, 16);
    g.fillStyle(0x278a48, 1);
    g.fillCircle(10, 26, 10);
    g.fillCircle(26, 26, 10);
    g.generateTexture("tree", 36, 48);

    // Rock
    g.clear();
    g.fillStyle(0x6b6b5e, 1);
    g.fillEllipse(16, 12, 28, 18);
    g.fillStyle(0x8a8a7a, 1);
    g.fillEllipse(12, 10, 10, 6);
    g.generateTexture("rock", 32, 24);

    // Ancient map scrap (collectible / goal)
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

    // Ground tile tint helper (solid green)
    g.clear();
    g.fillStyle(0x2d6a3e, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x347848, 0.35);
    g.fillRect(4, 4, 8, 8);
    g.fillRect(18, 16, 10, 6);
    g.generateTexture("grass", 32, 32);

    // Path tile
    g.clear();
    g.fillStyle(0x8b734b, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xa0895c, 0.4);
    g.fillRect(2, 10, 28, 4);
    g.generateTexture("path", 32, 32);

    g.destroy();
  }
}
