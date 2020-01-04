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

### Message Types:
#### type: start (sent only once by client)
client will wait for message of type `ack` from server after this before starting the world

#### type: reproduce (sent only by client)
data contains `parentId` and `childId`

#### type: epoch (sent only by client)
contains no data

#### type: snakes
Client: contains metadata for each snake (energyLevel, matrix, velocity)
Server: contains predictions of new velocities for each snake

#### type: ack (sent only by server)
contains no data

### Protocol
```
C: type: start
S: type: ack

C: type: snakes
S: type: snakes
C: type: reproduce
S: type: ack
C: type: snakes
S: type: snakes
...
C: type: reproduce
S: type: ack
C: type: snakes
S: type: snakes
...

C: type: epoch
S: type: ack
C: type: snakes
S: type: snakes
```
