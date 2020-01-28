import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
import csv
import json
import pandas as pd
from sklearn.preprocessing import QuantileTransformer
from PIL import Image
from keras.layers import Input,Dense, Conv2D, MaxPooling2D, Flatten, BatchNormalization
from keras.models import Model
import time
# Evolution works as a Black Box Optimization and is based on paper https://arxiv.org/pdf/1703.03864.pdf

class AI():
    def __init__(self):
        self.sigma = 0.1 # noise standard deviation
        self.alpha = 0.00001 # learning rate
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
        A_dict = self.getReward(dict_)
        A_dict_ = {i:A_dict[i] for i in self.N.keys()} #assure dicts have same order
        A = list(A_dict_.values())
        N = list(self.N.values())
        w = self.getModelWeights()
        self.evoleNetwork(A,N,w)
        self.population = None
        self.W_try = None
        self.N = None
        self.frameCount = 0

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,3))
        encoder = Conv2D(16, kernel_size=(8, 8),strides = (4,4), padding='same',activation ='relu')(input_)
        encoder = MaxPooling2D((2, 2))(encoder)
        encoder = Conv2D(32, kernel_size=(4, 4),strides =(2,2), padding='same',activation ='relu')(encoder)
        encoder = MaxPooling2D((2, 2))(encoder)
        x = Flatten()(encoder)
        x = Dense(units= 32, activation = 'relu')(x)
        output = Dense(units = 2, activation='tanh')(x) 
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])

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

    def getModelWeights(self):
        return np.array(self.model.get_weights())

    def getReward(self,dict_):
        R = list(dict_.values())
        print("{} Total EnergyIntake with {} contributing".format(sum(R), len(R)-R.count(0)))
        keys = list(dict_.keys())
        if sum(R) == 0:
            A= [0 for r in R]
        else:
            A = (R - np.mean(R)) / np.std(R) # map to gaussian distribution
        return dict(zip(keys,A))

    def evoleNetwork(self,A,N,w):
        for i in range(len(w)):
            n_ = np.dot( np.array(N)[:,i].T,A) #sum up all the rows of noise matrix for each layer and each row is weighted by A
            n_ = np.reshape(n_,w[i].shape)
            w[i] = w[i] + (self.alpha/(len(self.population)*self.sigma))*n_
        self.model.set_weights(w)

    def createNoiseMatrix(self):
        w = self.getModelWeights()
        self.N = {}
        for element in self.population:
            n = [None] * len(w)
            for j in range(len(w)):
                n[j] = np.random.rand(w[j].size) #adjust weights layer-wise
            self.N.update([(element,n)],)

    def mutateWeights(self, n):
        w = self.getModelWeights()
        for i in range(len(n)):
            w[i]= w[i] + self.sigma*np.reshape(n[i],w[i].shape) #mutate weights of layers
        return w

    def applyNoise(self):
        self.W_try = {}
        w = self.getModelWeights()
        for element in self.population:
            w_try = self.mutateWeights(self.N[element])
            self.W_try.update([(element,w_try)],)

    def makePrediction(self,input,element):
        self.model.set_weights(self.W_try[element])
        pred = self.model.predict(input)
        pred_ = [float(pred[0][0]),float(pred[0][1])]
        if pred_[0] == None:
            print("Nan pred!")
        return pred_

    def processFrame(self,matrix,list_):
        inputArray = self.preprocessInput(matrix)
        population = list_
        outputDict = {}
        for element in population:
            input =  self.applyMask(inputArray,element)
            pred_ = self.makePrediction(input,element)
            outputDict.update([(element,pred_)],)
        return outputDict

    def printFrameCount(self):
        return self.frameCount/self.FramesPerEpoch

    

    
