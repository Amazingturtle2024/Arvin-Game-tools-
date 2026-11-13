import Phaser from "phaser";
import { loadMoveSpeed, runSpeedFor, walkSpeedFor } from "../settings";

/**
 * Your knight picture as torso + animated legs + swinging sword (from your art).
 */
export class Player {
  /** Physics body (invisible hitch for collisions / camera). */
  readonly sprite: Phaser.Physics.Arcade.Sprite;

  private readonly visual: Phaser.GameObjects.Container;
  private readonly leftLeg: Phaser.GameObjects.Image;
  private readonly rightLeg: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
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
  private facing = 1; // 1 rightward visual (flipped), -1 = art native (faces left)

  constructor(scene: Phaser.Scene, x: number, y: number, moveSpeedLevel = loadMoveSpeed()) {
    this.moveSpeedLevel = moveSpeedLevel;

    this.sprite = scene.physics.add.sprite(x, y, "playerHit");
    this.sprite.setVisible(false);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setSize(22, 20);
    this.sprite.setOffset(5, 6);
    this.sprite.setDepth(10);
    this.sprite.setMaxVelocity(320, 320);

    this.shadow = scene.add.ellipse(0, 20, 30, 10, 0x000000, 0.25);

    // Art faces left; assembled facing preserved via container flip
    this.torso = scene.add.image(0, -10, "knightTorso").setOrigin(0.5, 0.75);
    this.torso.setDisplaySize(54, 46);

    // Legs render IN FRONT of torso so the stride is visible
    this.leftLeg = scene.add.image(-7, 8, "knightLeg").setOrigin(0.5, 0);
    this.rightLeg = scene.add.image(7, 8, "knightLeg").setOrigin(0.5, 0);
    this.leftLeg.setDisplaySize(14, 20);
    this.rightLeg.setDisplaySize(14, 20);

    // Sword pivot at the hilt — large swing, drawn on top
    this.sword = scene.add.image(16, -4, "knightSword").setOrigin(0.35, 0.88);
    this.sword.setDisplaySize(26, 46);

    this.visual = scene.add.container(x, y, [
      this.shadow,
      this.torso,
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
      this.walkPhase += delta * (running ? 0.038 : 0.028);
    } else {
      this.walkPhase *= 0.82;
    }

    this.sprite.setVelocity(vx, vy);
    this.visual.setPosition(this.sprite.x, this.sprite.y);

    // Art faces left natively. Flip container when moving right.
    if (vx > 0) this.facing = 1;
    else if (vx < 0) this.facing = -1;
    this.visual.setScale(this.facing, 1);

    this.animate(moving, running);
  }

  private animate(moving: boolean, running: boolean): void {
    const swing = moving ? Math.sin(this.walkPhase) : 0;
    const swingOpp = moving ? Math.sin(this.walkPhase + Math.PI) : 0;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * (running ? 2.8 : 1.8) : 0;

    // --- Legs (big alternating stride) ---
    const legDeg = running ? 48 : 36;
    this.leftLeg.setAngle(swing * legDeg);
    this.rightLeg.setAngle(swingOpp * legDeg);
    this.leftLeg.y = 8 + (moving ? swingOpp * 3 : 0);
    this.rightLeg.y = 8 + (moving ? swing * 3 : 0);
    this.leftLeg.x = -7 + (moving ? swing * 2.5 : 0);
    this.rightLeg.x = 7 + (moving ? swingOpp * 2.5 : 0);

    // --- Torso bob (your knight art) ---
    this.torso.y = -10 - bob;
    this.torso.setAngle(moving ? swing * 4 : 0);

    // --- Sword swing (your sword art) ---
    const swordDeg = running ? 55 : 40;
    this.sword.y = -4 - bob * 0.8;
    this.sword.x = 16 + (moving ? swing * 3 : 0);
    this.sword.setAngle((moving ? swingOpp * swordDeg : 0) + 8);

    if (!moving) {
      const breath = Math.sin(Date.now() / 500) * 0.5;
      this.torso.y = -10 + breath;
      this.sword.y = -4 + breath * 0.4;
      this.leftLeg.setAngle(-4);
      this.rightLeg.setAngle(4);
      this.leftLeg.setPosition(-7, 8);
      this.rightLeg.setPosition(7, 8);
      this.sword.setAngle(8);
    }
  }
}
