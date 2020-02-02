import os
import glob
#os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
import csv
import json
import pandas as pd
from sklearn.preprocessing import QuantileTransformer
from PIL import Image
from keras.layers import Input, Dense, Conv2D,MaxPooling2D, Flatten, BatchNormalization
from keras.models import Model, load_model
from keras.initializers import Constant
from keras.constraints import MinMaxNorm
import time
import math

# Evolution works as a Black Box Optimization and is based on paper https://arxiv.org/pdf/1703.03864.pdf

class AI():
    def __init__(self):
        self.sigma = 0.1 # noise standard deviation
        self.alpha = 0.1 
        self.shape = 32 #input size of NN
        self.N = None # dict to store n noiseMatrix
        self.W_try = None # dict to store weights
        self.predictions = None
        self.model = []
        self.IDs = {}
        self.FilePathModels = "./models/"
        self.frameCount = 0
        self.FramesPerEpoch = 300
        self.population = None
        self.entityCentricScaling = 0.1
        self.nonTrainableLayers = []
        
    def startModel(self,dict_):
        self.IDs = dict_
        self.buildModel()

    def loadModel(self,dict_):
        self.IDs = dict_
        self.buildModel()
        file_ = self.getLastFile()
        self.model.load_weights('{}{}'.format(self.FilePathModels,file_))
        generation = file_.split(".")[0]
        return int(generation)

    def runModel(self,matrix,list_):
        if self.population == None:
            self.population = list_
        if self.predictions == None:
            self.predictions =  {k : [] for k in self.population}
        if self.N == None:
             print("\n New Generation")
             print("Size of start population: {}".format(len(list_)))
             self.createNoiseMatrix()
        if self.W_try == None:
             self.applyNoise()
        outputDict = self.processFrame(matrix,list_)
        self.frameCount = self.frameCount + 1
        frameProgress = self.frameCount/self.FramesPerEpoch
        return { "prediction": outputDict, "progress": frameProgress }

    def saveModel(self, generation):
        self.model.save_weights("{}{}.h5".format(self.FilePathModels,str(generation)))

    def updateModel(self,dict_):
        self.evoleModel(dict_)
        #self.population = None
        self.W_try = None
        self.N = None
        self.predictions = None
        self.frameCount = 0

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,3)) #0
        encoder = Conv2D(8, kernel_size=(7, 7), strides = (4,4), padding='same',activation ='selu', kernel_initializer='lecun_normal', bias_initializer= Constant(0.01) )(input_) #1 change to lecun_normal for selu
        x = Conv2D(32, kernel_size=(3, 3),strides =(4,4), padding='same',activation ='selu', kernel_initializer='lecun_normal', bias_initializer= Constant(0.01))(encoder) #3
        x = Flatten()(x) #4
        x = Dense(units= 128, activation = 'tanh', kernel_initializer='glorot_uniform', bias_initializer='zeros')(x) #5
        x = Dense(units= 64, activation = 'tanh', kernel_initializer='glorot_uniform', bias_initializer='zeros')(x) #6
        output = Dense(units = 2, activation='tanh', kernel_initializer='glorot_uniform', bias_initializer= 'zeros')(x) #7
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])
        print(self.model.summary())

    def sumRewards(self,A,B):
        for element in A:
            A[element] = A[element] + B[element]
        R = list(A.values())
        keys = list(A.keys())
        A = (R - np.mean(R)) / (np.std(R)-0.000001)
        return dict(zip(keys,A))

    def evoleModel(self,dict_):
        A = self.getReward(dict_)
        B = self.diversityReward(self.predictions)
        C = self.sumRewards(A, B)
        if sum(list(A.values())) == 0:
            pass
        else:
            w = self.getModelWeights()
            N = self.weighting(C,self.N)
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
        return  dict(zip(keys,A))

    def diversityReward(self,dict_):
        for element in dict_:
            dict_[element] = len(np.unique(np.around(np.array(dict_[element]),decimals =0), axis=0))/len(np.array(dict_[element]))
        R = list(dict_.values())
        print("Unique actions per snake: {}%".format(round((sum(R)/len(self.population))*100),4))
        keys = list(dict_.keys())
        A = (R - np.mean(R)) / (np.std(R) - 0.00001)
        return dict(zip(keys,A))
   
    def storePrediction(self,pred_,element):
        l =self.predictions[element]
        l.append(pred_)
        self.predictions[element] = l 

    def makePrediction(self,input,element):
        self.model.set_weights(self.W_try[element])
        pred = self.model.predict(input)
        pred_ = [round(float(pred[0][0]),2), round(float(pred[0][1]),2)]
        if str(pred_[0]) == 'nan' or str(pred_[1]) == 'nan':
            print("ALERT NAN")
        self.storePrediction(pred_,element)
        return pred_

    def weighting(self,A,N):
        for element in list(A.keys()):
            w_weighted = N[element]
            loss = np.array(A[element], dtype = np.float64)
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
                    w_add[i][j] = np.zeros(w_add[i][j].shape, dtype = np.float64)
                    for element in list(N.keys()):
                        w_add[i][j] = N[element][i][j] + w_add[i][j]
                    w_add[i][j] = np.reshape(scalingFactor*w_add[i][j], w_add[i][j].shape)   
                    if 0 == np.sum(w_add[i][j]):
                        print("weights with zeros only i: {} j: {}".format(i,j))
                    if np.isfinite(w_add[i][j]).any():
                        pass
                    else:
                         print("Non finite values in Weights")            
        return w_add

    def createNoiseMatrix(self):
        w = self.getModelWeights()
        self.N = {}
        for element in self.population:
            n = w
            for i in range(len(w)):
                for j in range(len(w[i])):
                    n[i][j] = np.reshape(np.random.normal(size=w[i][j].size),w[i][j].shape) #adjust weights layer-wise
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
        a = (a/255.0)*self.entityCentricScaling
        b = np.where(a == (np.array([234, 123, 198])/255)*self.entityCentricScaling, [0.5,0.5,0.5], a) #food color
        return b

    def applyMask(self,a,x):
        b = np.where(a == (np.array(self.IDs[x])/255)*self.entityCentricScaling, [1,1,1], a)
        return np.reshape(b,(-1 , self.shape, self.shape,3))

    def printFrameCount(self):
        return self.frameCount/self.FramesPerEpoch

    def getLastFile(self):
        files_path = os.path.join(self.FilePathModels , '*')
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True) 
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True)
        file_  =str(files[0]).split('\\')[1]
        return file_

    

    
