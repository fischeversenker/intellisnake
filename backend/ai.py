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
FilePath = "./models/"
width = 50 #width of input matrix
height = 50 #height of input matrix
levels = 4 # number of classes in matrix
n_auxData = 3 #aux data
mutationRate = 0.1

class AI():
    def __init__(self):
        self.FilePath = "./models/"
        self.width = 50 #width of input matrix
        self.height = 50 #height of input matrix
        self.levels = 4 # number of classes in matrix
        self.n_auxData = 33 #aux data
        self.mutationRate = 0.1  #standard devivation for selection from normal distrubtion on Generation > 0" 
        self.variance = 0.9 #standard devivation for selection from normal distrubtion on Generation = 0" 
        self.network = []
    '''Functions to extract data from messages,
    reshape inputs and create tensor'''

    '''reads data from websocket and creates a dataframe for pred'''
    def df_construct(self, data):
        df = pd.DataFrame.from_dict(data).T
        df['individuum'] = df.index
        df['individuum'] = df['individuum'].astype(str)
        population = df['individuum'].unique()
        return df, population

    #create input tensors
    '''extract values from dataframe and turns it arrays'''
    def createInputs(self, df,individuum):
        #subset df to single snake data and put values into input arrays
        df_subset = df[df["individuum"] == individuum]
        #create inputs as numpy arrays
        auxInput =np.asarray([df_subset["energyLevel"].values[0],df_subset["velocityX"].values[0],df_subset["velocityY"].values[0]])
        inputArray =np.asarray(df_subset["matrix"].values[0])
        return inputArray, auxInput

    ##reshaping
    '''reshape arrays into input tensor'''
    def reshaping(self, inputArray,auxInput):
        inputArray_ = inputArray.reshape(-1,self.width, self.height,self.levels) #Conv2D accepts 3D array
        auxInput_ = auxInput.reshape(-1,n_auxData)
        return inputArray_,auxInput_
    
    '''builds a model and compiles it with random weights'''
    def buildNetwork(self):
        ##input placeholder
        #matrix input
        mainInput = Input(shape=(self.width, self.height, self.levels))
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
        network = Model(inputs=[mainInput, auxiliaryInput], outputs=[dir_output, velocity_output])
        network.compile(optimizer='rmsprop', loss='binary_crossentropy',
                    loss_weights=[1., 0.2])

        return network
    '''Input: array, rate = mutationRate or variance Output: array
       takes np.array containing weights from an individual,
       multiplies with random selection from normal distrubtion with center 
       and SD = mutationRate
    '''

    def mutateWeights(self, weights, rate):
        mutator = np.random.normal(loc = 0, scale = rate, size = 1)
        return weights + mutator*weights

    '''Input: population is list of all IDs from individuums in population

       Build models for each member of the population  
       
       Output: dictionary with key "ID" of individuum and value with "weights" as np.array 
    '''
    def initializeWeights(self, population):
        models= []
        self.network = self.buildNetwork()
        for individuum in population: 
            weights = np.array(self.network.get_weights())
            newWeights = self.mutateWeights(weights,self.variance)
            newWeights = self.mutateWeights(weights,self.variance)
            models.append(newWeights)
        weightsDict = dict(zip(population,models))
        return weightsDict

    ''' creates weights for individuums of next generation'''
    def reinitializeWeights(self,population,survivors,weightsDict):
        weightsDict_survivors = dict((k, weightsDict[k]) for k in survivors if k in weightsDict)
        models = []
        for individuum in population:
            x = str(np.random.choice(survivors,1)[0])[0] #selects from survivors
            weights = weightsDict_survivors[x]
            newWeights = self.mutateWeights(weights,self.mutationRate)
            models.append(np.array(newWeights))
        weightsDict = dict(zip(population,models))
        return weightsDict

    '''loads model from list with model name'''
    def loadModel(self, population):
        models = []
        for individuum in population:
            network= load_model('{}{}.h5'.format(self.FilePath, individuum))
            #model._make_predict_function()
            models.append(np.array(network.get_weights()))
        return dict(zip(population,models))

    '''uses network with inputweights for prediction, returns array'''
    def prediction(self,weights,inputArray_, auxInput_):
        self.network.set_weights(weights)
        pred = self.network.predict([inputArray_, auxInput_])
        return [float(pred[1][0,0]),float(pred[0][0,0])]

    #create inputs&run pred
    '''processes Inputs for each Individuum and returns a new output'''
    def populationOperator(self,population, df,weightsDict):
        outputDict = {}
        for individuum in population:
            inputArray, auxInput = self.createInputs(df,individuum)
            inputArray_, auxInput_ = self.reshaping(inputArray,auxInput)
            pred_ = self.prediction(weightsDict[individuum],inputArray_, auxInput_)
            outputDict.update(individuum,pred_)
        return outputDict 
