import Phaser from "phaser";
import { Player } from "../entities/Player";
import { clampMoveSpeed, loadMoveSpeed, saveMoveSpeed } from "../settings";

const MAP_TILES_X = 42;
const MAP_TILES_Y = 32;
const TILE = 32;

type TileKey =
  | "grass"
  | "grassDark"
  | "grassMoss"
  | "path"
  | "pathEdge"
  | "mud"
  | "water"
  | "cliff"
  | "cliffTop"
  | "bridge"
  | "stairs";

/**
 * Jungle layout inspired by Docs/reference/jungle-pixel-style.jpg:
 * bright grass, dirt paths, cliffs + stairs, central river, wooden bridge.
 */
export class JungleScene extends Phaser.Scene {
  private player!: Player;
  private goalText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private foundMap = false;
  private readonly blocked = new Set<string>();

  constructor() {
    super("Jungle");
  }

  create(): void {
    const worldW = MAP_TILES_X * TILE;
    const worldH = MAP_TILES_Y * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor("#1e6b45");

    const tiles = this.buildTileMap();
    this.drawGround(tiles);

    const obstacles = this.physics.add.staticGroup();
    this.addWaterCollision(obstacles, tiles);
    this.addCliffCollision(obstacles, tiles);
    this.placeFoliage(obstacles, tiles);
    this.placeWaterDecor(tiles);
    this.placeRuins(obstacles);
    this.spawnFireflies(worldW, worldH);

    // Spawn on upper terrace near path
    this.player = new Player(this, 6 * TILE, 5 * TILE, loadMoveSpeed());
    this.physics.add.collider(this.player.sprite, obstacles);

    const mapScrap = this.physics.add.staticImage(
      worldW - 6 * TILE,
      worldH - 5 * TILE,
      "mapScrap",
    );
    mapScrap.setDepth(7);

    const glow = this.add.circle(mapScrap.x, mapScrap.y, 30, 0xe8d5a3, 0.2);
    glow.setDepth(6);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.38 },
      scale: { from: 0.9, to: 1.2 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    this.physics.add.overlap(this.player.sprite, mapScrap, () => this.collectMap(mapScrap));
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.fadeIn(450, 20, 80, 50);

    this.createHud();
  }

  update(): void {
    this.player.update();
  }

  private createHud(): void {
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

    this.speedText = this.add
      .text(16, 44, this.speedHudLabel(), {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "13px",
        color: "#9bb39b",
        backgroundColor: "#0b151099",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(16, 72, "Shift = run · [ / ] change speed", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "12px",
        color: "#7f947f",
        backgroundColor: "#0b151099",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-OPEN_BRACKET", () => this.adjustSpeed(-1));
      this.input.keyboard.on("keydown-CLOSED_BRACKET", () => this.adjustSpeed(1));
    }
  }

  private speedHudLabel(): string {
    return `Speed ${this.player.getMoveSpeedLevel()} / 10`;
  }

  private adjustSpeed(delta: number): void {
    const next = saveMoveSpeed(clampMoveSpeed(this.player.getMoveSpeedLevel() + delta));
    this.player.setMoveSpeedLevel(next);
    this.speedText.setText(this.speedHudLabel());
  }

  private k(x: number, y: number): string {
    return `${x},${y}`;
  }

  private block(x: number, y: number): void {
    this.blocked.add(this.k(x, y));
  }

  private isBlocked(x: number, y: number): boolean {
    return this.blocked.has(this.k(x, y));
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_TILES_X && y < MAP_TILES_Y;
  }

  private buildTileMap(): TileKey[][] {
    const tiles: TileKey[][] = Array.from({ length: MAP_TILES_Y }, () =>
      Array.from({ length: MAP_TILES_X }, () => "grass" as TileKey),
    );

    // Base grass variation
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        const n = (x * 17 + y * 31) % 10;
        if (n < 2) tiles[y][x] = "grassDark";
        else if (n < 4) tiles[y][x] = "grassMoss";
        else tiles[y][x] = "grass";
      }
    }

    // --- Cliffs / terraces (left & upper shelves like the reference) ---
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 14; x += 1) {
        tiles[y][x] = y === 9 ? "cliffTop" : y >= 7 ? "cliff" : "grassMoss";
      }
    }
    for (let y = 10; y < 18; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        tiles[y][x] = y === 17 ? "cliffTop" : y >= 15 ? "cliff" : "grass";
      }
    }
    // Stairs cut into cliffs
    tiles[8][6] = "stairs";
    tiles[9][6] = "stairs";
    tiles[16][4] = "stairs";
    tiles[17][4] = "stairs";

    // --- Central vertical river ---
    const riverXs = [18, 19, 20, 21];
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (const x of riverXs) {
        tiles[y][x] = "water";
        this.block(x, y);
      }
      // Widen into pools at top/bottom
      if (y < 4 || y > MAP_TILES_Y - 5) {
        for (let x = 16; x <= 23; x += 1) {
          tiles[y][x] = "water";
          this.block(x, y);
        }
      }
    }

    // Mud banks beside river
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (const x of [17, 22]) {
        if (tiles[y][x] !== "water") tiles[y][x] = "mud";
      }
    }

    // --- Wooden bridge across river ---
    const bridgeY = 12;
    for (let x = 16; x <= 23; x += 1) {
      tiles[bridgeY][x] = "bridge";
      tiles[bridgeY + 1][x] = "bridge";
      this.blocked.delete(this.k(x, bridgeY));
      this.blocked.delete(this.k(x, bridgeY + 1));
    }

    // --- Dirt paths (warm orange like reference) ---
    // From spawn terrace down stairs toward bridge
    for (let y = 3; y <= 9; y += 1) {
      tiles[y][5] = "path";
      tiles[y][6] = "path";
    }
    for (let x = 6; x <= 16; x += 1) {
      tiles[10][x] = "path";
      tiles[11][x] = "path";
    }
    // Across bridge already set; continue east then south to goal
    for (let x = 23; x <= 34; x += 1) {
      tiles[bridgeY][x] = "path";
      tiles[bridgeY + 1][x] = "path";
    }
    for (let y = bridgeY; y <= MAP_TILES_Y - 6; y += 1) {
      tiles[y][33] = "path";
      tiles[y][34] = "path";
    }
    for (let x = 33; x <= MAP_TILES_X - 5; x += 1) {
      tiles[MAP_TILES_Y - 6][x] = "path";
      tiles[MAP_TILES_Y - 5][x] = "path";
    }

    // Soft path edges
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        if (tiles[y][x] !== "grass" && tiles[y][x] !== "grassDark" && tiles[y][x] !== "grassMoss") {
          continue;
        }
        const nearPath = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([px, py]) => this.inBounds(px, py) && tiles[py][px] === "path");
        if (nearPath) tiles[y][x] = "pathEdge";
      }
    }

    // Keep spawn / goal / path walkable in blocker set
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        const t = tiles[y][x];
        if (t === "path" || t === "bridge" || t === "stairs" || t === "pathEdge") {
          this.blocked.delete(this.k(x, y));
        }
        if (t === "cliff" || t === "water") this.block(x, y);
      }
    }
    for (let y = 3; y <= 6; y += 1) {
      for (let x = 4; x <= 8; x += 1) this.blocked.delete(this.k(x, y));
    }
    for (let y = MAP_TILES_Y - 8; y <= MAP_TILES_Y - 3; y += 1) {
      for (let x = MAP_TILES_X - 9; x <= MAP_TILES_X - 3; x += 1) {
        this.blocked.delete(this.k(x, y));
      }
    }

    return tiles;
  }

  private drawGround(tiles: TileKey[][]): void {
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        const key = tiles[y][x];
        const img = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key).setDepth(0);
        if (key === "water") {
          this.tweens.add({
            targets: img,
            alpha: { from: 0.88, to: 1 },
            duration: 1400 + ((x + y) % 4) * 150,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }

    // Foam along water edges
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        if (tiles[y][x] !== "water") continue;
        const shore = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(
          ([px, py]) =>
            this.inBounds(px, py) &&
            tiles[py][px] !== "water" &&
            tiles[py][px] !== "bridge",
        );
        if (shore) {
          this.add
            .image(x * TILE + TILE / 2, y * TILE + TILE / 2 - 6, "foam")
            .setDepth(1)
            .setAlpha(0.55)
            .setScale(0.7);
        }
      }
    }
  }

  private addWaterCollision(
    obstacles: Phaser.Physics.Arcade.StaticGroup,
    tiles: TileKey[][],
  ): void {
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        if (tiles[y][x] !== "water") continue;
        const body = obstacles.create(
          x * TILE + TILE / 2,
          y * TILE + TILE / 2,
          "water",
        ) as Phaser.Physics.Arcade.Sprite;
        body.setVisible(false);
        body.setSize(30, 30);
        body.setOffset(1, 1);
        body.refreshBody();
      }
    }
  }

  private addCliffCollision(
    obstacles: Phaser.Physics.Arcade.StaticGroup,
    tiles: TileKey[][],
  ): void {
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        if (tiles[y][x] !== "cliff") continue;
        const body = obstacles.create(
          x * TILE + TILE / 2,
          y * TILE + TILE / 2,
          "cliff",
        ) as Phaser.Physics.Arcade.Sprite;
        body.setVisible(false);
        body.setSize(32, 28);
        body.setOffset(0, 2);
        body.refreshBody();
      }
    }
  }

  private placeFoliage(
    obstacles: Phaser.Physics.Arcade.StaticGroup,
    tiles: TileKey[][],
  ): void {
    let placed = 0;
    let attempts = 0;
    while (placed < 120 && attempts < 800) {
      attempts += 1;
      const tx = Phaser.Math.Between(1, MAP_TILES_X - 2);
      const ty = Phaser.Math.Between(1, MAP_TILES_Y - 2);
      const ground = tiles[ty][tx];
      if (
        ground === "water" ||
        ground === "bridge" ||
        ground === "path" ||
        ground === "stairs" ||
        ground === "cliff" ||
        this.isBlocked(tx, ty)
      ) {
        continue;
      }
      this.block(tx, ty);

      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      const roll = placed % 10;
      let key = "tree";
      if (roll === 1 || roll === 6) key = "pine";
      else if (roll === 3) key = "rock";
      else if (roll === 4) key = "bush";
      else if (roll === 8) key = "log";

      const sprite = obstacles.create(px, py, key) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(3);
      sprite.setScale(Phaser.Math.FloatBetween(0.95, 1.2));

      if (key === "rock") {
        sprite.setSize(22, 12);
        sprite.setOffset(5, 8);
      } else if (key === "bush") {
        sprite.setSize(20, 12);
        sprite.setOffset(6, 10);
        this.sway(sprite, 1.5);
      } else if (key === "log") {
        sprite.setSize(36, 12);
        sprite.setOffset(6, 10);
      } else {
        sprite.setSize(16, 14);
        sprite.setOffset(9, 28);
        this.sway(sprite, 1.2);
      }
      sprite.refreshBody();
      placed += 1;
    }

    // Passable mushrooms / flowers / tufts
    for (let i = 0; i < 100; i += 1) {
      const tx = Phaser.Math.Between(1, MAP_TILES_X - 2);
      const ty = Phaser.Math.Between(1, MAP_TILES_Y - 2);
      const ground = tiles[ty][tx];
      if (ground === "water" || ground === "bridge" || ground === "path" || ground === "cliff") {
        continue;
      }
      const keys = ["mushroomRed", "mushroomBlue", "mushroomBrown", "flowers", "grassTuft"] as const;
      const key = keys[i % keys.length];
      const deco = this.add
        .image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, key)
        .setDepth(2)
        .setScale(Phaser.Math.FloatBetween(0.85, 1.15));
      if (key === "mushroomBlue") {
        this.tweens.add({
          targets: deco,
          alpha: { from: 0.65, to: 1 },
          duration: 900,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private placeWaterDecor(tiles: TileKey[][]): void {
    for (let y = 0; y < MAP_TILES_Y; y += 1) {
      for (let x = 0; x < MAP_TILES_X; x += 1) {
        if (tiles[y][x] !== "water" && tiles[y][x] !== "mud") continue;
        if ((x + y) % 5 !== 0) continue;

        if (tiles[y][x] === "mud" || (tiles[y][x] === "water" && (x + y) % 7 === 0)) {
          const reeds = this.add
            .image(x * TILE + TILE / 2, y * TILE + TILE / 2 - 4, "reeds")
            .setDepth(2)
            .setScale(Phaser.Math.FloatBetween(0.9, 1.2));
          this.sway(reeds, 2.5);
        }
        if (tiles[y][x] === "water" && (x * y) % 11 === 0) {
          const lily = this.add
            .image(x * TILE + TILE / 2, y * TILE + TILE / 2, "lily")
            .setDepth(2)
            .setAlpha(0.95);
          this.tweens.add({
            targets: lily,
            x: lily.x + Phaser.Math.Between(-3, 3),
            duration: 2600,
            yoyo: true,
            repeat: -1,
          });
        }
        if (tiles[y][x] === "water" && (x + y * 3) % 17 === 0) {
          const log = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, "log").setDepth(2);
          this.tweens.add({
            targets: log,
            x: log.x + 6,
            angle: { from: -2, to: 2 },
            duration: 3200,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }
  }

  private placeRuins(obstacles: Phaser.Physics.Arcade.StaticGroup): void {
    const spots = [
      { x: MAP_TILES_X - 10, y: MAP_TILES_Y - 9, key: "ruinPillar" },
      { x: MAP_TILES_X - 8, y: MAP_TILES_Y - 10, key: "ruinPillar" },
      { x: MAP_TILES_X - 9, y: MAP_TILES_Y - 7, key: "ruinSlab" },
    ];
    for (const spot of spots) {
      this.block(spot.x, spot.y);
      const sprite = obstacles.create(
        spot.x * TILE + TILE / 2,
        spot.y * TILE + TILE / 2,
        spot.key,
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(4);
      sprite.setSize(18, 16);
      sprite.setOffset(8, 20);
      sprite.refreshBody();
    }
  }

  private spawnFireflies(worldW: number, worldH: number): void {
    for (let i = 0; i < 20; i += 1) {
      const fly = this.add
        .image(
          Phaser.Math.Between(40, worldW - 40),
          Phaser.Math.Between(40, worldH - 40),
          "firefly",
        )
        .setDepth(8)
        .setAlpha(0.25)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: fly,
        x: fly.x + Phaser.Math.Between(-36, 36),
        y: fly.y + Phaser.Math.Between(-28, 28),
        alpha: { from: 0.2, to: 0.95 },
        duration: Phaser.Math.Between(1600, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200),
      });
    }
  }

  private sway(target: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Sprite, amount: number): void {
    this.tweens.add({
      targets: target,
      angle: { from: -amount, to: amount },
      duration: Phaser.Math.Between(1800, 3200),
      yoyo: true,
      repeat: -1,
    });
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

    this.tweens.add({ targets: banner, alpha: 1, duration: 500 });
  }
}
