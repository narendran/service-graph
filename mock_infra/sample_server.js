var express = require('express');
var app = express();
var sleep = require('sleep');
var redis = require('redis');
var jsonfile = require('jsonfile');

var STATS_REFRESH_INTERVAL_MSEC = 2000;
var CHANNEL_SERVICECONFIG = 'serviceconfig';
var CHANNEL_SERVICESTATE = 'servicestats';
var CHANNEL_CLIENTSTATS = 'clientstats';

var configFile = null;

if (process.argv.length < 3) {
  console.error('ERROR: Configfile not passed.');
  console.log('Usage: ', process.argv[0], process.argv[1], 'configfile');
  return;
}

configFile = __dirname + '/' + process.argv[2];
config = jsonfile.readFileSync(configFile);
config.port = config.port || 3000;
config.clients = config.clients || [];

console.log(config);

var mqClient = redis.createClient(null, '137.110.52.123');

var ownStats = {
  'service': config.service_name,
  'calls': 0,
  'total_resp_ms': 0,
  'errors': 0,
  'avg_resp_ms': 0
};

var childStats = {};
var logEntries = [];

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
    ownStats.errors -= logEntry.error;

    // TODO: Remove child stats for logEntry

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
  console.log(ownStats);
  mqClient.publish(CHANNEL_SERVICESTATE, JSON.stringify(ownStats));
}

function logRequest(resp_ms, child_requests, error) {
  var logEntry = {
    'timestamp': new Date(),
    'resp_ms': resp_ms,
    'children': child_requests,
    'error': error
  };

  logEntries.push(logEntry);
  ownStats.calls ++;
  ownStats.total_resp_ms += resp_ms;
  ownStats.errors += error;

  // TODO: Add child stats for logEntry
}

app.use(function(req, res, next){
  var timer_start = new Date();
  next();
  var timer_end = new Date();
  var selftime = timer_end - timer_start;
  console.log('Response time: ', selftime, 'ms');
  logRequest(selftime, [], false);
});

app.get('/', function(req, res){
  res.send('Hello world');

  // Fake 10ms wait time.
  sleep.usleep(10000);
});

setInterval(statsRefresher, STATS_REFRESH_INTERVAL_MSEC);

// The server is about to start up
// Send a hello to the message queue with my configuration.
mqClient.publish(CHANNEL_SERVICECONFIG, JSON.stringify(config));

app.listen(config.port);
