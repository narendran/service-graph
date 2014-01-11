var express = require('express');
var app = express();
var sleep = require('sleep');

var STATS_REFRESH_INTERVAL_MSEC = 1000;

var stats = {};

function statsRefresher() {
}

app.use(function(req, res, next){
  var timer_start = new Date();
  next();
  var timer_end = new Date();
  console.log(timer_end - timer_start);
});

app.get('/', function(req, res){
  res.send('Hello world');
  // sleep.usleep(3000);
});

setInterval(statsRefresher, STATS_REFRESH_INTERVAL_MSEC);

app.listen(3000);
