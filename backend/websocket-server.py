from .ai import AI
import json
import websockets
import asyncio
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'


DEBUG_MODE = True


class WebSocketServer:
    global DEBUG_MODE

    def __init__(self):
        self.ai = AI()
        self.started = False
        self.snakesAlive = []
        self.weightsDict = {}
        self.model = []

    def start(self):
        websockets.serve(self.communication, "localhost", 8765) #change localhost to ip "192.168.1.146"
        print("server running...")

    async def communication(self, websocket, path):
        async for data in websocket:
            message = json.loads(data)
            await self.processMessage(websocket, message["messageId"], message["type"], message["data"])

    async def processMessage(self, websocket, messageId, messageType, messageData = {}):

        if DEBUG_MODE:
            print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(self.started)))
        if messageType == "epoch":
            if not self.started:
                if DEBUG_MODE:
                    print("starting...")

                self.snakesAlive = messageData["snakeIds"]
                self.ai.createSnakeNets(self.snakesAlive)
                if DEBUG_MODE:
                    print("done creating snake nets")
                self.model = self.ai.load_model('{}{}.h5'.format('./models/', 1)) #load random model and adjust weights later
                print(self.snakesAlive)
                weightsDict = self.ai.loadWeights(self.snakesAlive)
                if DEBUG_MODE:
                    print("done loading weights")

                await sendMessage(websocket, messageId, "ack", data = {})
                self.started = True
            else:
                if DEBUG_MODE:
                    print("new epoch...")
                snakesAliveOld = self.snakesAlive
                self.snakesAlive = messageData["snakeIds"]
                self.ai.recreateSnakeNets(self.model, self.snakesAlive, self.weightsDict, snakesAliveOld, self.mutationRate)
                weightsDict = self.ai.loadWeights(self.snakesAlive)
                if DEBUG_MODE:
                    print("new weights loaded...")
                await sendMessage(websocket, messageId, "ack", snakesAliveOld)

        # maybe get rid of this completely?
        elif messageType == "reproduce":
            # create new clone of parent
            parentSnake = messageData["parentId"]
            childSnake = messageData["childId"]
            self.ai.reproduceSnake(model, weightsDict, parentSnake, childSnake, self.mutationRate)
            await sendMessage(websocket, messageId, "ack")

        elif messageType == "snakes":
            if self.started:
                if DEBUG_MODE:
                    print("predicting...")
                df,snakesAlive = self.ai.df_construct(messageData)
                output_json,outputDf = self.ai.snakeCommander(df,weightsDict,model)
                await sendMessage(websocket, messageId, "snakes", output_json)
            else:
                await sendMessage(websocket, messageId, "error", "you need to send epoch message before sending snake data")

        else:
            await sendMessage(websocket, messageId, "error", "unknown type" + messageType)


    async def sendMessage(self, webSocket, messageId, messageType, data = {}):
        if DEBUG_MODE:
            print("sending {}".format(messageType))
        message = { "messageId": messageId, "type": messageType, "data": data }
        return await webSocket.send(json.dumps(message))


server = WebSocketServer()

asyncio.get_event_loop().run_until_complete(server.start)
asyncio.get_event_loop().run_forever()
