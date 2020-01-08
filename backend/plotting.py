import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import glob
import os
import time

FilePathLog = "./log/"
FilePathPlot = "./plots/"
windowsSize = 100 # rolling mean over the n last periods
import glob
import os
def getLatestLog(FilePathLog):
    files_path = os.path.join(FilePathLog , '*')
    files = sorted(
        glob.iglob(files_path), key=os.path.getctime, reverse=True) 

    return files[0]

def loadLog(log,windowsSize):
    df = pd.read_csv(log,header=None, names=['generation', 'EnergyConsumption'])
    df["MovingAverage"] = df["EnergyConsumption"].rolling(windowsSize,min_periods=1).mean()
    return df

while True:
    log = getLatestLog(FilePathLog)
    print(log)
    df = loadLog(log,windowsSize)   
    print(df.head())
    print(df.columns)
    fig = plt.figure()
    ax = plt.axes()
    ax.plot("generation","EnergyConsumption",data = df,color='blue',label='consumed Energy')
    ax.plot("generation","MovingAverage",data = df,color='red',label='Moving Average over {} generations'.format(windowsSize))
    ax.legend()
    plt.title("EnergyConsumption per Generation")
    plt.grid(b=True, which='major', color='#666666', linestyle='-')
    plt.savefig("{}{}".format(FilePathPlot,"log.png"))
    time.sleep(60)

