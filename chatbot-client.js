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

ChatbotClient.prototype.addMessageReceiver = function (option, handler) {
    if (typeof(option) == 'function') {
        handler = option;
        option = true;
    }

    var self = this;
    self.client.addMessageReceiver(option, (message)=>{
        handler.call(self, message);
    });
}

ChatbotClient.prototype.addNotificationReceiver = function (option, handler) {
    if (typeof(option) == 'function') {
        handler = option;
        option = true;
    }

    var self = this;
    self.client.addNotificationReceiver(option, (notification)=>{
        handler.call(self, notification);
    });
}

ChatbotClient.prototype.send = function(message){
    this.client.sendMessage(message);
}

module.exports = ChatbotClient;
