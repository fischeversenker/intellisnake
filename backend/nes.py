import numpy as np
from keras.models import Model

class NES():
    # Evolution works as a Black Box Optimization and is based on paper https://arxiv.org/pdf/1703.03864.pdf
    def __init__(self):
        self.model = None
        self.sigma = 0.1 # noise standard deviation
        self.alpha = 0.1

    def defineModel(self,model):
        self.model = model
        return self

    def getModelWeights(self):
        return np.array(self.model.get_weights())

    def newWeights(self,list_):
        self.createNoiseMatrix(list_)
        self.applyNoise(list_)

    def evoleModel(self,dict_):
        if len(np.unique(np.array(list(dict_.values())))) == 0:
            pass
        else:
            A = self.getReward(dict_)
            w = self.getModelWeights()
            N = self.weighting(A,self.N)
            w_add = self.weightedSumWeights(N,w,len(A))
            w = w + w_add
            self.model.set_weights(w)

    def makePrediction(self,input,element,Training):
        if Training:
            self.model.set_weights(self.W_try[element])
        pred = self.model.predict(input)
        return pred

    ##helpers
    # noise
    def createNoiseMatrix(self,list_):
        w = self.getModelWeights()
        self.N = {}
        for element in list_:
            n = w
            for i in range(len(w)):
                for j in range(len(w[i])):
                    n[i][j] = np.reshape(np.random.normal(size=w[i][j].size),w[i][j].shape) #adjust weights layer-wise
            self.N.update([(element,n)],)

    def mutateWeights(self, n):
        w = self.getModelWeights()
        for i in range(len(n)):
            for j in range(len(w[i])):
                w[i][j] = w[i][j] + self.sigma*np.reshape(n[i][j],w[i][j].shape) #mutate weights of layers
        return w

    def applyNoise(self,list_):
        self.W_try = {}
        w = self.getModelWeights()
        for element in list_:
            w_try = self.mutateWeights(self.N[element])
            self.W_try.update([(element,w_try)],)

    #weight adjustment
    def getReward(self,dict_):
        R = list(dict_.values())
        keys = list(dict_.keys())
        if sum(R) == 0:
            A = [0 for r in R]
        else:
            A = (R - np.mean(R)) / (np.std(R) + 0.00001) # map to gaussian distribution
        return  dict(zip(keys,A))

    def weighting(self,A,N):
        for element in list(A.keys()):
            w_weighted = N[element]
            loss = np.array(A[element], dtype = np.float64)
            for i in range(len(w_weighted)):
                    for j in range(len(w_weighted[i])):
                            w_weighted[i][j] = np.reshape(np.dot(w_weighted[i][j], loss), w_weighted[i][j].shape)
            N[element] = w_weighted
        return N

    def weightedSumWeights(self,N,w,npop):
        w_add = w
        scalingFactor = (self.alpha/npop)*self.sigma
        for i in range(len(w_add)):
                for j in range(len(w[i])):
                    w_add[i][j] = np.zeros(w_add[i][j].shape, dtype = np.float64)
                    for element in list(N.keys()):
                        w_add[i][j] = N[element][i][j] + w_add[i][j]
                    w_add[i][j] = np.reshape(scalingFactor*w_add[i][j], w_add[i][j].shape)
                    if np.isfinite(w_add[i][j]).any():
                        pass
                    else:
                         print("Non finite values in Weights")
        return w_add
