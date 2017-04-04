/**
 * Created by webert on 03/04/17.
 */
const ChatBotClient = require('./chatbot-client');
const client = new ChatBotClient("autobot01", "RE5ZSERnd05wdnBJc0thZ3VtTjQ=", onConnect);

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