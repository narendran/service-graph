var express = require("express"), app = express(), fs = require('fs'), neo4j = require('neo4j'), redis = require('redis'), http = require('http'), url = require('url')
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
client_sc = redis.createClient()
client_sc.on("message", function (channel, message) {
    //console.log("Service_Config listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('serviceconfigs');
	    msgJson = JSON.parse(message)	
		collection.insert({'serviceName':msgJson.serviceName, 'version' : msgJson.version, 'clients' : msgJson.clients}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D
		if(globalIOSocket)
			globalIOSocket.emit('serviceconfig', msgJson);
	});
client_sc.subscribe("serviceconfig");

// Redis subscriber
client_sm = redis.createClient()
client_sm.on("message", function (channel, message) {
    //console.log("Service_Metrics listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('servicemetrics');
	    msgJson = JSON.parse(message)	
		collection.insert({'service':msgJson.service, 'calls' : msgJson.calls, 'total_resp_ms' : msgJson.clients, "errors" : msgJson.errors, 'avg_resp_ms': msgJson.avg_resp_ms, 'timestamp': msgJson.timestamp}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D
		if(globalIOSocket)
			globalIOSocket.emit('servicemetrics', msgJson);

});
client_sm.subscribe("servicestats");

client_cm = redis.createClient()
client_cm.on("message", function (channel, message) {
   // console.log("Client_Metrics listener : channel " + channel + ": " + message + ". Writing to MongoDB");
	    if(err) throw err;
	    var collection = db.collection('clientmetrics');
	    msgJson = JSON.parse(message)	
		collection.insert({'service':msgJson.service, 'calls' : msgJson.calls, 'total_resp_ms' : msgJson.clients, "errors" : msgJson.errors, 'avg_resp_ms': msgJson.avg_resp_ms}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D
		if(globalIOSocket)
			globalIOSocket.emit('clientmetrics', msgJson);

});
client_cm.subscribe("clientstats");

});

var graphdb = new neo4j.GraphDatabase('http://localhost:7474');

server.listen(80);

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

app.get("/metrics/service", function handler(req,res){
	dp = [];
	urlparts = url.parse(req.url);
	MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
		var collection = db.collection('servicemetrics');
		var lastHour = new Date();
  		lastHour.setHours(lastHour.getHours()-1);
  		console.log(lastHour);
		collection.find({
	 		'timestamp': {
	   			$gte: lastHour
	  		},
	  		'service': urlparts.query.SERVICE
		}, function(err, cursor) {
				console.log(arguments);
                cursor.each(function(err, item) {
                  if(item != null) {
                          dp.push(item.avg_resp_ms);
                  }
              });
              console.log(dp);
          });
	});
	res.writeHead(200,{'Content-Type':'text/html'});
	res.end(dp);
});


