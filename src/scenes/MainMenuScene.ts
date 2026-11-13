import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../game";
import {
  MOVE_SPEED_DEFAULT,
  clampMoveSpeed,
  loadMoveSpeed,
  saveMoveSpeed,
} from "../settings";

export class MainMenuScene extends Phaser.Scene {
  private moveSpeed = MOVE_SPEED_DEFAULT;
  private speedLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("MainMenu");
  }

  create(): void {
    this.moveSpeed = loadMoveSpeed();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12);

    for (let i = 0; i < 12; i += 1) {
      const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
      const y = Phaser.Math.Between(40, GAME_HEIGHT - 40);
      this.add.image(x, y, "tree").setAlpha(0.22).setScale(Phaser.Math.FloatBetween(0.8, 1.4));
    }

    // Knight art preview (user theme)
    if (this.textures.exists("playerKnightArt")) {
      this.add
        .image(GAME_WIDTH / 2, 500, "playerKnightArt")
        .setOrigin(0.5, 1)
        .setDisplaySize(70, 74)
        .setAlpha(0.95);
    }

    this.add
      .text(GAME_WIDTH / 2, 120, "THE LOST KINGDOM", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "48px",
        color: "#e8d5a3",
        stroke: "#1a1008",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 180, "A stranded knight. A forgotten jungle.\nFind the ancient map scrap.", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "18px",
        color: "#b7c9b0",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 250, "Move speed", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "16px",
        color: "#9bb39b",
      })
      .setOrigin(0.5);

    const slower = this.add
      .text(GAME_WIDTH / 2 - 90, 290, "[ − ]", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "22px",
        color: "#f0e6c8",
        backgroundColor: "#1f4d32",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.speedLabel = this.add
      .text(GAME_WIDTH / 2, 290, this.speedText(), {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "22px",
        color: "#e8d5a3",
      })
      .setOrigin(0.5);

    const faster = this.add
      .text(GAME_WIDTH / 2 + 90, 290, "[ + ]", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "22px",
        color: "#f0e6c8",
        backgroundColor: "#1f4d32",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    slower.on("pointerdown", () => this.adjustSpeed(-1));
    faster.on("pointerdown", () => this.adjustSpeed(1));

    const start = this.add
      .text(GAME_WIDTH / 2, 360, "[ Enter ] Begin Expedition", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "22px",
        color: "#f0e6c8",
        backgroundColor: "#1f4d32",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    start.on("pointerover", () => start.setStyle({ backgroundColor: "#2a6b44" }));
    start.on("pointerout", () => start.setStyle({ backgroundColor: "#1f4d32" }));
    start.on("pointerdown", () => this.scene.start("Jungle"));

    this.add
      .text(GAME_WIDTH / 2, 430, "WASD / Arrows · Shift run · [ / ] speed in-game", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "14px",
        color: "#7f947f",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 460, "1 = slow · 5 = default (calmer) · 7 ≈ old fast · 10 = sprinty", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "12px",
        color: "#5f7460",
      })
      .setOrigin(0.5);

    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-LEFT", () => this.adjustSpeed(-1));
      this.input.keyboard.on("keydown-RIGHT", () => this.adjustSpeed(1));
      this.input.keyboard.on("keydown-OPEN_BRACKET", () => this.adjustSpeed(-1));
      this.input.keyboard.on("keydown-CLOSED_BRACKET", () => this.adjustSpeed(1));
      this.input.keyboard.once("keydown-ENTER", () => this.scene.start("Jungle"));
    }
  }

  private speedText(): string {
    return `${this.moveSpeed} / 10`;
  }

  private adjustSpeed(delta: number): void {
    this.moveSpeed = saveMoveSpeed(clampMoveSpeed(this.moveSpeed + delta));
    this.speedLabel.setText(this.speedText());
  }
}
