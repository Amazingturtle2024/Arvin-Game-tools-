import Phaser from "phaser";
import { loadMoveSpeed, runSpeedFor, walkSpeedFor } from "../settings";

/**
 * Your full knight picture as the body, with animated legs + sword overlay.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;

  private readonly visual: Phaser.GameObjects.Container;
  private readonly leftLeg: Phaser.GameObjects.Image;
  private readonly rightLeg: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly sword: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;

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
  private facing = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, moveSpeedLevel = loadMoveSpeed()) {
    this.moveSpeedLevel = moveSpeedLevel;

    this.sprite = scene.physics.add.sprite(x, y, "playerHit");
    this.sprite.setVisible(false);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setSize(22, 20);
    this.sprite.setOffset(5, 6);
    this.sprite.setDepth(10);
    this.sprite.setMaxVelocity(320, 320);

    this.shadow = scene.add.ellipse(0, 22, 32, 10, 0x000000, 0.28);

    // Full knight art (feet cleared) — keeps your look intact
    this.body = scene.add.image(0, -4, "knightTorso").setOrigin(0.5, 0.72);
    this.body.setDisplaySize(56, 52);

    // Legs under the body, drawn on top of the lower edge so strides read
    this.leftLeg = scene.add.image(-8, 12, "knightLeg").setOrigin(0.5, 0);
    this.rightLeg = scene.add.image(8, 12, "knightLeg").setOrigin(0.5, 0);
    this.leftLeg.setDisplaySize(13, 18);
    this.rightLeg.setDisplaySize(13, 18);

    // Sword from your art — covers static sword and swings while walking
    this.sword = scene.add.image(18, 0, "knightSword").setOrigin(0.3, 0.9);
    this.sword.setDisplaySize(24, 44);

    this.visual = scene.add.container(x, y, [
      this.shadow,
      this.body,
      this.leftLeg,
      this.rightLeg,
      this.sword,
    ]);
    this.visual.setDepth(10);

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
      this.walkPhase += delta * (running ? 0.04 : 0.03);
    } else {
      this.walkPhase *= 0.82;
    }

    this.sprite.setVelocity(vx, vy);
    this.visual.setPosition(this.sprite.x, this.sprite.y);

    // Art faces left. Flip when moving right.
    if (vx > 0) this.facing = 1;
    else if (vx < 0) this.facing = -1;
    this.visual.setScale(this.facing, 1);

    this.animate(moving, running);
  }

  private animate(moving: boolean, running: boolean): void {
    const swing = moving ? Math.sin(this.walkPhase) : 0;
    const swingOpp = moving ? Math.sin(this.walkPhase + Math.PI) : 0;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * (running ? 2.5 : 1.6) : 0;

    // Legs
    const legDeg = running ? 42 : 32;
    this.leftLeg.setAngle(swing * legDeg);
    this.rightLeg.setAngle(swingOpp * legDeg);
    this.leftLeg.setPosition(-8 + swing * 2, 12 + swingOpp * 2.5);
    this.rightLeg.setPosition(8 + swingOpp * 2, 12 + swing * 2.5);

    // Body (your picture)
    this.body.y = -4 - bob;
    this.body.setAngle(moving ? swing * 3.5 : 0);

    // Sword swing
    const swordDeg = running ? 50 : 36;
    this.sword.setPosition(18 + swing * 2.5, 0 - bob * 0.7);
    this.sword.setAngle((moving ? swingOpp * swordDeg : 0) + 6);

    if (!moving) {
      const breath = Math.sin(Date.now() / 480) * 0.45;
      this.body.y = -4 + breath;
      this.sword.y = breath * 0.35;
      this.leftLeg.setAngle(-3);
      this.rightLeg.setAngle(3);
      this.leftLeg.setPosition(-8, 12);
      this.rightLeg.setPosition(8, 12);
      this.sword.setAngle(6);
    }
  }
}
