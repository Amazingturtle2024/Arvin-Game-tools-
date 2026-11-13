import Phaser from "phaser";
import { loadMoveSpeed, runSpeedFor, walkSpeedFor } from "../settings";

/**
 * Player uses the uploaded knight picture.
 * While moving: light bob + tilt so it feels alive without layered parts.
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
  private readonly baseDisplayW = 52;
  private readonly baseDisplayH = 56;

  constructor(scene: Phaser.Scene, x: number, y: number, moveSpeedLevel = loadMoveSpeed()) {
    this.moveSpeedLevel = moveSpeedLevel;
    this.sprite = scene.physics.add.sprite(x, y, "player");
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);
    this.sprite.setDisplaySize(this.baseDisplayW, this.baseDisplayH);
    this.sprite.setSize(22, 24);
    this.sprite.setOffset(
      (this.sprite.width - 22) / 2,
      this.sprite.height - 28,
    );

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
      this.walkPhase += delta * (running ? 0.028 : 0.02);
    } else {
      this.walkPhase *= 0.85;
    }

    this.sprite.setVelocity(vx, vy);

    // Art faces left in the source image — flip when moving right.
    if (vx > 0) this.sprite.setFlipX(true);
    else if (vx < 0) this.sprite.setFlipX(false);

    // Subtle whole-body walk: bob + tiny tilt (keeps your picture intact)
    if (moving) {
      const bob = Math.abs(Math.sin(this.walkPhase)) * (running ? 3 : 2);
      const tilt = Math.sin(this.walkPhase) * (running ? 4 : 2.5);
      const squash = 1 + Math.sin(this.walkPhase * 2) * 0.03;
      this.sprite.setAngle(tilt);
      this.sprite.setDisplaySize(this.baseDisplayW * squash, this.baseDisplayH - bob * 0.15);
      this.sprite.setTint(running ? 0xfff4d6 : 0xffffff);
    } else {
      this.sprite.setAngle(0);
      this.sprite.setDisplaySize(this.baseDisplayW, this.baseDisplayH);
      this.sprite.clearTint();
    }
  }
}
