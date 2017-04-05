const ChatBotClient = require('./chatbot-client');
const dotenv = require('dotenv').config();
const express = require('express');
const StatsDClient = require('./statsd-client');

const client = new ChatBotClient(process.env.BLIP_IDENTIFIER,
                                 process.env.BLIP_ACCESSKEY,onConnect);
const app = express();
const port = process.env.PORT || 8080;
const dashboard = new StatsDClient('gama.chatbot.autoja');

function onConnect(err, session){
    if(err){
        console.log("ERROR: AutoBOT Tilt!", err);
        process.exit(0);
    }

    console.log("Client Connected");
    this.addMessageReceiver(onMessage);
}


function onNotification(notification){

}

function onMessage(message){
    dashboard.increment('newmessage');

    var content = message.content;

    var response = {
        id : message.id,
        type : message.type,
        to : message.from,
        content : content
    }

    this.send(response);
}

app.listen(port, function() {
    console.log('App is running on http://localhost:' + port);
});
