import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import asyncio
import websockets
import json
import AI

#variables
started = False
snakesAlive = []
weightsDict = []
model = []

debugMode = True

class WebSocketServer:
  def __main__(self):
    self.ai = AI();

  async def communication(self, websocket, path):
      async for data in websocket:
          message = json.loads(data)
          await processMessage(websocket, message["messageId"], message["type"], message["data"])

  async def processMessage(self, websocket, messageId, messageType, messageData = {}):

      if debugMode:
          print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(self.started)))
      if messageType == "epoch":
          if not self.started:
              if debugMode:
                  print("starting...")

              snakesAlive = messageData["snakeIds"]
              self.ai.createSnakeNets(snakesAlive)
              if debugMode:
                  print("done creating snake nets")
              model = load_model('{}{}.h5'.format(FilePath ,1)) #load random model and adjust weights later
              print(snakesAlive)
              weightsDict = loadWeights(snakesAlive)
              if debugMode:
                  print("done loading weights")

              await sendMessage(websocket, messageId, "ack", data = {})
              self.started = True
          else:
              if debugMode:
                  print("new epoch...")
              snakesAliveOld = snakesAlive
              snakesAlive = messageData["snakeIds"]
              recreateSnakeNets(model, snakesAlive, weightsDict, snakesAliveOld, mutationRate)
              weightsDict = loadWeights(snakesAlive)
              if debugMode:
                  print("new weights loaded...")
              await sendMessage(websocket, messageId, "ack", snakesAliveOld)

      # maybe get rid of this completely?
      elif messageType == "reproduce":
          #create new clone of parent
          parentSnake = messageData["parentId"]
          childSnake = messageData["childId"]
          reproduceSnake(model, weightsDict, parentSnake, childSnake, mutationRate)
          await sendMessage(websocket, messageId, "ack")

      elif messageType == "snakes":
          if self.started:
              if debugMode:
                  print("predicting...")
              df,snakesAlive = df_construct(messageData)
              output_json,outputDf = snakeCommander(df,weightsDict,model)
              await sendMessage(websocket, messageId, "snakes", output_json)
          else:
              await sendMessage(websocket, messageId, "error", "you need to send epoch message before sending snake data")

      else:
          await sendMessage(websocket, messageId, "error", "unknown type" + messageType)


  async def sendMessage(self, webSocket, messageId, messageType, data = {}):
      if debugMode:
          print("sending {}".format(messageType))
      message = { "messageId": messageId, "type": messageType, "data": data }
      return await webSocket.send(json.dumps(message))

start_server = websockets.serve(communication, "localhost", 8765) #change localhost to ip "192.168.1.146"

asyncio.get_event_loop().run_until_complete(start_server)
print("server running...")
asyncio.get_event_loop().run_forever()
