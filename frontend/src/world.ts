import { GENERATION_DURATION_MS } from "./app";
import { Physics } from "./physics";
import { Snake } from "./snake";
import { GameObject, GameObjectType } from "./utils";
import { Message, MessageListener, MessageType, Websocket } from "./websocket";
import { Events, Body, World as MWorld, Vector } from "matter-js";
import { Food } from "./food";

const AI_CALL_FREQUENCY = 10;
const GENERATION_SNAKE_COUNT = 20;

let foodCount = 0;
let worldCount = 0;

export class World implements MessageListener {

  physics: Physics;

  id = worldCount++;
  startTime: number = 0;

  private websocket: Websocket;
  private pendingWebSocketRequests: number[] = [];
  private gameObjects: GameObject[] = [];
  private tickCount = 0;
  private broken = false;
  private generationEndsTimeout = -1;

  champions: Snake[] = [];

  constructor(
    private onNewEpoch: Function,
    public generationCount: number = 0,
    private width: number,
    private height: number,
  ) {
    const mainElement = document.querySelector('#main') as HTMLElement;
    this.physics = new Physics(mainElement, this.width, this.height);

    Events.on(this.physics.engine, 'beforeUpdate', () => this.update());
    Events.on(this.physics.engine, 'collisionStart', (event) => {
      const foodPairs = event.pairs.filter(pair => {
        const aIsSnakeBIsFood = pair.bodyA.label === String(GameObjectType.SNAKE) && pair.bodyB.label === String(GameObjectType.FOOD);
        const bIsSnakeAIsFood = pair.bodyA.label === String(GameObjectType.FOOD) && pair.bodyB.label === String(GameObjectType.SNAKE);
        return aIsSnakeBIsFood || bIsSnakeAIsFood;
      });

      foodPairs.forEach(pair => {
        let snake: Snake, snakeBody: Body, food: Food, foodBody: Body;

        if (pair.bodyA.label === String(GameObjectType.FOOD)) {
          foodBody = pair.bodyA;
          snakeBody = pair.bodyB;
        } else {
          foodBody = pair.bodyB;
          snakeBody = pair.bodyA;
        }

        food = this.nonSnakes.find(potentialFood => potentialFood.id === foodBody.id) as Food;
        snake = this.snakes.find(snake => snake.id === snakeBody.id) as Snake;
        if (snake && food) {
          snake.eat(food);
        }
        MWorld.remove(this.physics.engine.world, foodBody);
      });
    });

    // add snakes
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      const snakeBody = this.physics.addRandomSnake();
      const snake = new Snake(snakeBody.id, snakeBody);
      this.gameObjects.push(snake);
    }

    this.websocket = Websocket.getInstance();
    this.websocket.registerListener(this);

    this.sendWebSocketMessage(MessageType.GENERATION, { snakeIds: this.snakes.map(snake => snake.id) });
  }

  begin() {
    this.startTime = Date.now();
    this.physics.run();
    this.sendWebSocketMessage(MessageType.DATA, this.currentSnakesData());
  }

  stop(broken = false) {
    if (broken) {
      this.broken = true;
    }
    this.physics.stop();
  }

  destroy() {
    this.stop();
    this.gameObjects = [];
    this.websocket.removeListener(this);
  }

  update() {
    if (Date.now() - this.startTime > GENERATION_DURATION_MS) {
      console.log('[WORLD]: started new generation because time ran out');
      return this.onNewEpoch();
    }

    if (this.snakes.length === 0) {
      console.log('[WORLD]: starting new generation because there are no snakes left');
      return this.onNewEpoch();
    }

    if (Math.random() > 0.99) {
      const x = this.sampleNormalDistribution() * this.width;
      const y = this.sampleNormalDistribution() * this.height;
      const foodBody = this.physics.addFood(x, y);
      const food = new Food(foodBody.id, foodBody);
      this.gameObjects.push(food);
    }

    // send "snakes" message?
    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.pendingWebSocketRequests.length === 0) {
      if (this.snakes.length > 0) {
        this.sendWebSocketMessage(MessageType.DATA, this.currentSnakesData());
      }
    }

    this.tickCount++;
  }

  get snakes(): Snake[] {
    return this.gameObjects.filter(gO => gO.type === GameObjectType.SNAKE) as Snake[];
  }

  get nonSnakes(): GameObject[] {
    return this.gameObjects.filter(gO => gO.type !== GameObjectType.SNAKE);
  }

  onMessage(message: Message) {
    switch (message.type) {
      case MessageType.ACK:
        if (!this.physics.engine.enabled) {
          this.begin();
        }
        break;
      case MessageType.ERROR:
        console.log(`[WORLD]: <<< received error: "${message.data}"`);
        this.stop();
        break;
      case MessageType.DATA:
        for (let destination in message.data) {
          let destinationGameObject = this.gameObjects.find(gO => Number(gO.id) === Number(destination));
          if (destinationGameObject && destinationGameObject.updateVelocity) {
            const x = message.data[destinationGameObject.id][0];
            const y = message.data[destinationGameObject.id][1];
            destinationGameObject.updateVelocity(Vector.create(x, y));
          }
        }
        break
      default:
        console.log(`[WORLD]: I don't know how to handle messages of type ${message.type}. Message was: ${message.data}`);
    }

    this.pendingWebSocketRequests = this.pendingWebSocketRequests.filter(reqId => reqId !== message.messageId);
  }

  private sampleNormalDistribution(): number {
    const u = Math.random(), v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) return this.sampleNormalDistribution(); // resample between 0 and 1
    return num;
  }

  private sendWebSocketMessage(type: MessageType, data: any): void {
    this.pendingWebSocketRequests.push(this.websocket.send({ type, data }));
  }

  private currentSnakesData(): any {
    return this.snakes.reduce((acc, snake) => ({
      ...acc,
      [snake.id]: {
        energyLevel: snake.energyLevel,
        energyIntake: snake.energyIntake,
        matrix: this.toBitMatrix(snake),
        velocityX: snake.body.velocity.x,
        velocityY: snake.body.velocity.y,
      }
    }), {});
  }

  private toBitMatrix(gamObject: GameObject): number[] {
    // const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const result: number[] = [];
    // for (let i = 0; i + 3 <= imageData.data.length; i += 4) {
    //   const x = (i / 4) % this.width;
    //   const y = Math.floor((i / 4) / this.width);
    //   const r = imageData.data[i];
    //   const g = imageData.data[i + 1];
    //   const b = imageData.data[i + 2];
    //   const a = imageData.data[i + 3];
    //   if (r > g && r > b) {
    //     result.push(GameObjectType.FOOD);
    //   } else if (g > r && g > b) {
    //     if (gamObject.collidesWith({ x, y })) {
    //       result.push(GameObjectType.ME);
    //     } else {
    //       result.push(gamObject.type);
    //     }
    //   } else {
    //     result.push(GameObjectType.NONE);
    //   }
    // }
    return result;
  }

}
