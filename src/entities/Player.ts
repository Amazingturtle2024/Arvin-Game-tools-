import Phaser from "phaser";
import { loadMoveSpeed, runSpeedFor, walkSpeedFor } from "../settings";

/**
 * Player uses the uploaded knight picture (walk sheet frames).
 * Smooth velocity + facing flip + bob via origin (no setDisplaySize thrash).
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private shift: Phaser.Input.Keyboard.Key;
  private moveSpeedLevel: number;
  private walkPhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, moveSpeedLevel = loadMoveSpeed()) {
    this.moveSpeedLevel = moveSpeedLevel;

    this.sprite = scene.physics.add.sprite(x, y, "player", 0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);
    this.sprite.setScale(0.58);
    this.sprite.setSize(38, 42);
    this.sprite.setOffset(
      (this.sprite.width - 38) / 2,
      this.sprite.height - 46,
    );
    // Smoother physics motion
    this.sprite.setMaxVelocity(320, 320);
    this.sprite.setDrag(0, 0);
    this.sprite.setBounce(0);

    if (!scene.anims.exists("knight-walk")) {
      scene.anims.create({
        key: "knight-walk",
        frames: scene.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!scene.anims.exists("knight-run")) {
      scene.anims.create({
        key: "knight-run",
        frames: scene.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
        frameRate: 12,
        repeat: -1,
      });
    }

    if (!scene.input.keyboard) {
      throw new Error("Keyboard input is required for the player.");
    }

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shift = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  getMoveSpeedLevel(): number {
    return this.moveSpeedLevel;
  }

  setMoveSpeedLevel(level: number): void {
    this.moveSpeedLevel = level;
  }

  update(_time: number, delta: number): void {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    const running = this.shift.isDown;
    const speed = running
      ? runSpeedFor(this.moveSpeedLevel)
      : walkSpeedFor(this.moveSpeedLevel);

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
      this.walkPhase += delta * (running ? 0.025 : 0.018);
    } else {
      this.walkPhase *= 0.8;
    }

    this.sprite.setVelocity(vx, vy);

    // Source art faces left — flip when moving right.
    if (vx > 0) this.sprite.setFlipX(true);
    else if (vx < 0) this.sprite.setFlipX(false);

    if (moving) {
      const anim = running ? "knight-run" : "knight-walk";
      if (this.sprite.anims.currentAnim?.key !== anim) {
        this.sprite.anims.play(anim, true);
      }
      // Soft vertical bob via origin (cheap; avoids resize thrash)
      const bob = Math.abs(Math.sin(this.walkPhase)) * 0.04;
      this.sprite.setOrigin(0.5, 0.55 + bob);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(0);
      this.sprite.setOrigin(0.5, 0.55);
    }
  }
}
