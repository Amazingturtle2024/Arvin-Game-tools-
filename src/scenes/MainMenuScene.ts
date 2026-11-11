import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../game";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12);

    for (let i = 0; i < 18; i += 1) {
      const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
      const y = Phaser.Math.Between(40, GAME_HEIGHT - 40);
      this.add.image(x, y, "tree").setAlpha(0.22).setScale(Phaser.Math.FloatBetween(0.8, 1.4));
    }

    this.add
      .text(GAME_WIDTH / 2, 150, "THE LOST KINGDOM", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "48px",
        color: "#e8d5a3",
        stroke: "#1a1008",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 220, "A stranded explorer. A forgotten jungle.\nFind the ancient map scrap.", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "18px",
        color: "#b7c9b0",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const start = this.add
      .text(GAME_WIDTH / 2, 320, "[ Enter ] Begin Expedition", {
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
      .text(GAME_WIDTH / 2, 400, "WASD / Arrows to move · Hold Shift to run", {
        fontFamily: "Palatino Linotype, Palatino, Georgia, serif",
        fontSize: "14px",
        color: "#7f947f",
      })
      .setOrigin(0.5);

    if (this.input.keyboard) {
      this.input.keyboard.once("keydown-ENTER", () => this.scene.start("Jungle"));
    }
  }
}
