const dotenv = require('dotenv').config();
const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const ChatBotUtil = require('./chatbot-util');
const ChatBotClient = require('./chatbot-client');
const Constants = require('./constants')
const Customer = require('./customer');
const StatsDClient = require('./statsd-client');
const Lime = require('lime-js');
const client = new ChatBotClient(process.env.BLIP_IDENTIFIER,
                                 process.env.BLIP_ACCESSKEY,onConnect);
const chatbot_utils = new ChatBotUtil();
const app = express();
const port = process.env.PORT || 8081;
const dashboard = new StatsDClient('gama.chatbot.autoja');
const botMessages = yaml.safeLoad(fs.readFileSync('messages.yml', 'utf8'));

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
        id : Lime.Guid(), //TODO: Generate Random ID
        to : "postmaster@" +  customer.getChannel(),
        method: "get",
        uri : "lime://" + customer.getChannel() + "/accounts/" + customer.getId()
    }

    return client.command(accountQuery);
}

const users = []
function onMessage(message){
    var self = this;
    var msgArriveTime = new Date().getTime();
    dashboard.increment('newmessage');

    // Try get userState from sender
    var userState = users[message.from];

    // First time
    if (userState == undefined) {
      userState = { state: 'init_conversation',  name: '' }
      users[message.from] = userState;
    }

    // Preparing response to the context
    var response = { id: message.id, to: message.from }
    // Switch (Navigation tree)
    switch (userState.state) {
      case 'init_conversation':
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

          msgBot = botMessages['kadu']['init_conversation']
          response = buildResponse(message, msgBot)

          users[message.from].state = 'choose'
          users[message.from].name = prefixName + firstName
          response.content.text = response.content.text.replace("NOME", users[message.from].name );

          self.send(response)
        })
        break;
      case 'choose':
        if (!("next_state" in message.content)){
          users[message.from].state = 'init_conversation'
          break;
        }

        state = message.content.next_state
        msgBot = botMessages['kadu'][state]
        response = buildResponse(message, msgBot)
        self.send(response)

        if(msgBot.next_state === 'call_lara'){

          // Show current situation
          msgLaraBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgLaraBot)
          response.content = response.content.replace("NOME", users[message.from].name );
          self.send(response)

          // Show plans
          msgShowPlans = botMessages['lara'][msgLaraBot.next_state]
          response = buildResponse(message, msgShowPlans)
          self.send(response)

          // Direct to next route
          users[message.from].state = msgShowPlans.next_state
        }
        break;
      case 'payment_gateway':
        // TODO: Pagseguro integration
        break;
      default:
        users[message.from].state = 'init_conversation'
        break;
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
            item = chatbot_utils.createMediaItem(item.item.text, item.item.value)
            // create menu itens PARAMS: itens
            items.push({'header': header, 'options': item})
          }

          menu = chatbot_utils.buildMediaMenu(items)
          // create collection PARAMS: content
          collection = chatbot_utils.buildCollection(menu)
          response.content = collection.content;
          response.type = collection.type;
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

    return response;
}

// function nextStep(context, message, msgBot, step, count) {
//     var newStep = msgBot[step.personagem][step.messagePath.next_index];
//     context.send(buildResponse(message, newStep));
//
//     if ("next_index" in newStep.messagePath) {
//         setTimeout(function () {
//             nextStep(context, message, msgBot, newStep, count + 1);
//         }, 3000 + 3000 * count)
//     }
// }

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
