import Phaser from "phaser";
import { loadMoveSpeed, runSpeedFor, walkSpeedFor } from "../settings";

/**
 * Layered knight with walk/run animation:
 * bobbing body, swinging legs, shield sway, sword arc.
 */
export class Player {
  /** Invisible physics body used for collision / camera follow. */
  readonly sprite: Phaser.Physics.Arcade.Sprite;

  private readonly visual: Phaser.GameObjects.Container;
  private readonly leftLeg: Phaser.GameObjects.Image;
  private readonly rightLeg: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly plume: Phaser.GameObjects.Image;
  private readonly shield: Phaser.GameObjects.Image;
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
  private facing = 1; // 1 = right, -1 = left

  constructor(scene: Phaser.Scene, x: number, y: number, moveSpeedLevel = loadMoveSpeed()) {
    this.moveSpeedLevel = moveSpeedLevel;

    this.sprite = scene.physics.add.sprite(x, y, "playerHit");
    this.sprite.setVisible(false);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setSize(22, 18);
    this.sprite.setOffset(5, 7);
    this.sprite.setDepth(10);

    this.shadow = scene.add.ellipse(0, 18, 28, 10, 0x000000, 0.28);

    this.leftLeg = scene.add.image(-5, 12, "knightLeg").setOrigin(0.5, 0);
    this.rightLeg = scene.add.image(5, 12, "knightLeg").setOrigin(0.5, 0);
    this.body = scene.add.image(0, -2, "knightBody").setOrigin(0.5, 0.55);
    this.plume = scene.add.image(2, -22, "knightPlume").setOrigin(0.2, 0.85);
    this.shield = scene.add.image(-14, 2, "knightShield").setOrigin(0.5, 0.5);
    this.sword = scene.add.image(16, -2, "knightSword").setOrigin(0.2, 0.85);

    this.visual = scene.add.container(x, y, [
      this.shadow,
      this.leftLeg,
      this.rightLeg,
      this.shield,
      this.body,
      this.plume,
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
    }

    this.sprite.setVelocity(vx, vy);
    this.visual.setPosition(this.sprite.x, this.sprite.y);

    if (vx < 0) this.facing = -1;
    else if (vx > 0) this.facing = 1;
    this.visual.setScale(this.facing, 1);

    this.animate(moving, running, delta);
  }

  private animate(moving: boolean, running: boolean, delta: number): void {
    const cadence = running ? 0.028 : 0.018;
    if (moving) {
      this.walkPhase += delta * cadence;
    } else {
      // Ease back toward idle stance
      this.walkPhase *= 0.85;
    }

    const swing = moving ? Math.sin(this.walkPhase) : 0;
    const swingOpp = moving ? Math.sin(this.walkPhase + Math.PI) : 0;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * (running ? 2.4 : 1.6) : 0;
    const lean = moving ? swing * (running ? 0.08 : 0.05) : 0;

    // Legs
    const legAngle = running ? 0.55 : 0.38;
    this.leftLeg.setAngle(Phaser.Math.RadToDeg(swing * legAngle));
    this.rightLeg.setAngle(Phaser.Math.RadToDeg(swingOpp * legAngle));
    this.leftLeg.y = 12 + (moving ? swingOpp * 1.5 : 0);
    this.rightLeg.y = 12 + (moving ? swing * 1.5 : 0);

    // Body bob + slight lean
    this.body.y = -2 - bob;
    this.body.setAngle(Phaser.Math.RadToDeg(lean));

    // Plume flows opposite to lean
    this.plume.y = -22 - bob;
    this.plume.setAngle(Phaser.Math.RadToDeg(-lean * 1.8 + (moving ? swing * 0.12 : 0)));
    this.plume.x = 2 + (moving ? swing * 1.2 : 0);

    // Shield rocks with the stride
    this.shield.y = 2 - bob * 0.6;
    this.shield.x = -14 + (moving ? swingOpp * 1.5 : 0);
    this.shield.setAngle(Phaser.Math.RadToDeg(moving ? swing * 0.25 : 0) + (moving ? -6 : -4));

    // Sword swings opposite the shield arm
    this.sword.y = -2 - bob * 0.7;
    this.sword.x = 16 + (moving ? swing * 2 : 0);
    this.sword.setAngle(
      Phaser.Math.RadToDeg(moving ? swingOpp * (running ? 0.55 : 0.35) : 0) + 8,
    );

    // Soft idle breath when standing still
    if (!moving) {
      const breath = Math.sin(Date.now() / 450) * 0.6;
      this.body.y = -2 + breath;
      this.plume.y = -22 + breath;
      this.shield.y = 2 + breath * 0.4;
      this.sword.y = -2 + breath * 0.3;
    }
  }
}
