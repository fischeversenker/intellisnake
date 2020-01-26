import json
import pandas as pd
import websockets
import asyncio
import os
import time
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '1'
from ai import AI

DEBUG_MODE = True


class WebSocketServer:
    global DEBUG_MODE

    def __init__(self):
        self.nes = AI()
        self.started = False
        self.generation = 0
        self.model = []
        self.previousMessageData = None

    def start(self):
        print("server running...")
        return websockets.serve(self.communication, "localhost", 8765) #change localhost to ip "192.168.1.146"
        
    def processMessageTypeData(self, messageData):
        return messageData["matrix"],messageData["snakeIds"]

    def processMessageTypeStart(self,messageData):
        return {item['id']:item['color'] for item in messageData["snakes"]}

    def processMessageTypeGeneration(self,messageData):
        return {item['id']:item['energyIntake'] for item in messageData["snakes"]}

    async def communication(self, websocket, path):
        async for data in websocket:
            message = json.loads(data)
            await self.processMessage(websocket, message["messageId"], message["type"], message["data"])

    async def processMessage(self, websocket, messageId, messageType, messageData = {}):

        if DEBUG_MODE:
            print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(self.started)))
      
        if messageType == "start":
            data = self.processMessageTypeStart(messageData)
            if not self.started:
                if DEBUG_MODE:
                    print("starting...")
                self.nes.startModel(data)
                if DEBUG_MODE:
                    print("done...")
                await self.sendMessage(websocket, messageId, "start", data ={"generation": self.generation})
                self.started = True

        elif messageType == "generation":
            data = self.processMessageTypeGeneration(messageData)
            if DEBUG_MODE:
                print("new generation...")
            self.nes.updateModel()
            self.generation = self.generation +1
            if DEBUG_MODE:
               print("done...")
            await self.sendMessage(websocket, messageId, "start", self.generation)

        elif messageType == "data":
            matrix,snakeIds = self.processMessageTypeData(messageData)
            if self.started:
                if DEBUG_MODE:
                    print("predicting...")
                output_json = self.nes.runModel(matrix,snakeIds)
                await self.sendMessage(websocket, messageId, "data", output_json)
                if self.nes.printFrameCount() == 1 or len(snakeIds) == 0:
                    await self.sendMessage(websocket, messageId, "generation", self.generation)
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
