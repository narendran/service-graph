var express = require('express');
var app = express();
var sleep = require('sleep');
var redis = require('redis');
var jsonfile = require('jsonfile');
var http = require('http');
var Futures = require('futures');

var STATS_REFRESH_INTERVAL_MSEC = 2000;
var CHANNEL_SERVICECONFIG = 'serviceconfig';
var CHANNEL_SERVICESTATE = 'servicestats';
var CHANNEL_CLIENTSTATS = 'clientstats';
var DEFAULT_DELAY_MS = 50000;

var delay = DEFAULT_DELAY_MS;

var configFile = null;

if (process.argv.length < 3) {
  console.error('ERROR: Configfile not passed.');
  console.log('Usage: ', process.argv[0], process.argv[1], 'configfile');
  return;
}

configFile = __dirname + '/' + process.argv[2];
config = jsonfile.readFileSync(configFile);
config.port = config.addr.port || 3000;
config.clients = config.clients || [];

console.log(config);

var mqClient = redis.createClient(null, 'localhost');

var ownStats = {
  'instance': getHierAddr(config.addr),
  'service': config.service_name,
  'calls': 0,
  'total_resp_ms': 0,
  'errors': 0,
  'avg_resp_ms': 0
};

var clientStats = [];
var logEntries = [];

function getHierAddr(addr) {
  return addr.dc + '/' + getPQDN(addr);
}

function getPQDN(addr) {
  return addr.host + ':' + addr.port;
}

function purgeOldLogs() {
  var currentTime = new Date();
  var deadline = currentTime - STATS_REFRESH_INTERVAL_MSEC;
  while (logEntries.length > 0) {
    var logEntry = logEntries[0];
    if (logEntry.timestamp >= deadline) {
      break;
    }

    ownStats.calls --;
    ownStats.total_resp_ms -= logEntry.resp_ms;
    ownStats.errors -= logEntry.errors;

    for (var i = 0; i < logEntry.client_requests.length; i ++) {
      var client = logEntry.client_requests[i];
      var stat = clientStats[client.service_name];
      if (!stat) {
        console.error("ClientStats object not found");
        continue;
      }
      stat.calls --;
      stat.total_resp_ms -= client.resp_ms;
      stat.errors -= client.errors;
    }

    logEntries.shift();   // Remove from head of queue
  }
}

function statsRefresher() {
  purgeOldLogs();
  if (ownStats.calls > 0) {
    ownStats.avg_resp_ms = ownStats.total_resp_ms / ownStats.calls;
  } else {
    ownStats.avg_resp_ms = 0.0;
  }

  var current_time = new Date().getTime();
  ownStats.timestamp = current_time;
  mqClient.publish(CHANNEL_SERVICESTATE, JSON.stringify(ownStats));

  for (var svc in clientStats) {
    var stat = clientStats[svc];
    if (stat.calls > 0) {
      stat.avg_resp_ms = stat.total_resp_ms / stat.calls;
    } else {
      stat.avg_resp_ms = 0.0;
    }
    stat.timestamp = current_time;
    mqClient.publish(CHANNEL_CLIENTSTATS, JSON.stringify(stat));
  }

  if (logEntries.length > 0) {
    for (var svc in clientStats) {
      var stat = clientStats[svc];
      console.log(stat);
    }
    console.log(ownStats);
    // console.log(logEntries);
  }
}

function logRequest(resp_ms, client_requests, errors) {
  var logEntry = {
    'timestamp': new Date(),
    'resp_ms': resp_ms,
    'client_requests': client_requests,
    'errors': errors
  };

  logEntries.push(logEntry);
  ownStats.calls ++;
  ownStats.total_resp_ms += resp_ms;
  ownStats.errors += errors;

  for (var i = 0; i < client_requests.length; i ++) {
    var client = client_requests[i];
    var stat = clientStats[client.service_name];
    if (!stat) {
      console.log(client);
      stat = clientStats[client.service_name] = {
        'service': client.service_name,
        'client': config.service_name + '/' + client.client_name,
        'service_instance': client.service_instance,
        'client_instance': getHierAddr(config.addr),
        'calls': 0,
        'total_resp_ms': 0,
        'errors': 0,
        'avg_resp_ms': 0
      };
    }

    stat.calls ++;
    stat.total_resp_ms += client.resp_ms;
    stat.errors += client.errors;
  }
}

function handleClient(client, seq, err, op, clientReqs) {
  var options = {
    'hostname': client.addr.host,
    'port': client.addr.port,
    'path': '/' + client.service_name,
    'method': 'GET'
  };

  var url = 'http://' + getPQDN(client.addr) + '/' + client.service_name;
  console.log(url);
  seq.then(function(next) {
    var strt = new Date();
    http.get(url, function(resp) {
      next(resp, strt);
    }).on('error', function(err) {
      console.log(err);
      next(null, strt);
    });
  })
  .then(function(next, resp, prevStart) {
    if (resp == null) {
      next(null, prevStart);
    } else {
      resp.setEncoding('utf8');
      resp.on('data', function(d) {
        op += d;
        next(d, prevStart);
      });
    }
  })
  .then(function(next, d, prevStart) {
    // res.write(d);
    console.log('Delay', new Date() - prevStart);
    clientReqs.push({
      'client_name': client.client_name,
      'service_name': client.service_name,
      'service_instance': getHierAddr(client.addr),
      'resp_ms': new Date() - prevStart,
      'errors': ((d == null) ? 1 : 0)
    });
    next(err);
  });
}

app.get('/' + config.service_name, function(req, res) {
  var start = new Date();
  var seq = Futures.sequence.create(), err;

  var clientReqs = [];
  var op = '';

  for (var i = 0; i < config.clients.length; i ++) {
    var client = config.clients[i];
    handleClient(client, seq, err, op, clientReqs);
  }
  
  seq.then(function(next) {
    // Fake wait time.
    sleep.usleep(delay);
    res.write(config.service_name);
    res.end();

    var selftime = new Date() - start;
    console.log('Response time: ', selftime, 'ms');
    logRequest(selftime, clientReqs, false);
    next();
  });
});

app.get('/quit', function(req, res) {
  res.send('Bye');
  process.exit();
});

app.get('/delay', function(req, res) {
  delay = parseInt(req.query.delay) || delay;
  res.send('Updated delay to ' + delay);
});

setInterval(statsRefresher, STATS_REFRESH_INTERVAL_MSEC);

// The server is about to start up
// Send a hello to the message queue with my configuration.
mqClient.publish(CHANNEL_SERVICECONFIG, JSON.stringify(config));

app.listen(config.port);
