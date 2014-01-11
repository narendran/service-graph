from pymongo import Connection
import time
import sys

learningRate = 0.1

db = Connection().service_graph
runningMeanColl = db.runningMean
coll = db.servicemetrics
cursor1 = coll.find({}, tailable=True)
while cursor1.alive:
    try:
    	
        doc = cursor1.next()
        cursor = runningMeanColl.find({'service':doc['service']})
        if ((cursor is not None) or (cursor.count==0)):
        	if(float(doc['calls'])<=0):
        		errorPercent = 0
        	else:
        		errorPercent = float(doc['errors'])/float(doc['calls'])*100
        	runningMeanColl.save({'service':doc['service'],'avgRespTimeMean':doc['avg_resp_ms'],'errorPercentMean': str(errorPercent)})
        	#print doc['service'] + "Avg Mean : " + doc['avg_resp_ms'] +'  ::  Avg Error Percent : ' + str(errorPercent)
        else :
        	oldDoc = cursor.next()
        	if(float(doc['calls'])<=0):
        		newErrorPercent = 0
        	else:
        		newErrorPercent = float(doc['errors'])/float(doc['calls'])*100
        	newAvgResp = float(doc['avg_resp_ms'])
        	calcErrorPercent = float(oldDoc['errorPercentMean'])+learningRate*(newErrorPercent-float(oldDoc['errorPercentMean']))
        	calcAvgResp = float(oldDoc['avgRespTimeMean'])+learningRate*(newAvgResp-float(oldDoc['avgRespTimeMean']))
        	runningMeanColl.save({'_id':oldDoc['_id'],'service':oldDoc['service'],'avgRespTimeMean':str(calcAvgResp),'errorPercentMean': str(calcErrorPercent)})
        	#print doc['service'], "Avg Mean : ", str(calcAvgResp), ' ::  Avg Error : ', str(calcErrorPercent)
        print "in"
    except:
    	print sys.exc_info()
        time.sleep(1)
