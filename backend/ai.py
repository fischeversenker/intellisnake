# -*- coding: utf-8 -*-
"""
Created on Fri Jan  3 18:46:02 2020

@author: azach
"""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import asyncio
import websockets
import json

# suppress FutuerWarnings from Pandas
import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

import pandas as pd
from keras.layers import Conv2D, MaxPooling2D, Input, Dense, Flatten,concatenate,UpSampling2D
from keras.models import Model,load_model
import numpy as np
import time
import gc
from keras.backend.tensorflow_backend import set_session
from keras.backend.tensorflow_backend import clear_session
from keras.backend.tensorflow_backend import get_session
import tensorflow


#parameters
FilePath = "./"
width = 50 #width of input matrix
height = 50 #height of input matrix
levels = 4 # number of classes in matrix
n_auxData = 3 #aux data
mutationRate = 0.1


#helpers
def df_construct(data):
    '''reads data from websocket and creates a dataframe for pred'''
    df = pd.DataFrame.from_dict(data).T
    df['snakeId'] = df.index
    df['snakeId'] = df['snakeId'].astype(str)
    snakesAlive = df['snakeId'].unique()
    return df, snakesAlive

#create input tensors
def createInputs(df,snake):
    '''extract values from dataframe and turns it arrays'''
    #subset df to single snake data and put values into input arrays
    df_subset = df[df["snakeId"] == snake]
    #create inputs as numpy arrays
    auxInput =np.asarray([df_subset["energyLevel"].values[0],df_subset["velocityX"].values[0],df_subset["velocityY"].values[0]])
    inputArray =np.asarray(df_subset["matrix"].values[0])


    return inputArray, auxInput

##reshaping
def reshaping(inputArray,auxInput):
    '''reshape arrays into input tensor'''
    inputArray_ = inputArray.reshape(-1,width, height,levels) #Conv2D accepts 3D array
    auxInput_ = auxInput.reshape(-1,n_auxData)
    return inputArray_,auxInput_

def getTrainData(df):
    '''creates training data for autoencoder'''
    train_x = ([])
    for snake in df["snakeId"]:
       inputArray, auxInput =  createInputs(df,snake)
       inputArray_,auxInput_ =reshaping(inputArray,auxInput)
       train_x = np.append(train_x,inputArray_)
    return train_x

def buildModel(width, height, levels,n_auxData):
    ##input placeholder
    #matrix input
    mainInput = Input(shape=(width, height, levels))
    #meta input (Aka energy level, direction, velocity)
    auxiliaryInput = Input(shape=(n_auxData,), name='aux_input')


    #CNN Network for processing matrix Data
    x = Conv2D(32, (3, 3), padding='same')(mainInput)
    x = MaxPooling2D((2, 2))(x)
    x = Conv2D(16, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D((2, 2), padding='same')(x)
    x = Conv2D(8, (3, 3), activation='relu', padding='same')(x)
    CNNout = Flatten()(x)


    #combine CNN Output with metaInput
    x = concatenate([CNNout, auxiliaryInput])

    #stack a deep densely-connected network on top
    x = Dense(8, activation='relu')(x)
    x = Dense(8, activation='relu')(x)
    x = Dense(4, activation='relu')(x)
    dir_x = Dense(2, activation='relu')(x)
    velocity_x = Dense(2, activation='relu')(x)


    #define output
    dir_output = Dense(1, activation='tanh', name='dir_output')(velocity_x)
    velocity_output = Dense(1, activation='tanh', name='velocity_output')(dir_x)

    model = Model(inputs=[mainInput, auxiliaryInput], outputs=[dir_output, velocity_output])

    model.compile(optimizer='rmsprop', loss='binary_crossentropy',
                  loss_weights=[1., 0.2])
    return model

def autoencoder(df,width, height, levels,train_x):
    '''creates a autoencoder model, trains it and returns weights from layers'''
    #matrix input
    mainInput = Input(shape=(width, height, levels))


    #CNN Network for processing matrix Data
    x = Conv2D(32, (3, 3), padding='same')(mainInput)
    x = MaxPooling2D((2, 2))(x)
    x = Conv2D(16, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D((2, 2), padding='same')(x)
    x = Conv2D(8, (3, 3), activation='relu', padding='same')(x)
    encoded = MaxPooling2D((2, 2), padding='same')(x)

    x = Conv2D(8, (3, 3), activation='relu', padding='same')(encoded)
    x = UpSampling2D((2, 2))(x)
    x = Conv2D(8, (3, 3), activation='relu', padding='same')(x)
    x = UpSampling2D((2, 2))(x)
    x = Conv2D(16, (3, 3), activation='relu')(x)
    x = UpSampling2D((2, 2))(x)
    decoded = Conv2D(1, (3, 3), activation='sigmoid', padding='same')(x)

    autoencoder = Model(mainInput, decoded)
    autoencoder.compile(optimizer='adadelta', loss='binary_crossentropy')

    autoencoder.fit(train_x,train_x,
                epochs=50,
                batch_size=len(df),
                shuffle=True)

    layer0 = autoencoder.layers[0].get_weights()
    layer1 = autoencoder.layers[1].get_weights()
    layer2 = autoencoder.layers[2].get_weights()
    layer3 = autoencoder.layers[3].get_weights()
    layer4 = autoencoder.layers[4].get_weights()
    return layer0,layer1,layer2,layer3,layer4

def transferWeights(df,layer0,layer1,layer2,layer3,layer4):
    for snake in df["snakeId"]:
        model = load_model('{}{}.h5'.format(FilePath, snake))
        model.layers[0].set_weights(layer0)
        model.layers[1].set_weights(layer1)
        model.layers[2].set_weights(layer2)
        model.layers[3].set_weights(layer3)
        model.layers[4].set_weights(layer4)
        model.save('{}{}.h5'.format(FilePath, snake))

def mutateWeights(model,weights,mutationRate):
    #mutation rate
    mutator = np.random.normal(loc = 0, scale = mutationRate, size = 1)
    model.set_weights(weights + mutator*weights)
    return model

def recreateSnakeNets(model,snakeList,weightsDict,snakesAliveOld,mutationRate):
    '''for new epoch: loads historic snake Nets'''

    dict((k, weightsDict[k]) for k in snakesAliveOld if k in weightsDict)
    for snake in snakeList:
        x = str(np.random.choice(snakesAliveOld,1)[0])[0]
        weights = weightsDict[x]
        model = mutateWeights(model,weights,mutationRate)
        model.save('{}{}.h5'.format(FilePath, snake))

def createSnakeNets(snakeList):
    '''creates snake nets with random weights'''
    for snake in snakeList:
        model = buildModel(width, height, levels,n_auxData)
        model.save('{}{}.h5'.format(FilePath, snake))

def loadWeights(snakeList):
    models = []
    for snake in snakeList:
        model = load_model('{}{}.h5'.format(FilePath, snake))
        #model._make_predict_function()
        a = np.array(model.get_weights())
        models.append(a)
    return dict(zip(snakeList,models))

def predSnakeNets(model,weights,inputArray_, auxInput_):
    '''loads snake nets and predicts next movement'''
    #model = load_model('{}{}.h5'.format(FilePath, snake))
    model.set_weights(weights)
    pred = model.predict([inputArray_, auxInput_])

    return [float(pred[1][0,0]),float(pred[0][0,0])]

def reproduceSnake(model,weightsDict,parentSnake,childSnake,mutationRate):
     '''copys snake net from parent Snake, mutates it and saves it as a new snake net'''
     weights = weightsDict[parentSnake]
     model = mutateWeights(model,weights,mutationRate)
     model.save('{}{}.h5'.format(FilePath, childSnake))

#create inputs&run pred
def snakeCommander(df,weightsDict,model):
    '''basic functions to control snakes'''
    snakes = []
    preds = []
    metrics  = []
    timestamp1 = time.time()
    for snake in df['snakeId']:
        inputArray, auxInput = createInputs(df,snake)
        inputArray_, auxInput_ = reshaping(inputArray,auxInput)

        pred_ = predSnakeNets(model,weightsDict[snake],inputArray_, auxInput_)
        metrics.append(auxInput)
        snakes.append(snake)
        preds.append(pred_)
    timestamp2 = time.time()
    if debugMode:
        print("total runtime for alle snake predictitions: {}".format(str(timestamp2-timestamp1)))
    #store preds in dict
    outputDict = dict(zip(snakes,preds))

    outputDf = pd.DataFrame.from_dict(zip(snakes, metrics))
    return outputDict , outputDf

'''
    to do:
    def logSnakes():
        return []

    def readLogFile():
        return []

    def snakeSelector():

        #select snake, which consumed the most energy

        #select snake, which survived the longest

        choosenSnakes = []
        return choosenSnakes
'''


#variables
started = False
snakesAlive = []
weightsDict = []
model = []

debugMode = True

async def communication(websocket, path):
    async for data in websocket:
        message = json.loads(data)
        await processMessage(websocket, message["messageId"], message["type"], message["data"])

async def processMessage(websocket, messageId, messageType, messageData = {}):
    global started, snakesAlive, weightsDict, model, FilePath

    if debugMode:
        print("Processing new message:  id: {},  type: {},  len: {}\nState:  started: {}".format(messageId, messageType, len(messageData), str(started)))
    if messageType == "epoch":
        if not started:
            if debugMode:
                print("starting...")

            snakesAlive = messageData["snakeIds"]
            createSnakeNets(snakesAlive)
            if debugMode:
                print("done creating snake nets")
            model = load_model('{}{}.h5'.format(FilePath ,1)) #load random model and adjust weights later
            print(snakesAlive)
            weightsDict = loadWeights(snakesAlive)
            if debugMode:
                print("done loading weights")

            await sendMessage(websocket, messageId, "ack", data = {})
            started = True
        else:
            if debugMode:
                print("new epoch...")
            snakesAliveOld = snakesAlive
            snakesAlive = messageData["snakeIds"]
            if len(snakesAliveOld) == 0:
                snakesAliveOld = snakesAlive
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
        if started:
            if debugMode:
                print("predicting...")
            df,snakesAlive = df_construct(messageData)
            output_json,outputDf = snakeCommander(df,weightsDict,model)
            await sendMessage(websocket, messageId, "snakes", output_json)
        else:
            await sendMessage(websocket, messageId, "error", "you need to send epoch message before sending snake data")

    else:
        await sendMessage(websocket, messageId, "error", "unknown type" + messageType)


async def sendMessage(webSocket, messageId, messageType, data = {}):
    if debugMode:
        print("sending {}".format(messageType))
    message = { "messageId": messageId, "type": messageType, "data": data }
    return await webSocket.send(json.dumps(message))

start_server = websockets.serve(communication, "localhost", 8765) #change localhost to ip "192.168.1.146"

asyncio.get_event_loop().run_until_complete(start_server)
print("server running...")
asyncio.get_event_loop().run_forever()
