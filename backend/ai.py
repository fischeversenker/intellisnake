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

# Evolution works as a Black Box Optimization and is based on paper https://arxiv.org/pdf/1703.03864.pdf

class AI():
    def __init__(self):
        # hyperparameters
        self.N = None # dict to store n noiseMatrix
        self.W_try = None # dict to store weights
        self.epoch = pd.DataFrame() # dataframe to store rewards per epoch
        self.sigma = 0.1 # noise standard deviation
        self.alpha = 0.000001 # learning rate
        self.shape = 100
        self.model = []
        self.IDs = {}
        self.FilePathLog = "./log/"
        self.frameCount = 0
        self.FramesPerEpoch = 20
        self.masks = None
        self.population = None

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,3))
        encoder = Conv2D(16, kernel_size=(8, 8),strides = (4,4), padding='same',activation ='relu')(input_)
        encoder = MaxPooling2D((2, 2))(encoder)
        encoder = Conv2D(32, kernel_size=(4, 4),strides =(2,2), padding='same',activation ='relu')(encoder)
        encoder = MaxPooling2D((2, 2))(encoder)
       
        x = Flatten()(encoder)
        x = Dense(units= 64, activation = 'tanh')(x)
        x = Dense(units= 1, activation = 'tanh')(x)

        output = Dense(units = 2, activation='tanh')(x) 
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])

    def reshaping(self, inputArray):
        shape = int(np.sqrt(len(inputArray))) #get len and width of 2dmatrix
        inputArray = np.array(inputArray).reshape(-1, 3)
        inputArray = np.array(inputArray).reshape(shape, shape, 3)
        return inputArray

    def createMask(self,inputArray,list_):
        self.masks = {}
        for element in list_:
            mymask = inputArray ==[ self.IDs[element]]
            self.masks.update([(element,mymask)],)

    def applyMask(self,inputArray,mask):
        np.place(inputArray, mask, [1,1,1]) #set values where mask is true to 1
        inputArray_ = np.reshape(inputArray,(-1 , self.shape, self.shape,3)) #reshape to keras input
        return inputArray_

    def preprocessInput(self,matrix,list_):
        inputArray = self.reshaping(matrix)
        self.createMask(inputArray,list_)
        inputArray= (inputArray/255.0)*0.9 #assure distance to currently controlled snake
        return inputArray

    def getModelWeights(self):
        return np.array(self.model.get_weights())

    def getReward(self,dict_):
        R = list(dict_.values())
        keys = list(dict_.keys())
        print("total energyIntake: {}".format(sum(R)))
        if sum(R) == 0:
            R= [np.random.rand() for r in R]
        A = (R - np.mean(R)) / np.std(R) # map to gaussian distribution
        A = dict(zip(keys,A))
        return A

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
    
    def printFrameCount(self):
        return self.frameCount/self.FramesPerEpoch

    def startModel(self,dict_):
        self.IDs = dict_
        self.buildModel()

    def runModel(self,matrix,list_):
        if self.population == None:
            print("got {} snakes...".format(len(list_)))
            self.population = list_
        if self.N == None:
             self.createNoiseMatrix()
        if self.W_try == None:
             self.applyNoise()

        population = list_
        outputDict = {}
        
        inputArray = self.preprocessInput(matrix,population)
        
        for element in population:
          input = self.applyMask(inputArray,self.masks[element])
          pred_ = self.makePrediction(input,element)
    
          outputDict.update([(element,pred_)],)

        self.frameCount = self.frameCount + 1
        frameProgress = self.frameCount/self.FramesPerEpoch
        return {
                "prediction": outputDict,
                "progress": frameProgress
               }

    def updateModel(self,dict_):
        w = self.getModelWeights()
      
        A_dict = self.getReward(dict_)
        A_dict_ = {i:A_dict[i] for i in self.N.keys()} #assure dicts have same order
     
        A = list(A_dict_.values())
        N = list(self.N.values())

        for i in range(len(w)):
            n_ = np.dot( np.array(N)[:,i].T,A) #sum up all the rows of noise matrix for each layer and each row is weighted by A
            n_ = np.reshape(n_,w[i].shape)
            w[i] = w[i] + (self.alpha/(len(self.population)*self.sigma))*n_

        self.model.set_weights(w)
        self.population = None
        self.W_try = None
        self.N = None
        self.frameCount = 0

    
