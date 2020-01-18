import { Bodies, Body, Constraint, Engine, Render, World, IBodyDefinition } from 'matter-js';
import { GameObjectType } from './utils';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const BOUNDARY_WIDTH = 40;

export class Physics {

  public engine: Engine;
  private render: Render;

  private bottomBoundary: Body;
  private topBoundary: Body;
  private rightBoundary: Body;
  private leftBoundary: Body;

  constructor(
    private element: HTMLElement,
    public width: number = WIDTH,
    public height: number = HEIGHT,
  ) {

    // create an engine
    this.engine = Engine.create();
    this.engine.world.gravity = { x: 0, y: 0, scale: 0 };

    // create a renderer
    this.render = Render.create({
      element: this.element,
      engine: this.engine,
      options: {
        width: this.width,
        height: this.height,
        wireframes: false,
      },
    });

    this.bottomBoundary = Bodies.rectangle(this.width / 2, this.height , this.width, BOUNDARY_WIDTH, { isStatic: true });
    this.topBoundary = Bodies.rectangle(this.width / 2, 0, this.width, BOUNDARY_WIDTH, { isStatic: true });
    this.rightBoundary = Bodies.rectangle(this.width, this.height / 2, BOUNDARY_WIDTH, this.height, { isStatic: true });
    this.leftBoundary = Bodies.rectangle(0, this.height / 2, BOUNDARY_WIDTH, this.height, { isStatic: true });

    World.add(this.engine.world, [this.bottomBoundary, this.topBoundary, this.leftBoundary, this.rightBoundary]);
  }

  addRandomSnake(): Body {
    const randomX = BOUNDARY_WIDTH * 2 + Math.random() * (this.width - BOUNDARY_WIDTH * 4);
    const randomY = BOUNDARY_WIDTH * 2 + Math.random() * (this.height - BOUNDARY_WIDTH * 4);
    const [snakeHead, snakeTail, snakeConstraints] = this.createSnakeBody(randomX, randomY, 10);
    World.add(this.engine.world, [snakeHead, ...snakeTail]);
    World.add(this.engine.world, snakeConstraints);
    return snakeHead;
  }

  createSnakeBody(x: number, y: number, length: number): any {
    const snakeHeadSize = 5;
    const snakeTailPieceSize = 4;
    const snakeColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    const snakeOptions: IBodyDefinition = {
      friction: 0,
      frictionAir: 0.1,
      label: String(GameObjectType.SNAKE),
      render: {
        fillStyle: snakeColor,
      },
    }
    const head = Bodies.circle(x, y, snakeHeadSize, { ...snakeOptions });
    const tailPieces = [];
    const constraints = [];
    for (let i = 1; i <= length; i++) {
      const isFirst = i === 1;
      const incX = i * snakeHeadSize * (isFirst ? 1.6 : 1.4);
      const incY = i * snakeHeadSize * (isFirst ? 1.6 : 1.4);
      const tailPiece = Bodies.circle(x + incX, y - incY, snakeTailPieceSize, {
        ...snakeOptions,
        label: 'snake-tail',
      });
      const constraint = Constraint.create({
        bodyA: isFirst ? head : tailPieces[i - 2],
        bodyB: tailPiece,
        render: {
          visible: false,
          lineWidth: 0,
          strokeStyle: 'line',
        },
      });
      tailPieces.push(tailPiece);
      constraints.push(constraint);
    }
    return [head, tailPieces, constraints];
  }

  addFood(x: number, y: number): Body {
    const food = this.createFood(x, y);
    World.add(this.engine.world, food);
    return food;
  }

  createFood(x: number, y: number, value: number = 500): Body {
    return Bodies.rectangle(x, y, 10, 10, {
      label: String(GameObjectType.FOOD),
    });
  }

  run() {
    // run the engine
    Engine.run(this.engine);

    // run the renderer
    Render.run(this.render);
  }

  stop() {
    Render.stop(this.render);
  }
}
