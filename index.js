const ChatBotClient = require('./chatbot-client');
const dotenv = require('dotenv').config();
const client = new ChatBotClient(process.env.BLIP_IDENTIFIER,
  process.env.BLIP_ACCESSKEY, onConnect);

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
    var content = message.content;

    var response = {
        id : message.id,
        type : message.type,
        to : message.from,
        content : content
    }


    this.send(response);
}
