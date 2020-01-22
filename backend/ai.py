import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
import csv
import pandas as pd
from sklearn.preprocessing import QuantileTransformer
from PIL import Image
from keras.layers import Input,Dense, Conv2D, MaxPooling2D, Flatten, BatchNormalization
from keras.models import Model

# Based on paper https://arxiv.org/pdf/1703.03864.pdf

class AI():
    def __init__(self):
        # hyperparameters
        self.npop = None # population size
        self.N = None # list to store n noiseMatrix
        self.W_try = None # list to store weights
        self.epoch = pd.DataFrame() # dataframe to store rewards per epoch
        self.sigma = 0.01 # noise standard deviation
        self.alpha = 0.0001 # learning rate
        self.shape = 32
        self.levels = 4
        self.model = []
        self.FilePathLog = "./log/"
        np.random.seed(1337)

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,1))
        encoder = Conv2D(32, (3, 3), padding='same',activation ='relu')(input_)
        encoder = MaxPooling2D((2, 2))(encoder)
        encoder = Conv2D(16, (3, 3), padding='same',activation ='relu')(encoder)
        encoder = MaxPooling2D((2, 2))(encoder)
        x = BatchNormalization()(encoder)
        x = Flatten()(encoder)
        x = Dense(units= 1024, activation = 'selu')(x)
        x = Dense(512, activation='selu')(x) 
        x = Dense(256, activation='selu')(x) 
        output = Dense(units = 2, activation='tanh')(x) 
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])

    def getSingleInput(self,data,id):
        return data[data["id"] == id]

    def reshaping(self, inputArray):
        shape = int(np.sqrt(len(inputArray)))
        inputArray_ = np.reshape(inputArray,(shape, shape))
        inputArray_ = Image.fromarray(inputArray_, 'L')
        inputArray_ = inputArray_.resize((self.shape,self.shape))
        inputArray_ = np.array(inputArray_)
        inputArray_ = np.reshape(inputArray_,(-1 , self.shape, self.shape,1))
        return inputArray_

    def preprocessInput(self,data_):
        inputArray = np.array(data_["matrix"].values[0])
        inputArray = inputArray/self.levels
        inputArray = self.reshaping(inputArray)
        return inputArray

    def getModelWeights(self):
        return np.array(self.model.get_weights())

    def getReward(self):
        R = self.epoch["energyIntake"].tolist()
        if sum(R) == 0:
            A = len(R) * [1]
        else:
            A = (R - np.mean(R)) / np.std(R) 
        return A

    def createNoiseMatrix(self):
        w = self.getModelWeights()
        self.N = [None] * self.npop
        for i in range(self.npop):
            n = [None] * len(w)
            for j in range(len(w)):
                n[j] = np.random.randn(w[j].size)
            self.N[i] = n
       
    def mutateWeights(self, n):
        w = self.getModelWeights()
        for i in range(len(n)):
            w[i]= w[i] + self.sigma*np.reshape(n[i],w[i].shape)
        return w

    def applyNoise(self):
        self.W_try = []
        w = self.getModelWeights()
        for i in range(self.npop):
            w_try = self.mutateWeights(self.N[i]) 
            self.W_try.append(w_try)  
       
    def updateModel(self):
        w = self.getModelWeights()
        A = self.getReward()
        for i in range(len(w)):
            n_ = np.dot(  np.array(self.N)[:,i].T,A)
            n_ = np.reshape(n_,w[i].shape)
            w[i] = w[i] + (self.alpha/(self.npop*self.sigma))*n_
        self.model.set_weights(w)
        self.npop = None
        self.W_try = None
        self.N = None
        self.epoch = pd.DataFrame()
    
    def makePrediction(self,i,inputArray):
        self.model.set_weights(self.W_try[int(i)])
        pred = self.model.predict(inputArray)
        pred_ = [float(pred[0][0]),float(pred[0][1])]
        return pred_
             
    def runModel(self,data):
        self.storeEpoch(data)
        if self.npop == None:
            self.npop = len(data)
        if self.N == None:
             self.createNoiseMatrix()
        if self.W_try == None:
             self.applyNoise()
        outputDict = {}
        for id in data["id"]:
          data_  = self.getSingleInput(data,id)
          inputArray = self.preprocessInput(data_)
          pred_ = self.makePrediction(id,inputArray)
          outputDict.update([(id,pred_)],)
        return outputDict

    def storeEpoch(self,data):
        if self.epoch.empty:
            self.epoch = data
        else:
            for id in data["id"]:
                df = self.epoch[self.epoch["id"]==id]
                df_ = data[data["id"]==id]
                sum_ = df["energyIntake"] + df_["energyIntake"]
                self.epoch.loc[self.epoch.id == id, 'energyIntake'] = sum_

    def logging(self,generation):
        log =[generation,sum(self.epoch["energyIntake"])]
        print("Generation: {}, Overall EnergyIntake: {}".format(log[0],log[1]))
        try:
            with open('{}log.csv'.format(self.FilePathLog), 'a') as f:
                writer = csv.writer(f)
                writer.writerow(log)
        except IOError:
            with open('{}log.csv'.format(self.FilePathLog), 'w') as f:
                writer = csv.writer(f)
                writer.writerow(log)
        f.close()


        