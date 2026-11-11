import Phaser from "phaser";
import { Player } from "../entities/Player";

const MAP_TILES_X = 40;
const MAP_TILES_Y = 30;
const TILE = 32;

export class JungleScene extends Phaser.Scene {
  private player!: Player;
  private goalText!: Phaser.GameObjects.Text;
  private foundMap = false;

  constructor() {
    super("Jungle");
  }

  create(): void {
    const worldW = MAP_TILES_X * TILE;
    const worldH = MAP_TILES_Y * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor("#1a3d28");

    this.drawGround(worldW, worldH);

    const obstacles = this.physics.add.staticGroup();
    this.placeFoliage(obstacles, worldW, worldH);

    this.player = new Player(this, 4 * TILE, 4 * TILE);
    this.physics.add.collider(this.player.sprite, obstacles);

    const mapScrap = this.physics.add.staticImage(worldW - 5 * TILE, worldH - 5 * TILE, "mapScrap");
    mapScrap.setDepth(5);

    // Soft glow under the goal
    const glow = this.add.circle(mapScrap.x, mapScrap.y, 28, 0xe8d5a3, 0.18);
    glow.setDepth(4);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.32 },
      scale: { from: 0.9, to: 1.15 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    this.physics.add.overlap(this.player.sprite, mapScrap, () => this.collectMap(mapScrap));

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

    this.goalText = this.add
      .text(16, 12, "Objective: Find the ancient map scrap", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "16px",
        color: "#e8d5a3",
        backgroundColor: "#0b1510cc",
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(16, 44, "Shift = run", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "13px",
        color: "#9bb39b",
        backgroundColor: "#0b151099",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(): void {
    this.player.update();
  }

  private drawGround(worldW: number, worldH: number): void {
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        const onPath =
          (x >= 3 && x <= 5 && y >= 3 && y <= MAP_TILES_Y - 6) ||
          (y >= MAP_TILES_Y - 8 && y <= MAP_TILES_Y - 6 && x >= 3 && x <= MAP_TILES_X - 6) ||
          (x >= MAP_TILES_X - 8 && x <= MAP_TILES_X - 6 && y >= MAP_TILES_Y - 8 && y <= MAP_TILES_Y - 5);

        const key = onPath ? "path" : "grass";
        this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key).setDepth(0);
      }
    }

    // Gentle vignette feel via edge tint rectangles
    this.add.rectangle(worldW / 2, 8, worldW, 16, 0x0a1a10, 0.35).setDepth(1);
    this.add.rectangle(worldW / 2, worldH - 8, worldW, 16, 0x0a1a10, 0.35).setDepth(1);
  }

  private placeFoliage(
    obstacles: Phaser.Physics.Arcade.StaticGroup,
    worldW: number,
    worldH: number,
  ): void {
    const blocked = new Set<string>();
    const block = (tx: number, ty: number) => blocked.add(`${tx},${ty}`);

    // Keep spawn and goal clear
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 2; x <= 6; x += 1) block(x, y);
    }
    for (let y = MAP_TILES_Y - 8; y <= MAP_TILES_Y - 3; y += 1) {
      for (let x = MAP_TILES_X - 8; x <= MAP_TILES_X - 3; x += 1) block(x, y);
    }
    // Keep path mostly clear
    for (let y = 3; y <= MAP_TILES_Y - 6; y += 1) {
      block(3, y);
      block(4, y);
      block(5, y);
    }
    for (let x = 3; x <= MAP_TILES_X - 6; x += 1) {
      block(x, MAP_TILES_Y - 8);
      block(x, MAP_TILES_Y - 7);
      block(x, MAP_TILES_Y - 6);
    }

    let placed = 0;
    let attempts = 0;
    while (placed < 90 && attempts < 400) {
      attempts += 1;
      const tx = Phaser.Math.Between(1, MAP_TILES_X - 2);
      const ty = Phaser.Math.Between(1, MAP_TILES_Y - 2);
      const key = `${tx},${ty}`;
      if (blocked.has(key)) continue;
      blocked.add(key);

      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      const useRock = placed % 5 === 0;
      const sprite = obstacles.create(px, py, useRock ? "rock" : "tree") as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(2);
      if (useRock) {
        sprite.setSize(24, 14);
        sprite.setOffset(4, 6);
      } else {
        sprite.setSize(18, 16);
        sprite.setOffset(9, 28);
      }
      sprite.refreshBody();
      placed += 1;
    }

    // World edge feeling — invisible is enough via world bounds; decorative trees at corners
    obstacles.create(40, 40, "tree").setDepth(2).refreshBody();
    obstacles.create(worldW - 40, 40, "tree").setDepth(2).refreshBody();
    obstacles.create(40, worldH - 40, "tree").setDepth(2).refreshBody();
  }

  private collectMap(mapScrap: Phaser.Physics.Arcade.Image): void {
    if (this.foundMap) return;
    this.foundMap = true;
    mapScrap.destroy();
    this.goalText.setText("Map scrap recovered — Phase 1 complete!");
    this.goalText.setStyle({ color: "#b8f0c0" });

    const banner = this.add
      .text(this.cameras.main.width / 2, this.cameras.main.height / 2, "You found the ancient map!", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "28px",
        color: "#e8d5a3",
        backgroundColor: "#0b1510ee",
        padding: { x: 20, y: 14 },
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 500,
    });
  }
}
