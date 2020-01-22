import json
import pandas as pd
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
        self.nes = AI()
        self.started = False
        self.reload = False
        self.generation = 0
        self.model = []
        self.previousMessageData = None

    def start(self):
        print("server running...")
        return websockets.serve(self.communication, "localhost", 8765) #change localhost to ip "192.168.1.146"
        
    def processMessageData(self, messageData):
        return pd.DataFrame.from_dict(messageData).T

    async def communication(self, websocket, path):
        async for data in websocket:
            message = json.loads(data)
            await self.processMessage(websocket, message["messageId"], message["type"], message["data"])

    async def processMessage(self, websocket, messageId, messageType, messageData = {}):

        if DEBUG_MODE:
            print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(self.started)))
        data = self.processMessageData(messageData)

        if messageType == "generation":
            if not self.started and not self.reload:
                if DEBUG_MODE:
                    print("starting...")
                self.nes.startWorld(data)
                if DEBUG_MODE:
                    print("done...")
                await self.sendMessage(websocket, messageId, "ack", data = {})
                self.started = True

            if not self.started and self.reload:
                print("loadModel is not here yet...")
                if DEBUG_MODE:
                    print("reloading...")
                #self.model = self.nes.loadModel()
                if DEBUG_MODE:
                    print("done...")
                await self.sendMessage(websocket, messageId, "ack", data = {})
                self.started = True

            else:
                if DEBUG_MODE:
                    print("evole new generation...")
                
                if self.generation % 20 == 0:
                    #self.nes.saveModel(self.model,self.generation)
                    if DEBUG_MODE:
                        print("models saved to file...")
                if self.generation == 0:
                    pass
                else:
                    self.nes.logging(self.generation)
                    self.nes.updateModel()
                self.generation = self.generation +1
                if DEBUG_MODE:
                    print("done...")
                await self.sendMessage(websocket, messageId, "ack", None)

        elif messageType == "data":
            if self.started:
                if DEBUG_MODE:
                    print("predicting...")
                output_json = self.nes.runModel(data)
                await self.sendMessage(websocket, messageId, "data", output_json)
                print(self.nes.printFrameCount())
                if self.nes.printFrameCount() == 1.0:
                    if DEBUG_MODE:
                     print("new generation...")
                    await self.sendMessage(websocket, messageId, "generation", self.generation+1)
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
