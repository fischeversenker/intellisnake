import { Body, Engine, Events, IEventCollision, IPair, World as MWorld } from "matter-js";
import { Config } from "./config";
import { Food } from "./food";
import { Physics } from "./physics";
import { Snake } from "./snake";
import { GameObject, GameObjectType } from "./utils";
import { MessageId, MessageType, Websocket } from "./websocket";

let worldCount = 0;

export class World {

  id = worldCount++;
  running = false;

  private websocket: Websocket;
  private pendingWebSocketRequests: MessageId[] = [];
  private gameObjects: GameObject[] = [];

  constructor(
    private physics: Physics,
    private width: number,
    private height: number,
  ) {
    console.log('[WORLD]: building new world...');
    Events.on(this.physics.engine, 'beforeUpdate', this.update);
    Events.on(this.physics.engine, 'collisionStart', this.handleCollissions);

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

  reset() {
    this.nonSnakes.forEach(nonSnake => {
      MWorld.remove(this.physics.world, nonSnake.body);
    });
    this.gameObjects = this.gameObjects.filter(gameObject => gameObject.type === GameObjectType.SNAKE);
    this.pendingWebSocketRequests = [];
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
      const foodBody = this.physics.getFood(x, y);
      MWorld.add(this.physics.world, foodBody);
      const food = new Food(foodBody.id, foodBody, 500);
      this.gameObjects.push(food);
    }

    this.gameObjects.forEach(gameObject => {
      if (gameObject instanceof Snake) {
        gameObject.update();
      }
      if (gameObject.dead) {
        MWorld.remove(this.physics.world, gameObject.body);
      }
    });
    this.gameObjects = [
      ...this.snakes,
      ...this.nonSnakes.filter(food => !food.dead),
    ];

    // send "snakes" message?
    if (this.pendingWebSocketRequests.length === 0) {
      this.sendWebSocketMessage(MessageType.DATA, {
        matrix: this.toBitMatrix(),
        snakeIds: this.snakeIds,
      });
    }
  }

  handleCollissions = (event: IEventCollision<Engine>) => {
    const foodPairs = event.pairs.filter((pair: IPair) => {
      if (pair.bodyA.label === String(GameObjectType.SNAKE_TAIL) || pair.bodyB.label === String(GameObjectType.SNAKE_TAIL)) {
        return false;
      }
      const aIsSnakeBIsFood = pair.bodyA.label === String(GameObjectType.SNAKE) && pair.bodyB.label === String(GameObjectType.FOOD);
      const bIsSnakeAIsFood = pair.bodyA.label === String(GameObjectType.FOOD) && pair.bodyB.label === String(GameObjectType.SNAKE);
      return aIsSnakeBIsFood || bIsSnakeAIsFood;
    });

    foodPairs.forEach((pair: IPair) => {
      let snake: Snake, snakeBody: Body, food: Food, foodBody: Body;

      if (pair.bodyA.label === String(GameObjectType.FOOD)) {
        foodBody = pair.bodyA;
        snakeBody = pair.bodyB;
      } else {
        foodBody = pair.bodyB;
        snakeBody = pair.bodyA;
      }

      food = this.nonSnakes.find(potentialFood => potentialFood.id === foodBody.id || potentialFood.id === foodBody.parent.id) as Food;
      snake = this.snakes.find(snake => snake.containsBody(snakeBody)) as Snake;

      if (snake && food) {
        snake.eat(food);
      }
      MWorld.remove(this.physics.world, foodBody);
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

  ackMessage(messageId: number) {
    this.pendingWebSocketRequests = this.pendingWebSocketRequests.filter(reqId => reqId !== messageId);
  }

  addGameObject(gameObject: GameObject) {
    this.gameObjects.push(gameObject);
  }

  getGenerationData(): any {
    return this.snakes.map(snake => ({
      id: snake.id,
      energyIntake: snake.energyIntake,
    }));
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

  private toBitMatrix(): number[] {
    const result: number[] = [];
    let imageData = this.physics.getImageData();
    for (let i = 0; i + 3 <= imageData.data.length; i += 4) {
      const r = imageData.data[i];
      result.push(r);
    }
    return result;
  }
}
