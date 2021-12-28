const CANVAS_WIDTH = 900; // Width of canvas element
const CANVAS_HEIGHT = 700; // Height of canvas element
const FPS = 30; // Frames per second
const FRICTION = 0.4; // coefficient of friction (0 === no friction; 1 === a lot of friction)

const SHIP_SIZE = 30; // Ship's size
const SHIP_ROT_SPD = 360; // Degrees per socond
const SHIP_THRUST = 5; // Thrusting the ship in pixels per frame
const SHIP_EXP_DUR = 1; // Ship's duration of explosion in seconds
const SHIP_INV_DUR = 10; // Duration of ship's invisibility
const SHIP_BLINK_TIME = 0.3; // Time of every ship's blink
const SHIP_LIVES_NUM = 3; // Max count of lives

const ASTEROID_SIZE = 100; // Asteroids' size
const ASTEROID_SPD = 50; // Average speed of asteroids in pixels per second
const ASTEROID_JAG = 0.4; // Asteroids' jaggedness (0 - without juggedness, 1 - a lot of juggedness)
const ASTEROID_NUM = 3; // Initial count of asteroids
const ASTEROID_VERT = 12; // Number of asteroids' vertices

const LASER_NUM = 10; // Max number of drawed lasers in the scene
const LASER_SPD = 400; // Lasers' speed in pixels per second

const HIGHEST_SCORE = 100; // Score for the smallest asteroids
const MEDIUM_SCORE = 50; // Score for the medium-sized asteroids
const SMALL_SCORE = 20; // Score for the largest asteroids

const SHOW_CENTER_DOT = false; // For testing purposes, activate centre dot to the ship to check the ship's direction
const SHOW_COLLISION_MASK = false; // For testing purposes, activate collision mask for the ship and asteroids

const HIGH_SCORE_KEY = "HIGH SCORE"; // Key for localstorage

const SOUND_ON = true; // Turn on or turn off sounds effects
const MUSIC_ON = true; // Turn on or turn off the music

type Ship = {
  x: number;
  y: number;
  r: number; // Radius of the ship
  dir: number; // Current direction of the ship
  rot: number; // Change current direction of the ship when it's rotating
  isThrusting: boolean; // Flag using to draw or hide the thruster
  thrust: {
    // Relative coords, when the is thrusting these coords will be summed with current coords of the ship
    x: number;
    y: number;
  };
  explodeTime: number; // If explodeTime > 0 then the ship is exploding
  blinkNum: number; // Number of the ship's blinks
  blinkTime: number; // When blinkTime === 0 then number of blinkNum is reducing
  lasers: Laser[];
  canShoot: boolean; // Allow the ship to shoot
  isDead: boolean; // When is dead game is over
};

type Asteroid = {
  x: number;
  y: number;
  dir: number; // Random direction
  r: number; // radius
  xv: number; // X - velocity (Random acceleration of asteroids)
  yv: number; // Y - velocity (Random acceleration of asteroids)
  vert: number; // Average number of vertices
  offsets: number[]; // Array of numbers which considered as coefficients of juggedness
};

type Laser = {
  x: number;
  y: number;
  xv: number; // X - velocity (Acceleration of lasers)
  yv: number; // Y - velocity (Acceleration of lasers)
};

class Sound {
  // Array of audio elements
  private streams: HTMLAudioElement[] = [];
  // Current index of the array of audio elements
  private currentStream = 0;

  constructor(
    src: string,
    volume = 0.5,
    private maxStreams = 1 // Max count of the array of audio elements
  ) {
    // Fill the array and configure the volume
    for (let i = 0; i < this.maxStreams; i++) {
      this.streams.push(new Audio(src));
      this.streams[i].volume = volume;
    }
  }

  play() {
    if (SOUND_ON) {
      // After every call of the function change current index of stream.
      // First the index will be incremented once the value will equal the last index of the streams it's value will start with from 0
      this.currentStream = (this.currentStream + 1) % this.maxStreams;
      this.streams[this.currentStream].play();
    }
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

    // Set up the main game status props
    let ship: Ship;
    let asteroids: Asteroid[] = [];
    let lives: number;
    let score: number;
    let highScore: number;
    let level: number;
    // Message which appears when new level is started
    let message: string;
    // Opacity of a text
    let textAlpha: number;

    // set up sound effects
    let fxLaser = new Sound("sounds/laser.m4a", 0.5, 6);
    let fxExplosion = new Sound("sounds/explode.m4a");
    let fxThrust = new Sound("sounds/thrust.m4a");
    let fxHit = new Sound("sounds/hit.m4a", 0.5, 6);

    // Reset the game status and start a level
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
        x: CANVAS_WIDTH / 2, // Create the ship on the center of the scene
        y: CANVAS_HEIGHT / 2, // Create the ship on the center of the scene
        r: SHIP_SIZE / 2,
        dir: (90 / 180) * Math.PI, // Converted degrees to radians (By default 90 degrees)
        rot: 0, // When rot === 0 the ship will not rotate
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

      // nose of the ship
      ctx.moveTo(
        x + (4 / 3) * ship.r * Math.cos(dir),
        y - (4 / 3) * ship.r * Math.sin(dir)
      );
      // left side of the ship
      ctx.lineTo(
        x - ship.r * ((2 / 3) * Math.cos(dir) - Math.sin(dir)),
        y + ship.r * ((2 / 3) * Math.sin(dir) + Math.cos(dir))
      );
      // right side of the ship
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
        // When the asteroids' coords very near the ship's coords, choose another coords
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

    // The function determines distance between two points
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

      // Fill the array of coefficients of juggedness
      for (let i = 0; i < asteroid.vert; i++) {
        asteroid.offsets.push(
          // For correct appearing the number should be in range of 0 and 2
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

        // Draw the collision mask
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

      // If targeted asteroid is huge then create 2 medium-sized asteroids
      if (target.r === Math.ceil(ASTEROID_SIZE / 2)) {
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 4))
        );
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 4))
        );

        // Add a small amount of score because the asteroid is huge
        score += SMALL_SCORE;
      }
      // If targeted asteroid is medium-sized then create 2 small asteroids
      else if (target.r === Math.ceil(ASTEROID_SIZE / 4)) {
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 8))
        );
        asteroids.push(
          newAsteroid(target.x, target.y, Math.ceil(ASTEROID_SIZE / 8))
        );

        // Add a medium amount of score because the asteroid is medium-sized
        score += MEDIUM_SCORE;
      }
      // If targeted asteroid is small then add the largest amount of score
      else {
        score += HIGHEST_SCORE;
      }

      // If current score in higher than high score then assign the new value to high score
      if (score > highScore) {
        highScore = score;
        // Save into the API BOM localstorage
        localStorage.setItem(HIGH_SCORE_KEY, `${highScore}`);
      }

      // Remove the targeted asteroid
      asteroids.splice(index, 1);

      // If the player destroyed all the asteroids then start a new level
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

    // Handle keyboard listeners
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

    // The main function which are calling in the game loop
    function draw() {
      // When the number is even then show the ship, thruster
      const isShowed = ship.blinkNum % 2 === 0;
      // When the var is largest than 0 it means the ship is exploding
      const isExploded = ship.explodeTime > 0;

      // draw the scene
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Handle the ship's blinks
      if (ship.blinkNum > 0) {
        ship.blinkTime--;

        if (ship.blinkTime === 0) {
          ship.blinkTime = Math.ceil(SHIP_BLINK_TIME * FPS);
          ship.blinkNum--;
        }
      }

      // Draw the thruster
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

      // Draw the ship or the ship's explosion
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
        // Draw the center dot
        if (SHOW_CENTER_DOT) {
          ctx.fillStyle = "red";
          ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
        }

        // Draw the collision mask
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

    // Set up the game loop which will called 30 times per second
    setInterval(() => {
      draw();
    }, 1000 / FPS);
  }
});
