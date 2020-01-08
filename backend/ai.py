# -*- coding: utf-8 -*-
"""
Created on Fri Jan  3 18:46:02 2020

@author: azach
"""
import os
import glob
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import asyncio
import websockets
import json
import csv
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
import random

class AI():
    def __init__(self):
        self.FilePathModels = "./models/"
        self.FilePathLog = "./log/"
        self.width = 50 #width of input matrix
        self.height = 50 #height of input matrix
        self.levels = 4 # number of classes in matrix
        self.n_auxData = 4 #aux data
        self.mutationRate = 0.5 #standard devivation for selection from normal distrubtion on Generation > 0" 
        self.variance = 1 #standard devivation for selection from normal distrubtion on Generation = 0" 
        self.network = []
        self.nonSurvivorRate = 0.0 #
        self.selectionRate = 0.25 # keep top percentage
        self.totalEnergyIntake = dict({})
        self.EnergyIntake = {}
        self.generation = 0
        self.Counter = 0
        self.AdaptionFrequency = 50 
        self.AdaptionRate = 0.5 
        
        
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
    def getAuxInput(self,IndividualEnergyIntake,energyLevel,velocityX,velocityY):
        return np.asarray([IndividualEnergyIntake,energyLevel,velocityX,velocityY])
   
    def createInputs(self, df,individuum):
        #subset df to single snake data and put values into input arrays
        df_subset = df[df["individuum"] == individuum]
        IndividualEnergyIntake =self.totalEnergyIntake[individuum]
        auxInput =self.getAuxInput(IndividualEnergyIntake,df_subset["energyLevel"].values[0],df_subset["velocityX"].values[0],df_subset["velocityY"].values[0])
        inputArray =np.asarray(df_subset["matrix"].values[0])
        #inputArray = inputArray/self.levels
        return inputArray, auxInput

    ##reshaping
    '''reshape arrays into input tensor'''
    def reshaping(self, inputArray,auxInput):
        inputArray_ = inputArray.reshape(-1,self.width, self.height,self.levels) #Conv2D accepts 3D array
        auxInput_ = auxInput.reshape(-1,self.n_auxData)
        return inputArray_,auxInput_
    
    '''builds a model and compiles it with random weights'''
    def buildNetwork(self):
        ##input placeholder
        #matrix input
        mainInput = Input(shape=(self.width, self.height, self.levels))
        #meta input (Aka energy level, direction, velocity)
        auxiliaryInput = Input(shape=(self.n_auxData,), name='aux_input')

        #CNN Network for processing matrix Data
        x = Conv2D(64, (3, 3), padding='same',activation ='relu')(mainInput)
        x = MaxPooling2D((2, 2))(x)
        x = Conv2D(32, (3, 3), padding='same',activation ='relu')(mainInput)
        x= Flatten()(x)
        CNNout= Dense(units = 4, activation = 'relu')(x)
        #combine CNN Output with metaInput
        x = concatenate([CNNout, auxiliaryInput])
        #stack a deep densely-connected network on top
        x = Dense(8, activation='relu')(x) 
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
    def getCurrentEnergy(self,listA,listB):
        return dict(zip(listA,listB))
    ''
    def preprocessEnergyIntake(self,population,energyIntake):
        currentEnergyIntake = self.getCurrentEnergy(population,energyIntake)
        if not self.totalEnergyIntake:
            self.EnergyIntake = self.getCurrentEnergy(population,([0] * len(population)))
        else:
            for k, v in currentEnergyIntake.items():
                self.EnergyIntake[k] = v - self.totalEnergyIntake.get(k, 0)
            #map energyIntake to 0 or 1
            for key, value in self.EnergyIntake.items():
                if value > 0:
                    self.EnergyIntake[key] = 1
        self.totalEnergyIntake.update(currentEnergyIntake)
        return self

    def mutateWeights(self, weights, rate):
        mutator = np.random.normal(loc = 0, scale = rate, size = 1)
        return weights + mutator*weights

    def softmax(self,x):
        x= np.asarray(x)
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()

    def selectSurvivors(self):
        oldPopulation=list(self.totalEnergyIntake.keys()) 
        selectionFeature = list(self.totalEnergyIntake.values())
        try:
             proba = self.softmax(selectionFeature) 
        except:
            survivors = random.choice(oldPopulation,k=len(oldPopulation))
        else:
            survivors = list(np.random.choice(oldPopulation, (len(oldPopulation)-int(round(len(oldPopulation)*self.nonSurvivorRate))), p=proba,replace=True))
        nonSurvivors = list(set(oldPopulation) - set(survivors))
        for i in range(len(nonSurvivors)):
            survivors.append(random.choice((nonSurvivors)))
        return survivors
    
    '''Input: population is list of all IDs from individuums in population
       Build models for each member of the population  
       Output: dictionary with key "ID" of individuum and value with "weights" as np.array 
    '''
    def initializeWeights(self, population):
        models= []
        for individuum in population: 
            self.network = self.buildNetwork()
            weights = np.array(self.network.get_weights())
            models.append(weights)
        weightsDict = dict(zip(population,models))
        return weightsDict

    ''' creates weights for individuums of next generation'''
    def reinitializeWeights(self,population,survivors,weightsDict):
        if self.Counter == self.AdaptionFrequency:
            self.mutationRate = self.mutationRate*self.AdaptionRate
            self.Counter = 0
        self.totalEnergyIntake = {}
        modelWeights = []    
        for i in range(len(population)):
            weights = weightsDict[survivors[i]]
            newWeights = self.mutateWeights(weights, self.mutationRate)
            modelWeights.append(np.array(newWeights))

        weightsDict = dict(zip(population,modelWeights))
        self.generation = self.generation +1
        return weightsDict
        
    '''uses network with inputweights for prediction, returns array'''
    def prediction(self,weights,inputArray_, auxInput_):
        self.network.set_weights(weights)
        pred = self.network.predict([inputArray_, auxInput_])
        return [float(pred[1][0,0]),float(pred[0][0,0])]

    #create inputs&run pred
    '''processes Inputs for each Individuum and returns a new output'''
    def populationOperator(self,population,df,weightsDict):
        energyIntake = df["energyIntake"].tolist()
        self.preprocessEnergyIntake(population,energyIntake)
        outputDict = {}
        for individuum in population:
            inputArray, auxInput = self.createInputs(df,individuum)
            inputArray_, auxInput_ = self.reshaping(inputArray,auxInput)
            pred_ = self.prediction(weightsDict[individuum],inputArray_, auxInput_)
            outputDict.update([(individuum,pred_)],)
        return outputDict 

    '''loads model from list with model name'''
    def loadModel(self, population):
        files_path = os.path.join(self.FilePathModels , '*')
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True) 
        models = []
        if files:
            for i in range(len(population)):
                self.network= load_model('{}'.format(random.choice(files)))
                models.append(np.array(self.network.get_weights()))
            return dict(zip(population,models))

    def saveModel(self,individuum, weights):
        self.network.set_weights(weights)
        self.network.save("{}{}.h5".format(self.FilePathModels,individuum))

    def logging(self,fileName):
        log =[self.generation,sum(self.totalEnergyIntake.values() )]
        print("Generation: {}, Overall EnergyIntake: {}".format(log[0],log[1]))
        try:
            with open('{}{}.csv'.format(self.FilePathLog,fileName), 'a') as f:
                writer = csv.writer(f)
                writer.writerow(log)
        except IOError:
            with open('{}{}.csv'.format(self.FilePathLog,fileName), 'w') as f:
                writer = csv.writer(f)
                writer.writerow(log)
        f.close()
