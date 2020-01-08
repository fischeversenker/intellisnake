import json
import websockets
import asyncio
import os
import time
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '1'

from ai import AI

DEBUG_MODE = False


class WebSocketServer:
    global DEBUG_MODE

    def __init__(self):
        self.ai = AI()
        self.started = False
        self.reload = False
        self.snakesAlive = []
        self.weightsDict = {}
        self.model = []
        self.population = []
        self.session = ""
        self.saveEveryXGenerations = 2
        self.saveCounter = 0
        self.generation = 0

    def start(self):
        print("server running...")
        return websockets.serve(self.communication, "localhost", 8765) #change localhost to ip "192.168.1.146"

    async def communication(self, websocket, path):
        async for data in websocket:
            message = json.loads(data)
            await self.processMessage(websocket, message["messageId"], message["type"], message["data"])

    async def processMessage(self, websocket, messageId, messageType, messageData = {}):

        if DEBUG_MODE:
            print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(self.started)))
        if messageType == "generation":
            if not self.started and not self.reload:
                if DEBUG_MODE:
                    print("starting...")

                self.population = list(messageData["snakeIds"])
                self.weightsDict = self.ai.initializeWeights(self.population)
                self.session = str(time.time())
                if DEBUG_MODE:
                    print("done initializeWeights")
                await self.sendMessage(websocket, messageId, "ack", data = {})
                self.started = True

            if not self.started and self.reload:
                if DEBUG_MODE:
                    print("reloading...")

                self.population = list(messageData["snakeIds"])
                self.weightsDict = self.ai.loadModel(self.population)
                self.session = str(time.time())
                if DEBUG_MODE:
                    print("done reloading Weights")
                await self.sendMessage(websocket, messageId, "ack", data = {})
                self.started = True

            else:
                if DEBUG_MODE:
                    print("new generation...")
                self.ai.logging(self.session)
                self.population = list(messageData["snakeIds"])
                if self.generation == 0:
                    survivors = self.population
                else:
                    survivors = self.ai.selectSurvivors()
                    self.weightsDict = self.ai.reinitializeWeights(self.population,survivors,self.weightsDict)
                self.generation = self.generation +1
                self.saveCounter = self.saveCounter +1
                if self.saveCounter >= self.saveEveryXGenerations:
                    for individuum in self.population:
                        self.ai.saveModel(individuum,self.weightsDict[individuum])
                    self.saveCounter = 0
                    if DEBUG_MODE:
                        print("models saved to file...")

                if DEBUG_MODE:
                    print("new weights loaded...")

                if isinstance(survivors, list):
                    await self.sendMessage(websocket, messageId, "ack", survivors)
                else:
                    await self.sendMessage(websocket, messageId, "ack", survivors.tolist())

        elif messageType == "data":
            if self.started:
                if DEBUG_MODE:
                    print("predicting...")
                df, self.population = self.ai.df_construct(messageData)
                output_json = self.ai.populationOperator(self.population, df ,self.weightsDict)
                await self.sendMessage(websocket, messageId, "data", output_json)
            else:
                await self.sendMessage(websocket, messageId, "error", "you need to send generation message before sending snake data")

        else:
            await self.sendMessage(websocket, messageId, "error", "unknown type" + messageType)


    async def sendMessage(self, webSocket, messageId, messageType, data = {}):
        if DEBUG_MODE:
            print("sending {}".format(messageType))
        message = { "messageId": messageId, "type": messageType, "data": data }
        return await webSocket.send(json.dumps(message))


asyncio.get_event_loop().run_until_complete(WebSocketServer().start())
asyncio.get_event_loop().run_forever()
