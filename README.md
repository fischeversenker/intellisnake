# IntelliSnake

## Frontend
TypeScript project. No 3rd party deps except during development (nodemon, etc), see frontend/package.json.

## Backend
Python with Tensorflow.

## Communication
FE and BE communicate via WebSocket connection.

### Messages
- are always JSON
- must contain `type` (string) and `messageId` (integer)
- some types must contain `data` (object/hashmap/dict) as well

#### Example:
```json
{
  "messageId": 0,
  "type": "start",
  "data": {}
}
```

### Protocol
```
FE -> BE:
  {
    messageId: [0..],
    type: generation,
    data: { snakeIds: [a, b, c, ...] }
  }
BE -> FE:
  {
    messageId: [0..],
    type: generation,
    data: { generation: [0..] }
  }
FE -> BE:
  {
    messageId: [0..],
    type: data,
    data: { 0: { id: 0, ... }, 1: { id: 1, ... } }
  }
BE -> FE:
  {
    messageId: [0..],
    type: data,
    data: { prediction: { 0: [a, b], 1: [...] }, progress: [0..1] }
  }
FE -> BE:
  {
    messageId: [0..],
    type: data,
    data: { 0: { id: 0, ... }, 1: { id: 1, ... } }
  }
BE -> FE:
  {
    messageId: [0..],
    type: data,
    data: { prediction: { 0: [a, b], 1: [...] }, progress: [0..1] }
  }
...
BE -> FE:
  {
    messageId: [0..],
    type: generation,
    data: { generation: 1 }
  }
FE -> BE:
  {
    messageId: [0..],
    type: data,
    data: { 0: { id: 0, ... }, 1: { id: 1, ... } }
  }
...
```
