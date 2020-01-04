# -*- coding: utf-8 -*-
"""
Created on Fri Jan  3 18:46:02 2020

@author: azach
"""

import asyncio
import websockets
import nest_asyncio
nest_asyncio.apply()

async def communication(websocket, path):
    matrix = await websocket.recv()
    print(matrix)
    greeting = str({"a": [0.5714025497436523, 0.47629985213279724]})
    greeting = f"{greeting}"
    await websocket.send(greeting)
    
start_server = websockets.serve(communication, "192.168.1.146", 8765) #change localhost to ip

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
    
    