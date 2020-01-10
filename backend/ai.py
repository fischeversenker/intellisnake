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
import matplotlib.pyplot as plt

class AI():
    def __init__(self):
        self.FilePathModels = "./models/"
        self.FilePathLog = "./log/"
        self.FilePathPlot = "./plots/"
        self.width = 100 #width of input matrix
        self.height = 100 #height of input matrix
        self.levels = 4 # number of classes in matrix
        self.n_auxData = 4 #aux data
        self.mutationRate = 0.005  #standard devivation for selection from normal distrubtion on Generation > 0" 
        self.network = []
        self.autoencoder = []
        self.sharedLayers = 4
        self.nonSurvivorRate = 0.3 #
        self.totalEnergyIntake = dict({})
        self.EnergyIntake = {}
        self.generation = 0
        self.Counter = 0
        self.AdaptionFrequency = 100 
        self.AdaptionRate = 0.5 
        self.trainData = []
        self.batchSize = 128
        
        
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
    def getAuxInput(self,IndividualEnergyIntake,velocityX,velocityY,energyLevel):
        return np.asarray([IndividualEnergyIntake,velocityX,velocityY,energyLevel])
   
    def createInputs(self, df,individuum):
        #subset df to single snake data and put values into input arrays
        df_subset = df[df["individuum"] == individuum]
        IndividualEnergyIntake =self.totalEnergyIntake[individuum]
        auxInput =self.getAuxInput(IndividualEnergyIntake,df_subset["velocityX"].values[0],df_subset["velocityY"].values[0],df_subset["energyLevel"].values[0])
        inputArray =np.asarray(df_subset["matrix"].values[0])
        print(np.unique(inputArray))
        inputArray = inputArray/self.levels
        return inputArray, auxInput

    ##reshaping
    '''reshape arrays into input tensor'''
    # def reshaping(self, inputArray,auxInput):
    #     inputArray_ = inputArray.reshape(-1,self.width, self.height,self.levels) #Conv2D accepts 3D array
    #     auxInput_ = auxInput.reshape(-1,self.n_auxData)
    #     return inputArray_,auxInput_

    def reshaping(self, inputArray, auxInput):
        inputArray_ = np.reshape(inputArray,(-1,self.width,self.height,1))
        auxInput_ = auxInput.reshape(-1,self.n_auxData)
        return inputArray_,auxInput_

    def buildAutoEncoder(self):
        ##input placeholder
        #matrix input
        #mainInput = Input(shape=(self.width, self.height, self.levels))
        mainInput = Input(shape=(self.width, self.height,1))
        #CNN Network for processing matrix Data
        encoder = Conv2D(32, (3, 3), padding='same',activation ='relu')(mainInput)
        encoder = MaxPooling2D((2, 2))(encoder)
        encoder = Conv2D(16, (3, 3), padding='same',activation ='relu')(encoder)
        encoder = MaxPooling2D((2, 2))(encoder)
        
        decoder = Conv2D(16, (3, 3), padding='same',activation ='relu')(encoder)
        decoder = UpSampling2D((2, 2))(decoder)
        decoder = Conv2D(32, (3, 3), activation='relu', padding='same')(decoder)
        decoder = UpSampling2D((2, 2))(decoder)
        decoder = Conv2D(1, (3, 3), activation='sigmoid', padding='same')(decoder)

        autoencoder = Model(mainInput, decoder)
        autoencoder.compile(optimizer='adadelta', loss='binary_crossentropy')
        return autoencoder

    '''builds a model and compiles it with random weights'''
    def buildNetwork(self):
        ##input placeholder
        #matrix input
        mainInput = Input(shape=(self.width, self.height, 1))
        #meta input (Aka energy level, direction, velocity)
        auxiliaryInput = Input(shape=(self.n_auxData,), name='aux_input')

        #CNN Network for processing matrix Data
        encoder = Conv2D(32, (3, 3), padding='same',activation ='relu')(mainInput)
        encoder = MaxPooling2D((2, 2))(encoder)
        encoder = Conv2D(16, (3, 3), padding='same',activation ='relu')(encoder)
        encoder = MaxPooling2D((2, 2))(encoder)
        
        x = Flatten()(encoder)
        x = Dense(units= 16, activation = 'relu')(x)
        CNNout = Dense(units = 16, activation = 'softmax')(x)
        
        #combine CNN Output with metaInput
        aux = Dense(2, activation='sigmoid')(auxiliaryInput) 
        x = concatenate([CNNout, aux])
        #stack a deep densely-connected network on top
        x = Dense(16, activation='sigmoid')(x) 
        x = Dense(8, activation='sigmoid')(x) 
        dir_x = Dense(2, activation='sigmoid')(x)
        velocity_x = Dense(2, activation='sigmoid')(x)

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
            survivors = random.choices(oldPopulation,k=len(oldPopulation))
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
    def evolveSurvivors(self,weightsDict,population):
        self.trainAutoEncoder()
        for individuum in population:
            self.network.set_weights(weightsDict[individuum])
                 #transfer weights to cnn
            for j in range(self.sharedLayers):
                self.network.layers[j].set_weights( np.array(self.autoencoder.layers[j].get_weights()))
            weightsDict[individuum]=  np.array(self.network.get_weights())
        return weightsDict

    def initializeWeights(self, population):
        self.autoencoder = self.buildAutoEncoder()
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
            weights = np.array(self.network.get_weights())
            newWeights = self.mutateWeights(weights, self.mutationRate)
            modelWeights.append(np.array(newWeights))

        weightsDict = dict(zip(population,modelWeights))
        weightsDict=self.evolveSurvivors(weightsDict,population)
        self.generation = self.generation + 1
        self.Counter = self.Counter = 0 + 1
        self.trainData = []
        return weightsDict
        
    def trainAutoEncoder(self):
            #train
            if len(self.trainData) >= self.batchSize:
                trainX = random.sample(self.trainData,k=self.batchSize)
                testX = random.sample(self.trainData,k=self.batchSize)
            else:
                self.batchSize = len(self.trainData)
                trainX = self.trainData
                testX = trainX
                self.batchSize = len(self.trainData)
            self.autoencoder.fit(np.array(trainX), np.array(trainX),epochs=5,shuffle=True,batch_size=self.batchSize)
            self.autoencoder.save("{}autoencoder.h5".format(self.FilePathModels))
            decoded_imgs = self.autoencoder.predict(np.array(testX))
            n = 10
            plt.figure(figsize=(20, 4))
            for i in range(n):
                  ax = plt.subplot(2, n, i+1)
                  plt.imshow(testX[i].reshape(100, 100))
                  plt.gray()
                  ax.get_xaxis().set_visible(False)
                  ax.get_yaxis().set_visible(False)

                # display reconstruction
                  ax = plt.subplot(2, n, i+1 + n)
                  plt.imshow(decoded_imgs[i].reshape(100, 100))
                  plt.gray()
                  ax.get_xaxis().set_visible(False)
                  ax.get_yaxis().set_visible(False)
                  plt.savefig("{}{}".format(self.FilePathPlot,"autoencoder.png"))
            #plt.show()
   


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
            self.trainData.append(np.reshape(inputArray_,(100,100,1)))
            pred_ = self.prediction(weightsDict[individuum],inputArray_, auxInput_)
            outputDict.update([(individuum,pred_)],)
        return outputDict 

    '''loads model from list with model name'''
    def loadModel(self, population):
        files_path = os.path.join(self.FilePathModels , '*')
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True)
        self.network= load_model('{}{}'.format(self.FilePathModels,"autoencoder.h5"))) 
        models = []
        if files:
            for i in range(len(population)):
                self.network= load_model('{}'.format(random.choice(files)))self.network= load_model('{}'.format(random.choice(files)))
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
