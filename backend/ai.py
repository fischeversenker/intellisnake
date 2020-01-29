import os
#os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
import csv
import json
import pandas as pd
from sklearn.preprocessing import QuantileTransformer
from PIL import Image
from keras.layers import Input, Dense, Conv2D, MaxPooling2D, Flatten, BatchNormalization
from keras.models import Model
import time
import math
# Evolution works as a Black Box Optimization and is based on paper https://arxiv.org/pdf/1703.03864.pdf

class AI():
    def __init__(self):
        self.sigma = 0.1 # noise standard deviation
        self.alpha = 0.00001 
        self.shape = 32 #input size of NN
        self.N = None # dict to store n noiseMatrix
        self.W_try = None # dict to store weights
        self.model = []
        self.IDs = {}
        self.FilePathLog = "./log/"
        self.frameCount = 0
        self.FramesPerEpoch = 300
        self.population = None
        self.entityCentricScaling = 0.5
        self.nonTrainableLayers = [0,2,4,5]

    def startModel(self,dict_):
        self.IDs = dict_
        self.buildModel()

    def runModel(self,matrix,list_):
        if self.population == None:
            self.population = list_
        if self.N == None:
             self.createNoiseMatrix()
        if self.W_try == None:
             self.applyNoise()
        outputDict = self.processFrame(matrix,list_)
        self.frameCount = self.frameCount + 1
        frameProgress = self.frameCount/self.FramesPerEpoch
        return { "prediction": outputDict, "progress": frameProgress }

    def updateModel(self,dict_):
        self.evoleModel(dict_)
        self.population = None
        self.W_try = None
        self.N = None
        self.frameCount = 0

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,3)) #0
        encoder = Conv2D(16, kernel_size=(8, 8), strides = (4,4), padding='same', activation ='selu', kernel_initializer='lecun_normal', bias_initializer='zeros' )(input_) #1
        encoder = MaxPooling2D((2, 2))(encoder) #2
        encoder = Conv2D(32, kernel_size=(4, 4),strides =(2,2), padding='same',activation ='selu', kernel_initializer='lecun_normal', bias_initializer='zeros')(encoder) #3
        encoder = MaxPooling2D((2, 2))(encoder) #4
        x = Flatten()(encoder) #5
        x = Dense(units= 32, activation = 'tanh', kernel_initializer='glorot_uniform', bias_initializer='zeros')(x) #6
        output = Dense(units = 2, activation='tanh', kernel_initializer='glorot_uniform', bias_initializer='zeros')(x) #7 
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])

    def evoleModel(self,dict_):
        A = self.getReward(dict_)
        w = self.getModelWeights()
        N = self.weighting(A,self.N)
        w_add = self.weightedSumWeights(N,w)
        w = w + w_add
        self.model.set_weights(w)

    def getModelWeights(self):
        return np.array(self.model.get_weights())

    def getReward(self,dict_):
        R = list(dict_.values())
        print("{} Units EnergyIntake from {} snakes".format(sum(R), len(R)-R.count(0)))
        keys = list(dict_.keys())
        if sum(R) == 0:
            A = [0 for r in R]
        else:
            A = (R - np.mean(R)) / np.std(R) # map to gaussian distribution
        return dict(zip(keys,A))

    def makePrediction(self,input,element):
        self.model.set_weights(self.W_try[element])
        pred = self.model.predict(input)
        pred_ = [float(pred[0][0]), float(pred[0][1])]
        return pred_

    def weighting(self,A,N):
        for element in list(A.keys()):
            w_weighted = N[element]
            loss = np.array(A[element], dtype = np.float32)
            for i in range(len(w_weighted)):
                if i not in self.nonTrainableLayers:
                    for j in range(len(w_weighted[i])):
                         w_weighted[i][j] = np.reshape(np.dot(w_weighted[i][j], loss), w_weighted[i][j].shape)    
            N[element] = w_weighted
        return N

    def weightedSumWeights(self,N,w):
        w_add = w
        scalingFactor = (self.alpha/len(self.population))*self.sigma
        for i in range(len(w_add)):
            if i not in self.nonTrainableLayers:
                for j in range(len(w[i])):
                    w_add[i][j] = np.zeros(w_add[i][j].shape, dtype = np.float32)
                    for element in list(N.keys()):
                        w_add[i][j] = N[element][i][j] + w_add[i][j]
                    w_add[i][j] = np.reshape(scalingFactor*w_add[i][j], w_add[i][j].shape)   
        return w_add

    def createNoiseMatrix(self):
        w = self.getModelWeights()
        self.N = {}
        for element in self.population:
            n = w
            for i in range(len(w)):
                for j in range(len(w[i])):
                    n[i][j] = np.reshape(np.random.rand(w[i][j].size),w[i][j].shape) #adjust weights layer-wise
            self.N.update([(element,n)],)

    def mutateWeights(self, n):
        w = self.getModelWeights()
        for i in range(len(n)):
            if i not in self.nonTrainableLayers:
                for j in range(len(w[i])):
                    w[i][j] = w[i][j] + self.sigma*np.reshape(n[i][j],w[i][j].shape) #mutate weights of layers 
        return w

    def applyNoise(self):
        self.W_try = {}
        w = self.getModelWeights()
        for element in self.population:
            w_try = self.mutateWeights(self.N[element])
            self.W_try.update([(element,w_try)],)

    def processFrame(self,matrix,list_):
        inputArray = self.preprocessInput(matrix)
        population = list_
        outputDict = {}
        for element in population:
            input =  self.applyMask(inputArray,element)
            pred_ = self.makePrediction(input,element)
            outputDict.update([(element,pred_)],)
        return outputDict

    def reshaping(self,L):
        shape = int(np.sqrt(len(L))) #get len and width of 2dmatrix
        a = np.array(L).reshape(shape, shape, 3)
        img = Image.fromarray(a.astype('uint8'),'RGB')
        img = img.resize((self.shape,self.shape), Image.ANTIALIAS)
        return np.array(img)

    def preprocessInput(self,matrix):
        a = self.reshaping(matrix)
        return (a/255.0)*self.entityCentricScaling

    def applyMask(self,a,x):
        b = np.where(a == (np.array(self.IDs[x])/255)*self.entityCentricScaling, [1,1,1], a)
        return np.reshape(b,(-1 , self.shape, self.shape,3))

    def printFrameCount(self):
        return self.frameCount/self.FramesPerEpoch

    

    
