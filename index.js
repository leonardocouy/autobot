const dotenv = require('dotenv').config();
const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const ChatBotUtil = require('./chatbot-util');
const ChatBotClient = require('./chatbot-client');
const Constants = require('./constants');
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

var DB = require('./sim-database');
DB.init();

function onConnect(err, session) {
    if (err) {
        console.log("ERROR: AutoBOT Tilt!", err);
        process.exit(0);
    }

    console.log("Client Connected");

    this.addMessageReceiver(sendTyping);
    this.addMessageReceiver(onMessage);

    this.command({
      "id": Lime.Guid(),
      "method": "set",
      "type": "application/vnd.lime.delegation+json",
      "uri": "/delegations",
      "resource": {
        "target": "postmaster@pagseguro.gw.msging.net",
        "envelopeTypes": [
          "message"
        ]
      }
    })


}

// function onNotification(notification) {
//     console.log(notification);
// }
function conversationEnd(message, msgBot){
    response = buildResponse(message, msgBot)
    users[message.from].state = 'conversation_end'
    return response
}

function matchCPF(message){
  CPF_REGEX = /[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}\-?[0-9]{2}/
  if (message.content.match(CPF_REGEX)){
    return true;
  }else{
    users[message.from].cpf_attempts += 1
    return false;
  }
}

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
      userState = { state: 'init_conversation',  name: '' , cpf_attempts: 0, phone_attempts: 0}
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
          users[message.from].name = prefixName + firstName
          response.content = response.content.replace("NOME", users[message.from].name );
          self.send(response)

          if(msgBot.next_state === 'introduce_kadu'){
            // Introduce Kadu
            msgBot = botMessages['kadu'][msgBot.next_state]
            response = buildResponse(message, msgBot)
            self.send(response)

            // Show menu (next_state = menu_help)
            msgBot = botMessages['kadu'][msgBot.next_state]
            response = buildResponse(message, msgBot)
            self.send(response)

            users[message.from].state = 'choose_menu_help'
          }
        })
        break;
      case 'choose_menu_help':
        if (!("next_state" in message.content)){
          users[message.from].state = 'choose_menu_help'
          break;
        }

        state = message.content.next_state
        msgBot = botMessages['kadu'][state]
        response = buildResponse(message, msgBot)
        self.send(response)
        // 2 via boleto
        if(msgBot.next_state === 'boleto_msg_2'){

          // Boleto request CPF
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)
          users[message.from].state = 'segunda_via_boleto'

        }// Check situation
        else if(msgBot.next_state === 'situation_msg_2'){
          // Situation request CPF
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          users[message.from].state = 'generate_situation_report'
        }// Negociações de inadimplência
        else if(msgBot.next_state === 'kadu_calls_lara_2'){

          // Kadu calls lara message 2
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          //TODO: Imagem avatar lara
          // Init Lara conversation
          msgLaraBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgLaraBot)
          response.content = response.content.replace("NOME", users[message.from].name );
          self.send(response)

          // Request CPF
          msgLaraBot = botMessages['lara'][msgLaraBot.next_state]
          response = buildResponse(message, msgLaraBot)
          self.send(response)

          // Direct to next route
          users[message.from].state = 'show_situation_and_plans'
        }else{
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)
        }
        break;
      case 'show_situation_and_plans':
        if (matchCPF(message)) {
          msgBot = botMessages['lara']['validate_cpf']
          response = buildResponse(message, msgBot)
          self.send(response)

          // Send situation
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Show plans message
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Show plans collection
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          users[message.from].state = 'choose_plans'
        }else{
          // Warn user 3 times, else direct to init.
          if (users[message.from].cpf_attempts < 3){
            msgBot = botMessages['lara']['cpf_undefined']
            response = buildResponse(message, msgBot)
            self.send(response)
          }else{
            // Restart conversation
            users[message.from].state = 'init_conversation'
            users[message.from].cpf_attempts = 0;
          }
        }

      break;
      case 'choose_plans':
        // Send link pagseguro
        state = message.content.next_state
        msgBot = botMessages['lara'][state]
        response = buildResponse(message, msgBot)
        response.content = response.content.replace("NOME", users[message.from].name );
        self.send(response)

        if (state !== 'other_options'){
          // Show negotation success
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Show relax message
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          response.content = response.content.replace("NOME", users[message.from].name );
          self.send(response)

          // Thanks Lara
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Thanks Kadu
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          response.content = response.content.replace("NOME", users[message.from].name );
          self.send(response)

          // Execute the function to end conversation
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = conversationEnd(message, msgBot)
          self.send(response)
        }else{
          // Choose other options
          msgBot = botMessages['lara'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)
          users[message.from].state = 'other_options'
        }
        // END OF INADIMPLENT FLOW
      break;
      case 'other_options':
        // Choose other options
        state = message.content.next_state
        msgBot = botMessages['lara'][state]
        response = buildResponse(message, msgBot)
        self.send(response)

        if (state === 'send_number' || state === 'email'){
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = conversationEnd(message, msgBot)
          self.send(response)
        }else if (state === 'receive_call'){
          users[message.from].state = 'get_user_phone'
        }
      break;
      case 'get_user_phone':
        PHONE_REGEX = /(\(?\d{2}\)?) ?9?\d{4}-?\d{4}/

        if(message.content.match(PHONE_REGEX)){
          // calling
          msgBot = botMessages['lara']['calling']
          response = buildResponse(message, msgBot)
          self.send(response)

          msgBot = botMessages['kadu'][msgBot.next_state]
          response = conversationEnd(message, msgBot)
          self.send(response)
        }else{
          // Warn user 3 times, else direct to init.
          users[message.from].phone_attempts += 1
          if (users[message.from].phone_attempts < 3){
            msgBot = botMessages['lara']['invalid_phone']
            response = buildResponse(message, msgBot)
            self.send(response)
          }else{
            // Restart conversation
            users[message.from].state = 'init_conversation'
            users[message.from].phone_attempts = 0;
          }
        }

      break;
      case 'generate_situation_report':
        if (matchCPF(message)) {
          msgBot = botMessages['kadu']['situation_please_wait']
          response = buildResponse(message, msgBot)
          self.send(response)

          // Send situation report
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Execute the function to end conversation
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = conversationEnd(message, msgBot)
          self.send(response)

          // END OF SITUATION FLOW!!!
        }else{
          // Warn user 3 times, else direct to init.
          if (users[message.from].cpf_attempts < 3){
            msgBot = botMessages['kadu']['situation_cpf_undefined']
            response = buildResponse(message, msgBot)
            self.send(response)
          }else{
            // Restart conversation
            users[message.from].state = 'init_conversation'
            users[message.from].cpf_attempts = 0;
          }
        }
      break;


      case 'segunda_via_boleto':
        if (matchCPF(message)) {
          msgBot = botMessages['kadu']['boleto_please_wait']
          response = buildResponse(message, msgBot)
          self.send(response)

          // Generate pagseguro link
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)

          // Execute the function to end conversation
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = conversationEnd(message, msgBot)
          self.send(response)

          // END OF SEGUNDA VIA BOLETO FLOW!!!
        }else{
          // Warn user 3 times, else direct to init.
          if (users[message.from].cpf_attempts < 3){
            msgBot = botMessages['kadu']['boleto_cpf_undefined']
            response = buildResponse(message, msgBot)
            self.send(response)
          }else{
            // Restart conversation
            users[message.from].state = 'init_conversation'
            users[message.from].cpf_attempts = 0;
          }
        }
      break;

      case 'conversation_end':
        // Send continue message or user satisfaction
        state = message.content.next_state

        msgBot = botMessages['kadu'][state]
        response = buildResponse(message, msgBot)
        self.send(response)

        if(state == 'continue_message'){
          users[message.from].state = 'choose_menu_help'
        }else{
          msgBot = botMessages['kadu'][msgBot.next_state]
          response = buildResponse(message, msgBot)
          self.send(response)
          users[message.from].state = 'thanks_message'
        }
      break;

      case 'thanks_message':
        // Thanks Message
        state = message.content.next_state
        msgBot = botMessages['kadu'][state]
        response = buildResponse(message, msgBot)
        response.content = response.content.replace("NOME", users[message.from].name );
        self.send(response)

        // Volta ao primeiro estado!
        users[message.from].state = 'init_conversation'
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
          // Create Select Menu Params: menuType, menuTitle, menuOptions
          menu = chatbot_utils.buildSelectMenu(msgBot.menuType, msgBot.menuTitle, options)

          // Pass to response
          response.content = menu.content;
          response.type = menu.type;
          break;
        case 'question':
          // PARAM: question
          userInput = chatbot_utils.getUserInput(msgBot.text)
          response.content = userInput.content;
          response.type = userInput.type;
          break;
        case 'payment':
          // Set permission to send payment

          price = 0
          date_dueTo = new Date();
          switch(msgBot.id_payment){
            // payment_gateway_1
            case 1:
              price = 500
              date_dueTo.setDate(date_dueTo.getDate() + 1)
            break;
            // payment_gateway_2
            case 2:
              price = 700
              date_dueTo.setDate(date_dueTo.getDate() + 30)
            break;
            // payment_gateway_3
            case 3:
              price = 900
              date_dueTo.setDate(date_dueTo.getDate() + 1)
            // boleto_generate_link
            case 4:
              price = 200
              date_dueTo.setDate(date_dueTo.getDate() + 30)
            break;
            default:
              break;
          }

          // Params: messenger_id, price, description, dueTo_date
          messenger_id = message.from.split("@")[0]
          payment = chatbot_utils.createPayment(price, msgBot.description, date_dueTo)

          response.id = "1"
          response.to = messenger_id + "%40messenger.gw.msging.net@pagseguro.gw.msging.net",
          response.content = payment.content;
          response.type = payment.type;
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

var debtsInterval = setInterval(function () {
    var dueList = DB.getDueInvoiceList();
    var totalDue = 0;

    for(var i=0; i<dueList.length; i++){
        totalDue += dueList[i].value;
    }

    dashboard.gauge("invoices.due.total", totalDue);
},1000);