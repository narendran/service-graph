var express = require("express"), app = express(), fs = require('fs'), redis = require('redis'), http = require('http'), url = require('url')
var server = http.createServer(app), io = require('socket.io').listen(server);

io.set('log level', 1);
var globalIOSocket;
// Talks to websocket on client side
io.sockets.on('connection', function (socket) {
		// socket.emit('serviceconfig', { hello: 'world' });
		globalIOSocket = socket;
	});


// MongoDB connection variables
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
// Redis subscriber
client_sc = redis.createClient(null, '137.110.52.123')
client_sc.on("message", function (channel, message) {
    //console.log("Service_Config listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('serviceconfigs');
	    msgJson = JSON.parse(message)	
		collection.insert({'serviceName':msgJson.serviceName, 'version' : msgJson.version, 'clients' : msgJson.clients}, function(){}); 
		if(globalIOSocket)
			globalIOSocket.emit('serviceconfig', msgJson);
	});
client_sc.subscribe("serviceconfig");

// Redis subscriber
client_sm = redis.createClient(null, '137.110.52.123')
client_sm.on("message", function (channel, message) {
    //console.log("Service_Metrics listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('servicemetrics');
	    msgJson = JSON.parse(message)	

      collection.insert(msgJson, function(){});
		//collection.insert({'service':msgJson.service, 'calls' : msgJson.calls, 'total_resp_ms' : msgJson.clients, "errors" : msgJson.errors, 'avg_resp_ms': msgJson.avg_resp_ms, 'timestamp': msgJson.timestamp}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D
		if(globalIOSocket)
			globalIOSocket.emit('servicemetrics', msgJson);

});
client_sm.subscribe("servicestats");

client_cm = redis.createClient(null, '137.110.52.123')
client_cm.on("message", function (channel, message) {
   // console.log("Client_Metrics listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('clientmetrics');
	    msgJson = JSON.parse(message)	
      	collection.insert(msgJson, function(){});
		  // collection.insert({'service':msgJson.service, 'calls' : msgJson.calls, 'total_resp_ms' : msgJson.clients, "errors" : msgJson.errors, 'avg_resp_ms': msgJson.avg_resp_ms}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D

		if(globalIOSocket)
			globalIOSocket.emit('clientmetrics', msgJson);

});
client_cm.subscribe("clientstats");

});


server.listen(8000);

app.configure(function(){
  app.use(express.static(__dirname + '/'));
  app.use(express.errorHandler({
    dumpExceptions: true, 
    showStack: true
  }));
});

app.get("/", function handler (req, res) {
	//console.log(req.url);

	// if(req.url=='/addService'){
	// 	var node = graphdb.createNode({hello: 'world'});     // instantaneous, but...
	// 	node.save(function (err, node) {    // ...this is what actually persists.
	// 	    if (err) {
	// 	        console.error('Error saving new node to database:', err);
	// 	    } else {
	// 	        console.log('Node saved to database with id:', node.id);
	//     }
	// 	});
	// }
	// else {
	fs.readFile(__dirname + '/index.html', function (err, data) {
		if (err) {
			res.writeHead(500);
			return res.end('Error loading index.html');
		}

		res.writeHead(200);
		res.end(data);
	});
});

app.get("/metrics/service/:service", function handler(req,res){
	dp = [];
	MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
		var collection = db.collection('servicemetrics');
		var date = new Date() - 24 * 60 * 60 * 1000;
		collection.find({
	 		timestamp: {
	   			$gte: date
	  		},
	  		service: req.params.service
		}, function(err, cursor) {
				cursor.toArray(function(err, docs){
					for(i=0;i<docs.length;i++){
						dp.push(docs[i]['avg_resp_ms']);
					}
					console.log(dp);
					res.end(JSON.stringify(dp));
				});
          });
	});
	res.writeHead(200,{'Content-Type':'text/plain'});
});

app.get("/configs", function handler(req,res){
	dp =[];
	MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
		var collection = db.collection('serviceconfigs');
		collection.find().toArray(function(err, docs) {
					for(i=0;i<docs.length;i++){
						dp.push(docs[i]);
					}
					console.log(dp);
					res.writeHead(200,{"Content-Type" : "text/plain"});
					res.end(JSON.stringify(dp));
				});
          });
	});


app.get('/metrics/service/:service/dc/:dc', function(req, res) {
    console.log(req.params.service, req.params.dc);
    res.writeHead(200,{'Content-Type':'application/json'});
    //res.send('Hello world!');

    MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
      var collection = db.collection('servicemetrics');
      var timestamp24HoursAgo = new Date() - 24 * 60 * 60 * 1000;
      collection.group(['timestamp'],
        {'timestamp': {$gte: timestamp24HoursAgo},
	  		 'service': req.params.service,
         'instance': {$regex: req.params.dc + '/.*'}},
        {'value': 0, 'count': 0},
        function(obj, prev) {
            prev.count += obj.calls;
            prev.value += obj.total_resp_ms;
        },
        true,
        function(err, grouped_value) {
          if (err) {
            console.error(err);
          }
          console.log(grouped_value);
          var values = [];
          for (var i = 0; i < grouped_value.length; i ++) {
            var value = grouped_value[i];
            values.push(value.value/value.count);
          }
          res.end(JSON.stringify(values));
        }
      );

    });
});


app.get('/metrics/service/:service/client/:client', function(req, res) {
    console.log(req.params.service, req.params.client);
    res.writeHead(200,{'Content-Type':'application/json'});
    //res.send('Hello world!');

    MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
      var collection = db.collection('clientmetrics');
      var timestamp24HoursAgo = new Date() - 24 * 60 * 60 * 1000;
      collection.group(['timestamp'],
        {'timestamp': {$gte: timestamp24HoursAgo},
         'client': {$regex: req.params.service + '/' + req.params.client}},
        {'value': 0, 'count': 0},
        function(obj, prev) {
            prev.count += obj.calls;
            prev.value += obj.total_resp_ms;
        },
        true,
        function(err, grouped_value) {
          if (err) {
            console.error(err);
          }
          console.log(grouped_value);
          var values = [];
          for (var i = 0; i < grouped_value.length; i ++) {
            var value = grouped_value[i];
            values.push(value.value/value.count);
          }
          res.end(JSON.stringify(values));
        }
      );

    });
});
