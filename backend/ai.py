import os
import glob
#os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import csv
from keras.layers import Input, Dense, Conv2D,MaxPooling2D, Flatten
from keras.models import Model, load_model
from nes import NES
from preprocessing import PREPROCESSING

class AI():
    def __init__(self):
        self.shape = 100 #input size of NN
        self.FramesPerEpoch = 250
        self.FilePathModels = "./models/"
        self.FilePathLogs = "./logs/"
        self.nes = NES()
        self.preprocessing = PREPROCESSING(self.shape)
        self.predictions = None
        self.model = []
        self.IDs = {}
        self.frameCount = 0
        self.population = None
        self.newGeneration = True
        self.Training = True

    def buildModel(self):
        input_ = Input(shape=(self.shape,self.shape,1))
        encoder = Conv2D(4, kernel_size=(7, 7), strides = (4,4), padding='same',activation ='elu', kernel_initializer='zeros', bias_initializer= 'zeros')(input_)
        encoder = Conv2D(8, kernel_size=(3, 3), strides = (4,4), padding='same',activation ='elu', kernel_initializer='zeros', bias_initializer= 'zeros')(encoder)
        encoder = Conv2D(16, kernel_size=(3, 3), strides = (2,2), padding='same',activation ='elu', kernel_initializer='zeros', bias_initializer= 'zeros')(encoder)
        x = Flatten()(encoder)
        x = Dense(units= 128, activation = 'elu',  kernel_initializer='zeros', bias_initializer= 'zeros')(x)
        x = Dense(units= 64, activation = 'elu',  kernel_initializer='zeros', bias_initializer= 'zeros')(x)
        output = Dense(units = 2, activation='tanh', kernel_initializer='zeros', bias_initializer= 'zeros')(x)
        self.model = Model(inputs=[input_], outputs=[output])
        self.model.compile(optimizer='adam', loss='binary_crossentropy',loss_weights=[0.1])
        print(self.model.summary())

    def startModel(self,dict_):
        self.IDs = dict_
        self.buildModel()
        self.nes = self.nes.defineModel(self.model)

    def loadModel(self,dict_):
        self.IDs = dict_
        self.buildModel()
        file_ = self.getLastFile()
        self.model.load_weights('{}{}'.format(self.FilePathModels,file_))
        self.nes = self.nes.defineModel(self.model)
        generation = file_.split(".")[0]
        return int(generation)

    def runModel(self,matrix,list_):
        if self.newGeneration:
            print("\n New Generation")
            print("Size of start population: {}".format(len(list_)))
            self.population = list_
            self.predictions =  {k : [] for k in self.population}
            self.nes.newWeights(self.population)
            self.newGeneration = False
        outputDict = self.predict(matrix,list_,self.Training)
        self.frameCount = self.frameCount + 1
        frameProgress = self.frameCount/self.FramesPerEpoch
        return { "prediction": outputDict, "progress": frameProgress }

    def updateModel(self,dict_):
        if self.Training:
            self.nes.evoleModel(dict_)
            self.model.set_weights(self.nes.getModelWeights())
        self.newGeneration = True
        self.predictions = None
        self.frameCount = 0

    def saveModel(self, generation):
        self.model.save_weights("{}{}.h5".format(self.FilePathModels,str(generation)))

    ##helpers
    def predict(self,matrix,list_,Training):
        inputArray = self.preprocessing.preprocessInput(matrix)
        population = list_
        outputDict = {}
        for element in population:
            input =  self.preprocessing.applyMask(inputArray,element,self.IDs)
            pred = self.nes.makePrediction(input,element,Training)
            pred_ = self.reshapePred(pred)
            self.storePrediction(pred_,element)
            outputDict.update([(element,pred_)],)
        return outputDict

    def reshapePred(self,pred):
        return [round(float(pred[0][0]),2), round(float(pred[0][1]),2)]

    def storePrediction(self,pred_,element):
        l =self.predictions[element]
        l.append(pred_)
        self.predictions[element] = l

    def printFrameCount(self):
        return self.frameCount/self.FramesPerEpoch

    def getLastFile(self):
        files_path = os.path.join(self.FilePathModels , '*')
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True)
        files = sorted(glob.iglob(files_path), key=os.path.getctime, reverse=True)
        file_  =str(files[0]).split('\\')[1]
        return file_

    def logging(self,dict_):
        with open (self.FilePathLogs+"logs.csv",'a') as file:
            file.write(str(dict_)+'\n')
