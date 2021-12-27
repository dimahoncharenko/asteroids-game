const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;
const FPS = 30;
const FRICTION = 0.4;

const SHIP_SIZE = 30;
const SHIP_ROT_SPD = 360; // Degrees per socond
const SHIP_THRUST = 5;
const SHIP_EXP_DUR = 1; // Ship's duration of explosion in seconds
const SHIP_INV_DUR = 10; // Duration of ship's invisibility
const SHIP_BLINK_TIME = 0.3; // Time of every ship's blink
const SHIP_LIVES_NUM = 3;

const ASTEROID_SIZE = 100;
const ASTEROID_SPD = 50;
const ASTEROID_JAG = 0.4; // Asteroids' jaggedness (0 - without juggedness, 1 - a lot of juggedness)
const ASTEROID_NUM = 3;
const ASTEROID_VERT = 12;

const LASER_NUM = 10;
const LASER_SPD = 400;

const HIGHEST_SCORE = 100; // Score for the smallest asteroids
const MEDIUM_SCORE = 50; // Score for the medium-sized asteroids
const SMALL_SCORE = 20; // Score for the largest asteroids

const SHOW_CENTER_DOT = false;
const SHOW_COLLISION_MASK = false;

const HIGH_SCORE_KEY = "HIGH SCORE";

type Ship = {
  x: number;
  y: number;
  r: number;
  dir: number;
  rot: number;
  isThrusting: boolean;
  thrust: {
    x: number;
    y: number;
  };
  explodeTime: number;
  blinkNum: number;
  blinkTime: number;
  lasers: Laser[];
  canShoot: boolean;
  isDead: boolean;
};

type Asteroid = {
  x: number;
  y: number;
  dir: number;
  r: number;
  xv: number;
  yv: number;
  vert: number;
  offsets: number[];
};

type Laser = {
  x: number;
  y: number;
  xv: number;
  yv: number;
};

class Sound {
  private streams: HTMLAudioElement[] = [];
  private currentStream = 0;

  constructor(src: string, volume = 0.5, private maxStreams = 1) {
    for (let i = 0; i < this.maxStreams; i++) {
      this.streams.push(new Audio(src));
      this.streams[i].volume = volume;
    }
  }

  play() {
    this.currentStream = (this.currentStream + 1) % this.maxStreams;
    this.streams[this.currentStream].play();
  }

  pause() {
    this.streams[this.currentStream].pause();
    this.streams[this.currentStream].currentTime = 0;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.querySelector<HTMLCanvasElement>("#game");

  if (canvas) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    let ship: Ship;
    let asteroids: Asteroid[] = [];
    let lives: number;
    let score: number;
    let highScore: number;
    let level: number;
    let message: string;
    let textAlpha: number;

    // set up sound effects
    let fxLaser = new Sound("sounds/laser.m4a", 0.5, 6);
    let fxExplosion = new Sound("sounds/explode.m4a");
    let fxThrust = new Sound("sounds/thrust.m4a");
    let fxHit = new Sound("sounds/hit.m4a", 0.5, 6);

    newGame();

    function newGame() {
      level = 1;
      lives = SHIP_LIVES_NUM;
      score = 0;
      highScore = +(localStorage.getItem(HIGH_SCORE_KEY) || 0);
      ship = newShip();
      newLevel();
    }

    function newLevel() {
      message = `Level: ${level}`;
      textAlpha = 1.0;
      createAsteroidBelt();
    }

    function gameOver() {
      ship.isDead = true;
    }

    function newShip(): Ship {
      return {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        r: SHIP_SIZE / 2,
        dir: (90 / 180) * Math.PI,
        rot: 0,
        isThrusting: false,
        thrust: {
          x: 0,
          y: 0,
        },
        explodeTime: 0,
        lasers: [],
        blinkNum: SHIP_INV_DUR,
        blinkTime: Math.ceil(SHIP_BLINK_TIME * FPS),
        canShoot: true,
        isDead: false,
      };
    }

    function drawShip(x: number, y: number, dir: number, color = "white") {
      ctx.strokeStyle = color;
      ctx.lineWidth = SHIP_SIZE / 20;
      ctx.beginPath();

      ctx.moveTo(
        x + (4 / 3) * ship.r * Math.cos(dir),
        y - (4 / 3) * ship.r * Math.sin(dir)
      );
      ctx.lineTo(
        x - ship.r * ((2 / 3) * Math.cos(dir) - Math.sin(dir)),
        y + ship.r * ((2 / 3) * Math.sin(dir) + Math.cos(dir))
      );
      ctx.lineTo(
        x - ship.r * ((2 / 3) * Math.cos(dir) + Math.sin(dir)),
        y + ship.r * ((2 / 3) * Math.sin(dir) - Math.cos(dir))
      );

      ctx.closePath();
      ctx.stroke();

      // handle edge of the screen
      if (ship.x < -ship.r) {
        ship.x = CANVAS_WIDTH + ship.r;
      } else if (ship.x > CANVAS_WIDTH + ship.r) {
        ship.x = -ship.r;
      } else if (ship.y < -ship.r) {
        ship.y = CANVAS_HEIGHT + ship.r;
      } else if (ship.y > CANVAS_HEIGHT + ship.r) {
        ship.y = -ship.r;
      }
    }

    function explodeShip() {
      fxExplosion.play();
      ship.explodeTime = SHIP_EXP_DUR * FPS;
    }

    function createAsteroidBelt() {
      let x: number;
      let y: number;
      for (let i = 0; i < ASTEROID_NUM + level; i++) {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
        while (
          distanceBetweenPoints(ship.x, ship.y, x, y) <
          ship.r + ASTEROID_SIZE * 2
        ) {
          x = Math.random() * CANVAS_WIDTH;
          y = Math.random() * CANVAS_HEIGHT;
        }
        asteroids.push(newAsteroid(x, y));
      }
    }

    function distanceBetweenPoints(
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function newAsteroid(
      x: number,
      y: number,
      r = Math.ceil(ASTEROID_SIZE / 2)
    ) {
      let asteroid: Asteroid = {
        x,
        y,
        dir: Math.random() * (Math.PI * 2),
        r,
        xv:
          Math.random() *
          ASTEROID_SPD *
          level *
          Math.cos(
            Math.random() * (Math.PI * 2) + (Math.random() > 0.5 ? 1 : -1)
          ),
        yv:
          Math.random() *
          ASTEROID_SPD *
          level *
          Math.sin(
            Math.random() * (Math.PI * 2) + (Math.random() > 0.5 ? 1 : -1)
          ),
        vert: Math.random() * ASTEROID_VERT + ASTEROID_VERT / 2,
        offsets: [],
      };

      for (let i = 0; i < asteroid.vert; i++) {
        asteroid.offsets.push(
          Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG
        );
      }

      return asteroid;
    }

    function drawAsteroids() {
      for (let i = 0; i < asteroids.length; i++) {
        ctx.strokeStyle = "slategray";
        ctx.lineWidth = SHIP_SIZE / 20;
        ctx.beginPath();

        ctx.moveTo(
          asteroids[i].x +
            asteroids[i].offsets[0] *
              asteroids[i].r *
              Math.cos(asteroids[i].dir),
          asteroids[i].y +
            asteroids[i].offsets[0] *
              asteroids[i].r *
              Math.sin(asteroids[i].dir)
        );

        for (let j = 1; j < asteroids[i].vert; j++) {
          ctx.lineTo(
            asteroids[i].x +
              asteroids[i].offsets[j] *
                asteroids[i].r *
                Math.cos(
                  asteroids[i].dir + (j * Math.PI * 2) / asteroids[i].vert
                ),
            asteroids[i].y +
              asteroids[i].offsets[j] *
                asteroids[i].r *
                Math.sin(
                  asteroids[i].dir + (j * Math.PI * 2) / asteroids[i].vert
                )
          );
        }

        ctx.closePath();
        ctx.stroke();

        if (SHOW_COLLISION_MASK) {
          ctx.strokeStyle = "lime";
          ctx.lineWidth = SHIP_SIZE / 20;
          ctx.beginPath();
          ctx.arc(
            asteroids[i].x,
            asteroids[i].y,
            asteroids[i].r,
            Math.PI * 2,
            0
          );
          ctx.stroke();
        }
      }
    }

    function destroyAsteroid(index: number) {
      let target = asteroids[index];

      fxHit.play();

      if (target.r === Math.ceil(ASTEROID_SIZE / 2)) {
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 4))
        );
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 4))
        );

        score += SMALL_SCORE;
      } else if (target.r === Math.ceil(ASTEROID_SIZE / 4)) {
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 8))
        );
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 8))
        );

        score += MEDIUM_SCORE;
      } else {
        score += HIGHEST_SCORE;
      }

      if (score > highScore) {
        highScore = score;
        localStorage.setItem(HIGH_SCORE_KEY, `${highScore}`);
      }

      asteroids.splice(index, 1);
      if (asteroids.length === 0) {
        level++;
        newLevel();
      }
    }

    function shootLaser() {
      if (!ship.canShoot || ship.lasers.length >= LASER_NUM) return;

      fxLaser.play();

      ship.lasers.push({
        x: ship.x + (4 / 3) * ship.r * Math.cos(ship.dir),
        y: ship.y - (4 / 3) * ship.r * Math.sin(ship.dir),
        xv: (LASER_SPD / FPS) * Math.cos(ship.dir),
        yv: -(LASER_SPD / FPS) * Math.sin(ship.dir),
      });

      ship.canShoot = false;
    }

    document.addEventListener("keydown", ({ key }) => {
      if (ship.isDead) return;
      switch (key) {
        case "ArrowLeft":
          ship.rot = ((SHIP_ROT_SPD / 180) * Math.PI) / FPS;
          break;
        case "ArrowRight":
          ship.rot = -((SHIP_ROT_SPD / 180) * Math.PI) / FPS;
          break;
        case "ArrowUp":
          ship.isThrusting = true;
          break;
        case " ":
          shootLaser();
          break;
      }
    });

    document.addEventListener("keyup", ({ key }) => {
      if (ship.isDead) return;

      switch (key) {
        case "ArrowLeft":
          ship.rot = 0;
          break;
        case "ArrowRight":
          ship.rot = 0;
          break;
        case "ArrowUp":
          ship.isThrusting = false;
          break;
        case " ":
          ship.canShoot = true;
          break;
      }
    });

    function draw() {
      const isShowed = ship.blinkNum % 2 === 0;
      const isExploded = ship.explodeTime > 0;

      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (ship.blinkNum > 0) {
        ship.blinkTime--;

        if (ship.blinkTime === 0) {
          ship.blinkTime = Math.ceil(SHIP_BLINK_TIME * FPS);
          ship.blinkNum--;
        }
      }

      if (ship.isThrusting && !ship.isDead) {
        if (!isExploded) {
          fxThrust.play();

          ship.thrust.x += (SHIP_THRUST * Math.cos(ship.dir)) / FPS;
          ship.thrust.y += -(SHIP_THRUST * Math.sin(ship.dir)) / FPS;

          if (isShowed) {
            ctx.fillStyle = "yellow";
            ctx.strokeStyle = "orangered";
            ctx.lineWidth = SHIP_SIZE / 4;
            ctx.beginPath();

            ctx.moveTo(
              ship.x - ship.r * (Math.cos(ship.dir) + 0.5 * Math.sin(ship.dir)),
              ship.y + ship.r * (Math.sin(ship.dir) - 0.5 * Math.cos(ship.dir))
            );
            ctx.lineTo(
              ship.x - ship.r * ((6 / 3) * Math.cos(ship.dir)),
              ship.y + ship.r * ((6 / 3) * Math.sin(ship.dir))
            );
            ctx.lineTo(
              ship.x - ship.r * (Math.cos(ship.dir) - 0.5 * Math.sin(ship.dir)),
              ship.y + ship.r * (Math.sin(ship.dir) + 0.5 * Math.cos(ship.dir))
            );

            ctx.closePath();
            ctx.stroke();
            ctx.fill();
          }
        }
      } else {
        fxThrust.pause();
        ship.thrust.x -= (FRICTION * ship.thrust.x) / FPS;
        ship.thrust.y -= (FRICTION * ship.thrust.y) / FPS;
      }

      if (!isExploded) {
        if (isShowed && !ship.isDead) {
          drawShip(ship.x, ship.y, ship.dir);
        }
      } else {
        ctx.fillStyle = "hardred";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.25, Math.PI * 2, 0);
        ctx.fill();
        ctx.fillStyle = "orangered";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r, Math.PI * 2, 0);
        ctx.fill();
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.75, Math.PI * 2, 0);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.5, Math.PI * 2, 0);
        ctx.fill();
      }

      if (!isExploded) {
        if (SHOW_CENTER_DOT) {
          ctx.fillStyle = "red";
          ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
        }
        if (SHOW_COLLISION_MASK) {
          ctx.strokeStyle = "lime";
          ctx.lineWidth = SHIP_SIZE / 20;
          ctx.beginPath();
          ctx.arc(ship.x, ship.y, ship.r, Math.PI * 2, 0);
          ctx.stroke();
        }

        // rotate the ship
        ship.dir += ship.rot;

        // move the ship
        ship.x += ship.thrust.x;
        ship.y += ship.thrust.y;

        if (ship.blinkNum === 0 && !ship.isDead) {
          // Check the collision between asteroids and the ship
          for (let i = 0; i < asteroids.length; i++) {
            if (
              distanceBetweenPoints(
                ship.x,
                ship.y,
                asteroids[i].x,
                asteroids[i].y
              ) <
              asteroids[i].r + ship.r
            ) {
              explodeShip();
              destroyAsteroid(i);
              break;
            }
          }
        }
      } else {
        ship.explodeTime--;

        if (ship.explodeTime === 0) {
          lives--;

          if (lives > 0) {
            ship = newShip();
          } else {
            gameOver();
          }
        }
      }

      // draw the asteroids
      drawAsteroids();

      // move the asteroids and handle edge of the scene
      for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].x += asteroids[i].xv / FPS;
        asteroids[i].y += asteroids[i].yv / FPS;

        if (asteroids[i].x < -asteroids[i].r) {
          asteroids[i].x = CANVAS_WIDTH + asteroids[i].r;
        } else if (asteroids[i].x > CANVAS_WIDTH + asteroids[i].r) {
          asteroids[i].x = -asteroids[i].r;
        } else if (asteroids[i].y < -asteroids[i].r) {
          asteroids[i].y = CANVAS_HEIGHT + asteroids[i].r;
        } else if (asteroids[i].y > CANVAS_HEIGHT + asteroids[i].r) {
          asteroids[i].y = -asteroids[i].r;
        }
      }

      // draw the lasers and move them
      for (let i = ship.lasers.length - 1; i >= 0; i--) {
        ctx.fillStyle = "salmon";
        ctx.beginPath();
        ctx.arc(
          ship.lasers[i].x,
          ship.lasers[i].y,
          SHIP_SIZE / 20,
          Math.PI * 2,
          0
        );
        ctx.fill();
        ship.lasers[i].x += ship.lasers[i].xv;
        ship.lasers[i].y += ship.lasers[i].yv;

        // handle edge of the screen
        if (
          ship.lasers[i].x < 0 ||
          ship.lasers[i].x > CANVAS_WIDTH ||
          ship.lasers[i].y < 0 ||
          ship.lasers[i].y > CANVAS_HEIGHT
        ) {
          ship.lasers.splice(i, 1);
        }
      }

      // Check collision between asteroids and lasers
      let laser: Laser;
      let asteroid: Asteroid;
      for (let i = ship.lasers.length - 1; i >= 0; i--) {
        laser = ship.lasers[i];
        for (let j = 0; j < asteroids.length; j++) {
          asteroid = asteroids[j];

          if (
            distanceBetweenPoints(laser.x, laser.y, asteroid.x, asteroid.y) <
            asteroid.r
          ) {
            ship.lasers.splice(i, 1);
            destroyAsteroid(j);
            break;
          }
        }
      }

      // draw a text
      if (textAlpha >= 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
        ctx.font = "bolder 40px Arial";
        ctx.textAlign = "center";
        ctx.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.75);
        textAlpha -= textAlpha / FPS;
      }

      // draw lives
      for (let i = 1; i <= lives; i++) {
        drawShip(SHIP_SIZE * i, SHIP_SIZE, (90 / 180) * Math.PI);
      }

      // draw the score
      ctx.fillStyle = "white";
      ctx.font = "bolder 3rem Arial";
      ctx.textAlign = "right";
      ctx.fillText(`${score}`, CANVAS_WIDTH - ship.r, SHIP_SIZE + ship.r);

      // draw the high score
      ctx.fillStyle = "white";
      ctx.font = "bolder 2rem Arial";
      ctx.textAlign = "center";
      ctx.fillText(`TOP ${highScore}`, CANVAS_WIDTH / 2, SHIP_SIZE + ship.r);
    }

    setInterval(() => {
      draw();
    }, 1000 / FPS);
  }
});
