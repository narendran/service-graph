var MongoClient = require('mongodb').MongoClient;

var inertia = 0.1;
var runningAvg = {};
var counter = 0;

MongoClient.connect('mongodb://137.110.52.123:27017/service_graph', function(err, db) {
  var collection = db.collection('servicemetrics');
  var timestamp25HoursAgo = new Date() - 25 * 60 * 60 * 1000;
  var stream = collection.find({
      'timestamp': {$gte: timestamp25HoursAgo}
  }, {
    tailable: true,
    await_data: true,
    numberOfRetries: -1
  }).stream();

  stream.on('data', function(item) {
    counter ++;
    var svc = item['service'];
    if (!runningAvg[svc]) {
      runningAvg[svc] = {
        'resp_ms': item['avg_resp_ms'],
        'error_rate': (!item['calls']) ? 0.0 : item['errors'] / item['calls']
      };
    } else {
      runningAvg[svc] = {
        'resp_ms': (item['avg_resp_ms']) * (1 - inertia) + runningAvg[svc]['resp_ms'] * inertia,
        'error_rate': ((!item['calls']) ? 0.0 : item['errors'] / item['calls']) * (1 - inertia) + runningAvg[svc]['error_rate'] * inertia
      }
    }

    if (counter % 10 == 0) {
      console.log('****************', counter, '*****************');
      console.log(new Date(item['timestamp']));
      for (var svc in runningAvg) {
        console.log(svc, runningAvg[svc]);
      }
    }
  });
});
