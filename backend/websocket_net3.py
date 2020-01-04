# -*- coding: utf-8 -*-
"""
Created on Fri Jan  3 18:46:02 2020

@author: azach
"""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 

import asyncio
import websockets
import nest_asyncio
import json
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


path = "C:\\Users\\azach\\Desktop\\intiSnake\\backend\\"
#parameters
len_1d_array = 2500

width = 50 #width of input matrix
height = 50 #height of input matrix
levels = 4 # number of classes in matrix
n_auxData = 3 #aux data
mutationRate = 0.9


#helpers
# Reset Keras Session
def reset_keras(model):
    '''garabage collector for tensorflow'''
    sess = get_session()
    clear_session()
    sess.close()
    sess = get_session()

    try:
        del model # this is from global space - change this as you need
    except:
        pass

    print(gc.collect()) # if it's done something you should see a number being outputted

    # use the same config as you used to create the session
    config = tensorflow.ConfigProto()
    config.gpu_options.per_process_gpu_memory_fraction = 1
    config.gpu_options.visible_device_list = "0"
    set_session(tensorflow.Session(config=config))


def df_construct(data):
    '''reads data from websocket and creates a dataframe'''
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
    x= Conv2D(32, (3, 3), padding='same')(mainInput)
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
    x= Conv2D(32, (3, 3), padding='same')(mainInput)
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
    reset_keras(autoencoder)
    return layer0,layer1,layer2,layer3,layer4
    
def transferWeights(df,layer0,layer1,layer2,layer3,layer4):
    for snake in df["snakeId"]:
        model = load_model('{}{}.h5'.format(path,snake))
        model.layers[0].set_weights(layer0)
        model.layers[1].set_weights(layer1)
        model.layers[2].set_weights(layer2)
        model.layers[3].set_weights(layer3)
        model.layers[4].set_weights(layer4)
        model.save('{}{}.h5'.format(path,snake))
        reset_keras(autoencoder)

def mutateWeights(model,mutationRate):
    #mutation rate
    mutator = np.random.uniform(-(mutationRate),mutationRate)
    #get weights from model
    a = np.array(model.get_weights())         # save weights in a np.array of np.arrays
    model.set_weights(a + a*mutator) 
    return model

def recreateSnakeNets(snakeList,snakesAliveOld,mutationRate):
    '''for new epoch: loads historic snake Nets'''
    for snake in snakeList:
        snake = 1
        model = load_model('{}{}.h5'.format(path,str(np.random.choice(snakesAliveOld,1)[0])[0] ) )
        model = mutateWeights(model,mutationRate)
        model.save('{}{}.h5'.format(path,snake))
        reset_keras(model)

def createSnakeNets(snakeList):
    '''creates snake nets with random weights'''
    for snake in snakeList:
        model = buildModel(width, height, levels,n_auxData)
        model.save('{}{}.h5'.format(path,snake))        
        reset_keras(model)
     
def predSnakeNets(snake,inputArray_, auxInput_):
    '''loads snake nets and predicts next movement'''
    model = load_model('{}{}.h5'.format(path,snake))
    pred = model.predict([inputArray_, auxInput_])
    pred_ = [float(pred[1][0,0]),float(pred[0][0,0])]
    reset_keras(model)
    return pred_
        
        
def reproduceSnake(parentSnake,childSnake,mutationRate):
     '''copys snake net from parent Snake, mutates it and saves it as a new snake net'''
     model = load_model('{}{}.h5'.format(path,parentSnake))
     model = mutateWeights(model,mutationRate)
     model.save('{}{}.h5'.format(path,childSnake))
     reset_keras(model)
     

#create inputs&run pred
def snakeCommander(df):
    '''basic functions to control snakes'''
    snakes = []
    preds = []
    runtimesPred = []
    for snake in df['snakeId']:
       
        inputArray, auxInput = createInputs(df,snake)
        inputArray_, auxInput_ = reshaping(inputArray,auxInput)
        
        
        pred_ = predSnakeNets(snake,inputArray_, auxInput_)
        timestampPred2 = time.time()
        snakes.append(snake)
        preds.append(pred_)
        
    #store preds in dict
    outputDict = dict(zip(snakes,preds))
  
    return outputDict 

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




#function to get asyncio running in spyder
nest_asyncio.apply()

#variables
started = False
newEpoch = True
snakesAlive = []

async def communication(websocket, path):
    
    global started, newEpoch, snakesAlive
    
    print("server 192.168.1.146 on Port 8765 is ready and waiting")
    async for data in websocket:
        
        message = json.loads(data)
        print("Message: {} Type, {} Id, {} len data, started: {}, newEpoch: {}  ".format(message["type"],message["messageId"],len(message["data"]), str(started), str(newEpoch)))
        
        
        if "epoch" == message["type"]:
            await sendMessage(websocket, message["messageId"], "ack")
            print("sending ack")
            newEpoch = True
            
        elif "reproduce" == message["type"]:
            #create new clone of parent 
            try:
                parentSnake = message["data"]["parentId"]
                childSnake = message["data"]["childId"]
                reproduceSnake(parentSnake,childSnake)
            except:  
                await sendMessage(websocket, message["messageId"], "error", data = "reproduce")
            else:
                await sendMessage(websocket, message["messageId"], "ack")
            print("sending ack")
            
        elif "snakes" == message["type"]:
            
            if not started:
            
                #create dataframe
                print("First Data incoming")
                #create new nets if needed at first run
                print("create new nets")
                try:
                    df,snakesAlive = df_construct(message["data"]) 
                    createSnakeNets(df['snakeId'])
                except: 
                    await sendMessage(websocket, message["messageId"], "error", data = "create nets")
                else:
                
                    '''
                    to do
                    create train data for autoencoder
                    train_x = getTrainData(df)
                    train autoencoder
                    layer0,layer1,layer2,layer3,layer4 =autoencoder(df,width, height, levels,train_x)
                    transfer weights to nets
                    transferWeights(df,layer0,layer1,layer2,layer3,layer4)
                    '''
                    try:
                        output_json = snakeCommander(df)
                    except:
                        await sendMessage(websocket, message["messageId"], "error", data = "snakeCommander")
                    else:
                        await sendMessage(websocket, message["messageId"], "snakes", output_json)
                        started = True

            elif started and newEpoch:    
                snakesAliveOld = snakesAlive
                print("recreate old nets")
                recreateSnakeNets(df['snakeId'],snakesAliveOld,mutationRate)
                try:
                    print(snakesAliveOld)
                    df,snakesAlive = df_construct(message["data"]) 
                    print(df)
                    print(snakesAlive)
                    output_json = snakeCommander(df)
                    print(output_json)
                except:
                    await sendMessage(websocket, message["messageId"], "error", data = "snakeCommander")
                else:
                    await sendMessage(websocket, message["messageId"], "snakes", output_json)
                    newEpoch = False
                
            elif started:
                #create dataframe
                
                try:
                    
                    df,snakesAlive = df_construct(message["data"]) 
                    output_json = snakeCommander(df)
                except:
                    await sendMessage(websocket, message["messageId"], "error", data = "snakeCommander")
                else:
                    await sendMessage(websocket, message["messageId"], "snakes", output_json)
            
        else:
            await sendMessage(websocket, message["messageId"], "error", "unknown type")

            
async def sendMessage(webSocket, messageId, messageType, data = {}):
    message = { "messageId": messageId, "type": messageType, "data": data }
    return await webSocket.send(json.dumps(message))
            
start_server = websockets.serve(communication, "192.168.1.146", 8765) #change localhost to ip "192.168.1.146"

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
    
    