/**
 * Created by webert on 03/04/17.
 */

const MessagingHub = require('messaginghub-client');
const WebSocketTransport = require('lime-transport-websocket');

function ChatbotClient(identifier, accessKey, callback) {
    var self = this;

    // Cria uma instância do cliente, informando o identifier e accessKey do seu chatbot
    self.client = new MessagingHub.ClientBuilder()
    .withIdentifier(identifier)
    .withAccessKey(accessKey)
    .withTransportFactory(() => new WebSocketTransport())
    .build();

    self.client.connect().then(function(session) {
        callback.apply(self, null, session);
    }).catch(callback);


    return self;
}

ChatbotClient.prototype.connect = function () {
    return this.client.connect();
}

ChatbotClient.prototype.close = function () {
    return this.client.close();
}

ChatbotClient.prototype._addReceiver = function (option, handler, type) {
    if (typeof(option) == 'function') {
        handler = option;
        option = true;
    }

    var self = this;

    function receiverCallback(result){
        handler.call(self, result);
    }

    if(type == 'message'){
        self.client.addMessageReceiver(option, receiverCallback);
    } else {
        self.client.addNotificationReceiver(option, receiverCallback);
    }

}

ChatbotClient.prototype.addMessageReceiver = function (option, handler) {
   this._addReceiver(option, handler, 'message');
}

ChatbotClient.prototype.addNotificationReceiver = function (option, handler) {
    this._addReceiver(option, handler, 'notification');
}

ChatbotClient.prototype.send = function(message){
    return this.client.sendMessage(message);
}

ChatbotClient.prototype.command = function(message){
    return this.client.sendCommand(message);
}

module.exports = ChatbotClient;
