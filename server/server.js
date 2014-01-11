var express = require("express"), app = express(), io = require('socket.io').listen(app), fs = require('fs'), neo4j = require('neo4j'), redis = require('redis')

// MongoDB connection variables
var MongoClient = require('mongodb').MongoClient, format = require('util').format;

// Redis subscriber
client_sc = redis.createClient()
client_sc.on("message", function (channel, message) {
    console.log("Service_Config listener : channel " + channel + ": " + message + ". Writing to MongoDB");
    MongoClient.connect('mongodb://127.0.0.1:27017/service_graph', function(err, db) {
	    if(err) throw err;
	    var collection = db.collection('serviceconfigs');
	    msgJson = JSON.parse(message)	
		collection.insert({'serviceName':msgJson.serviceName, 'version' : msgJson.version, 'clients' : msgJson.clients}, function(){}); // Inserting the ramble and the time when the ramble was rambled! :D
	});
});
client_sc.subscribe("serviceconfig");

var graphdb = new neo4j.GraphDatabase('http://localhost:7474');

app.listen(80);

app.configure(function(){
  app.use(express.static(__dirname + '/'));
  app.use(express.errorHandler({
    dumpExceptions: true, 
    showStack: true
  }));
});

app.get("/", function handler (req, res) {
	console.log(req.url);

	if(req.url=='/addService'){
		var node = graphdb.createNode({hello: 'world'});     // instantaneous, but...
		node.save(function (err, node) {    // ...this is what actually persists.
		    if (err) {
		        console.error('Error saving new node to database:', err);
		    } else {
		        console.log('Node saved to database with id:', node.id);
	    }
		});
	}
	else {
		fs.readFile(__dirname + '/index.html', function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading index.html');
			}

			res.writeHead(200);
			res.end(data);
		});
	}
});

// io.sockets.on('connection', function (socket) {
// 	socket.emit('news', { hello: 'world' });
// 	socket.on('my other event', function (data) {
// 		console.log(data);
// 	});
// });
