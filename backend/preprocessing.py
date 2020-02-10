import numpy as np

class PREPROCESSING():
    def __init__(self,shape):
        self.shape = shape

    #preprocessing
    def reshaping(self,L):
        return np.array(L).reshape(self.shape, self.shape, 1)

    def preprocessInput(self,matrix):
        return self.reshaping(matrix)

    def applyMask(self,a,x,dict_):
        id_ = dict_[x]
        l = list(dict_.values())
        l.remove(id_)
        b = np.where(a == id_, 255, a)
        c = np.where(np.isin(b, l), 128, b)
        c = c/255
        return np.reshape(c,(-1 , self.shape, self.shape,1))
