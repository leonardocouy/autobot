const dotenv = require('dotenv').config();
const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const ChatBotUtil = require('./chatbot-util');
const ChatBotClient = require('./chatbot-client');
const Constants = require('./constants')
const Customer = require('./customer');
const StatsDClient = require('./statsd-client');
const client = new ChatBotClient(process.env.BLIP_IDENTIFIER,
                                 process.env.BLIP_ACCESSKEY,onConnect);
const chatbot_utils = new ChatBotUtil();
const app = express();
const port = process.env.PORT || 8080;
const dashboard = new StatsDClient('gama.chatbot.autoja');
const botMessages = yaml.safeLoad(fs.readFileSync('messages.yml', 'utf8'));

console.log(botMessages)
function onConnect(err, session) {
    if (err) {
        console.log("ERROR: AutoBOT Tilt!", err);
        process.exit(0);
    }

    console.log("Client Connected");

    this.addMessageReceiver(sendTyping);
    this.addMessageReceiver(onMessage);
}

// function onNotification(notification) {
//     console.log(notification);
// }

function fetchAccount(conversationId){
    var customer = new Customer(conversationId);
    var accountQuery = {
        id : 1, //TODO: Generate Random ID
        to : "postmaster@" +  customer.getChannel(),
        method: "get",
        uri : "lime://" + customer.getChannel() + "/accounts/" + customer.getId()
    }

    return client.command(accountQuery);
}

function onMessage(message){
    var self = this;
    var msgArriveTime = new Date().getTime();
    // dashboard.increment('newmessage');


    // Get Account Info and Send Message!
    fetchAccount(message.from).then(function(account) {
        var firstName, prefixName;
        firstName = account.resource.fullName.match(/^([^\s]+)\s/)[1];
        switch (account.resource.gender) {
            case 'male':
                prefixName = "Sr. ";
                break;
            case 'female':
                prefixName = "Sra. ";
                break;
            default:
                break;
        }

        // Process to send message
        // If content returns a object like: {personagem: 'kadu', search: 100}
        previousMessage = message.content
        if (typeof previousMessage == 'object') {
            // Get all Personagem conversation
            for (var i = 0; i < botMessages[previousMessage.personagem].length; i++) {
              // Check if next path is equal current path
              if (typeof botMessages[previousMessage.personagem][i].messagePath !== 'undefined'){
                if (previousMessage.messagePath.next == botMessages[previousMessage.personagem][i].messagePath.current) {
                  step = botMessages[previousMessage.personagem][i];
                  break;
                }
              }
            }
        } else {
            // Init conversation (select yes or no)
            step = botMessages.kadu[0];
            //TODO: Menu to select other options.
        }

        var response = buildResponse(message, step);

        // Set name and prefix.
        if (typeof response.content.text !== 'undefined'){
          response.content.text = response.content.text.replace("NOME", prefixName + firstName);
        }else{
          response.content = response.content.replace("NOME", prefixName + firstName);
        }


        setTimeout(function () {
            self.send(response);
        }, 3000)

        if (typeof step.messagePath !== undefined && "next_index" in step.messagePath) {
            setTimeout(function () {
                nextStep(self, message, botMessages, step, 1);
            }, 6000)
        }

        var respTime = new Date().getTime() - msgArriveTime;
        dashboard.timing("answer", respTime);
    }).catch(function(err){
        console.log("Error: fetch account returned", err);
    });

}

function nextStep(context, message, msgBot, step, count) {

    var newStep = msgBot[step.personagem][step.messagePath.next_index];
    context.send(buildResponse(message, newStep));

    if ("next_index" in newStep.messagePath) {
        setTimeout(function () {
            nextStep(context, message, msgBot, newStep, count + 1);
        }, 3000 + 3000 * count)
    }
}

function buildResponse(message, msgBot) {
    var response = {
        id: message.id,
        to: message.from,
    }

    switch (msgBot.messageType) {
        case 'common_message':
          response.content = msgBot.text;
          response.type = Constants.Type.TEXT_PLAIN;
          break;
        case 'collection':
          items = []

          for (var i = 0; i < msgBot.items.length; i++) {
            item = msgBot.items[i]
            // create header item PARAMS: title, text, image_uri
            header = chatbot_utils.createMediaHeader(item.header.title, item.header.text, item.header.image_uri)
            // create item PARAMS: label, value
            console.log(item.item.text)
            item = chatbot_utils.createMediaItem(item.item.text, msgBot.messagePath)
            // create menu itens PARAMS: itens
            items.push({'header': header, 'options': item})
          }

          menu = chatbot_utils.buildMediaMenu(items)
          // create collection PARAMS: content
          collection = chatbot_utils.buildCollection(menu)
          response.content = collection.content;
          response.type = collection.type;
          console.log('collection')
          console.log(response.content.items[0].options)
          break;
        case 'menu':
          // Create Option item for Menu
          options = []
          // Iterate for menuOptions
          for (var i = 0; i < msgBot.menuOptions.length; i++) {
            option = msgBot.menuOptions[i]
            value = {"type": "application/json", "value": option.value}
            // Params: Order, text and value
            option_item = chatbot_utils.createOption(option.order, option.optionText, option.value)
            options.push(option_item)
          }
          // Create Select Menu Params: menuTitle, menuOptions
          menu = chatbot_utils.buildSelectMenu(msgBot.menuTitle, options)

          // Pass to response
          response.content = menu.content;
          response.type = menu.type;
          break;

        default:
          response.content = msgBot.content;
          response.type = msgBot.type;
          break;
    }

    // if (typeof data.options != 'undefined')
    //     response.options = data.options;

    return response;
}

function sendTyping(message) {
    var response = {
        type: "application/vnd.lime.chatstate+json",
        to: message.from,
        content: {
            "state": "composing"
        }
    }

    self.send(response);
}

app.listen(port, function () {
    console.log('App is running on http://localhost:' + port);
});





//
//
//
// var data = {
//         'kadu': [
//             {
//                 'search': 'Começar',
//                 'content': {
//                     'text': 'Oi, João! Fico feliz que você veio conversar comigo. Você gostaria de ver as opções que temos para negociar seus pagamentos?',
//                     "options": [
//                         {
//                             "order": 1,
//                             "text": "Sim",
//                             "type": "application/json",
//                             "value": {
//                                 "personagem": "kadu",
//                                 "search": 100
//                             }
//                         },
//                         {
//                             "order": 2,
//                             "text": "Não",
//                             "type": "application/json",
//                             "value": {
//                                 "personagem": "kadu",
//                                 "search": 200
//                             }
//                         }
//                     ]
//                 },
//                 'type': "application/vnd.lime.select+json"
//
//
//             },
//             {
//                 'search': 100,
//                 'content': 'Que ótimo! \nVou chamar a Lara! Ela será a sua assistente digital para negociações.\n\n @Lara',
//                 'type': "text/plain",
//                 'nextStep': {
//                     "personagem": "lara",
//                     "index": 0
//                 }
//             }
//             ,
//             {
//                 'search': 200,
//                 'content': 'O que posso fazer por você Jõao?',
//                 'type': "text/plain"
//             }
//
//         ],
//         'lara': [
//             {
//                 // 'search': 100,
//                 'content': 'Oi, João! \nEu sou a Lara e estou aqui para te ajudar em suas negociações. De acordo com sua atual situação: \n\n' +
//                 'Valor líquido do financiamento= R$ 31.000,00\n' +
//                 'Valor devido: 3 parcelas de R$ 1.140,03 = 3.420,09\n' +
//                 'Parcelamento de 1+5 X 578,56\n' +
//                 'Forma pagamento: Boleto bancário\n' +
//                 '\nO que nós temos para você é o seguinte:',
//                 'type': "text/plain",
//                 'nextStep': {
//                     "personagem": "lara",
//                     "index": 1
//                 }
//             },
//             {
//                 // 'search': 101,
//                 'content': {
//                     "itemType": "application/vnd.lime.document-select+json",
//                     "items": [
//                         {
//                             "header": {
//                                 "type": "application/vnd.lime.media-link+json",
//                                 "value": {
//                                     "title": "Pagamento sem juros",
//                                     "text": "Ao realizar a quitação do valor devedor total agora ou pelo boleto, você não pagará pelos juros",
//                                     "type": "image/jpeg",
//                                     "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
//                                 }
//                             },
//                             "options": [
//                                 {
//                                     "label": {
//                                         "type": "text/plain",
//                                         "value": "Saber mais"
//                                     },
//                                     "value": {
//                                         "type": "application/json",
//                                         "value": {
//                                             "personagem": "lara",
//                                             "search": 101
//                                         }
//                                     }
//                                 }
//                             ]
//                         },
//                         {
//                             "header": {
//                                 "type": "application/vnd.lime.media-link+json",
//                                 "value": {
//                                     "title": "Pagamento sem 50% dos juros",
//                                     "text": "Ao realizar o pagamento em uma data agendada nos próximos 30 dias você terá 50% de desconto nos juros",
//                                     "type": "image/jpeg",
//                                     "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
//                                 }
//                             },
//                             "options": [
//                                 {
//                                     "label": {
//                                         "type": "text/plain",
//                                         "value": "Saber mais"
//                                     },
//                                     "value": {
//                                         "type": "application/json",
//                                         "value": {
//                                             "personagem": "lara",
//                                             "search": 102
//                                         }
//                                     }
//                                 }
//                             ]
//                         },
//                         {
//                             "header": {
//                                 "type": "application/vnd.lime.media-link+json",
//                                 "value": {
//                                     "title": "Sem juros cumulativos",
//                                     "text": "se realizar o pagamento da primeira fatura devedora agora ou via boleto, as 2 outras faturas param de acumular juros pelo próximos 30 dias consecutivos",
//                                     "type": "image/jpeg",
//                                     "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
//                                 }
//                             },
//                             "options": [
//                                 {
//                                     "label": {
//                                         "type": "text/plain",
//                                         "value": "Saber mais"
//                                     },
//                                     "value": {
//                                         "type": "application/json",
//                                         "value": {
//                                             "personagem": "lara",
//                                             "search": 103
//                                         }
//                                     }
//                                 }
//                             ]
//                         }
//                     ]
//                 },
//                 'type': "application/vnd.lime.collection+json",
//                 // 'nextStep': {
//                 //     "personagem": "lara",
//                 //     "key2": 100
//                 // }
//
//             },
//
//         ]
//     }
// ;
