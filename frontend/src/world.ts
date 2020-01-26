import { Body, Engine, Events, IEventCollision, Vector, World as MWorld } from "matter-js";
import { GENERATION_DURATION_MS } from "./app";
import { Food } from "./food";
import { Physics } from "./physics";
import { Snake } from "./snake";
import { GameObject, GameObjectType } from "./utils";
import { Message, MessageListener, MessageType, Websocket, MessageId } from "./websocket";

const AI_CALL_FREQUENCY = 10;
export const GENERATION_SNAKE_COUNT = 20;

let worldCount = 0;

export class World implements MessageListener {

  id = worldCount++;
  running = false;

  private websocket: Websocket;
  private pendingWebSocketRequests: MessageId[] = [];
  private gameObjects: GameObject[] = [];
  private tickCount = 0;

  constructor(
    public generationCount: number = 0,
    private physics: Physics,
    private width: number,
    private height: number,
  ) {
    console.log('[WORLD]: building new world...');
    Events.on(this.physics.engine, 'beforeUpdate', this.update);
    Events.on(this.physics.engine, 'collisionStart', this.handleCollissions);

    // add snakes
    for (let i = 0; i < GENERATION_SNAKE_COUNT; i++) {
      const snakeBody = this.physics.addRandomSnake();
      const snake = new Snake(snakeBody.head.id, snakeBody.head, snakeBody.tail, snakeBody.constraints);
      this.gameObjects.push(snake);
    }

    this.websocket = Websocket.getInstance();
    console.log('[WORLD]: ... ready');
  }

  begin() {
    this.running = true;
    this.physics.run();
  }

  stop() {
    this.running = false;
    this.physics.stop();
  }

  destroy() {
    this.stop();
    this.physics.destroy();

    Events.off(this.physics.engine, 'beforeUpdate', this.update);
    Events.off(this.physics.engine, 'collisionStart', this.handleCollissions);

    this.gameObjects = [];
  }

  update = () => {
    if (!this.running) {
      console.log('[WORLD]: updating but not running (kind of a todo tbh)');
      return;
    }

    if (Math.random() > 0.99) {
      const x = this.sampleNormalDistribution() * this.width;
      const y = this.sampleNormalDistribution() * this.height;
      const foodBody = this.physics.addFood(x, y);
      const food = new Food(foodBody.id, foodBody, 500);
      this.gameObjects.push(food);
    }

    this.snakes.forEach(snake => {
      snake.update();
      if (!snake.dead && snake.energyLevel <= 0) {
        MWorld.remove(this.physics.engine.world, snake.body);
        snake.tail.forEach(tailPiece => {
          MWorld.remove(this.physics.engine.world, tailPiece);
        });
        snake.constraints.forEach(constraint => {
          MWorld.remove(this.physics.engine.world, constraint);
        });
        snake.die();
      }
    });

    // send "snakes" message?
    if (this.tickCount % AI_CALL_FREQUENCY === 0 && this.pendingWebSocketRequests.length === 0) {
      this.sendWebSocketMessage(MessageType.DATA, {
        matrix: this.toBitMatrix(),
        snakeIds: this.snakeIds,
      });
    }

    this.tickCount++;
  }

  handleCollissions = (event: IEventCollision<Engine>) => {
    const foodPairs = event.pairs.filter(pair => {
      if (pair.bodyA.label === 'snake-tail' || pair.bodyB.label === 'snake-tail') {
        return false;
      }
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

      food = this.nonSnakes.find(potentialFood => potentialFood.id === foodBody.id || potentialFood.id === foodBody.parent.id) as Food;
      snake = this.snakes.find(snake => snake.id === snakeBody.id) as Snake;

      if (snake && food) {
        snake.eat(food);
        food.body.parts.forEach((part: Body) => MWorld.remove(this.physics.engine.world, part));
      }
      MWorld.remove(this.physics.engine.world, foodBody);
    });
  }

  get snakes(): Snake[] {
    return this.gameObjects.filter(gO => gO.type === GameObjectType.SNAKE) as Snake[];
  }

  get aliveSnakes(): Snake[] {
    return this.snakes.filter(snake => snake.dead === false);
  }

  get nonSnakes(): GameObject[] {
    return this.gameObjects.filter(gO => gO.type !== GameObjectType.SNAKE);
  }

  get snakeIds(): number[] {
    return this.aliveSnakes.map(snake => snake.id);
  }

  onMessage(message: Message) {
    switch (message.type) {
      case MessageType.ERROR:
        console.log(`[WORLD]: <<< received error: "${message.data}"`);
        this.stop();
        break;
      case MessageType.DATA:
        if (!message.data.prediction) {
          break;
        }
        for (let destination in message.data.prediction) {
          let snake = this.snakes.find(gO => Number(gO.id) === Number(destination));
          if (snake && snake.updateVelocity) {
            const x = message.data.prediction[snake.id][0];
            const y = message.data.prediction[snake.id][1];
            snake.updateVelocity(Vector.create(x, y));
          }
        }
        break;
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

  private toBitMatrix(): number[][] {
    const result: number[][] = [];
    let imageData = this.physics.getImageData();
    for (let i = 0; i + 3 <= imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      result.push([r, g, b]);
    }
    return result;
  }
}
