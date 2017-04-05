/**
 * Created by webert on 03/04/17.
 */

const StatsD = require('node-statsd').StatsD;

function StatsDClient(prefix, hostname, port) {
    var self = this;

    hostname = hostname ? hostname : 'localhost';
    port = port ? port : 8125;

    self.prefix = prefix + '.';
    self.client = new StatsD({host : hostname, port : port, prefix : self.prefix});

    return self;
}

StatsDClient.prototype.increment = function (metric) {
    this.client.increment(metric);
}

StatsDClient.prototype.decrement = function (metric) {
    this.client.decrement(metric);
}

StatsDClient.prototype.timing = function (metric, time) {
    this.client.timing(metric + ".time", time);
}


StatsDClient.prototype.gauge = function (metric, value) {
    this.client.gauge(metric, value);
}

module.exports = StatsDClient;
