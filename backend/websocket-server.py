import json
import websockets
import asyncio
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from ai import AI

DEBUG_MODE = True


class WebSocketServer:
    global DEBUG_MODE

    def __init__(self):
        self.ai = AI()
        self.started = False
        self.snakesAlive = []
        self.weightsDict = {}
        self.model = []
        self.population = []

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
            if not self.started:
                if DEBUG_MODE:
                    print("starting...")

                self.population = messageData["snakeIds"]
                self.weightsDict = self.ai.initializeWeights(self.population)
                if DEBUG_MODE:
                    print("done initializeWeights")
                await self.sendMessage(websocket, messageId, "ack", data = {})
                self.started = True
            else:
                if DEBUG_MODE:
                    print("new generation...")
                survivors = self.population
                self.population = messageData["snakeIds"]
                self.weightsDict = self.ai.reinitializeWeights(self.population,survivors,self.weightsDict)
                
                if DEBUG_MODE:
                    print("new weights loaded...")
                await self.sendMessage(websocket, messageId, "ack", survivors.tolist())

        elif messageType == "data":
            if self.started:
                if DEBUG_MODE:
                    print("predicting...")
                df,self.population = self.ai.df_construct(messageData)
                output_json = self.ai.populationOperator(self.population,df,self.weightsDict)
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
