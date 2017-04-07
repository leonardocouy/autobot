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
    process.env.BLIP_ACCESSKEY, onConnect);
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
// console.log(notification);
// }
function conversationEnd(message, msgBot) {
    response = buildResponse(message, msgBot)
    users[message.from].state = 'conversation_end'
    return response
}

function matchCPF(message) {
    CPF_REGEX = /[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}\-?[0-9]{2}/
    if (message.content.match(CPF_REGEX)) {
        return true;
    } else {
        users[message.from].cpf_attempts += 1
        return false;
    }
}

function fetchAccount(conversationId) {
    var customer = new Customer(conversationId);
    var accountQuery = {
        id: Lime.Guid(), // TODO: Generate Random ID
        to: "postmaster@" + customer.getChannel(),
        method: "get",
        uri: "lime://" + customer.getChannel() + "/accounts/" + customer.getId()
    }

    return client.command(accountQuery);
}

function sendSequenceResponse(self, responses, to){
  console.log(to)
    countDelayReponse = 600;

    for (var i=0; i < responses.length; i++){
      data = responses[i]
      self.send({
          type: "application/vnd.lime.chatstate+json",
          to: to,
          content: {
              "state": "composing"
          }
      });

      setTimeout(function() {
        self.send(data)
      }, countDelayReponse)

      countDelayReponse = countDelayReponse + 600;
    };
}
const users = []
function onMessage(message) {

    console.log('++++++++')
    console.log(message);
    console.log('++++++++')

    var self = this;
    var msgArriveTime = new Date().getTime();
    dashboard.increment('newmessage');


    // Try get userState from sender
    var userState = users[message.from];

    // First time
    if (userState == undefined) {
        userState = {state: 'init_conversation', name: '', cpf_attempts: 0, phone_attempts: 0}
        users[message.from] = userState;
    }else{
      if(/menu/i.test(message.content)){
        msgBot = botMessages['kadu']['menu_help']
        response = buildResponse(message, msgBot)
        sendResponse(self, response, 600)
        users[message.from].state = 'choose_menu_help'
      }
    }



    // Preparing response to the context
    var response = {id: message.id, to: message.from}
    // Switch (Navigation tree)

    switch (userState.state) {
        case 'init_conversation':
            // Get Account Info and Send Message!
            function gotAccount(account) {
                var prefixName;

                switch (account.gender) {
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
                users[message.from].name = prefixName + account.firstname
                response.content = response.content.replace("NOME", users[message.from].name);
                sendResponse(self, response, 600)

                if (msgBot.next_state === 'show_image_kadu') {

                    // Show Image Kadu
                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 1200)

                    // Introduce Kadu
                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 2400)

                    // Show menu (next_state = menu_help)
                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 3400)

                    users[message.from].state = 'choose_menu_help'
                }
            }

            // Get Account Info and Send Message!
            var acc = DB.getAccountByConversation(message.from);
            if(acc != null){
                gotAccount(acc);
            } else {
                fetchAccount(message.from).then(function(account){
                    acc = DB.setAccountConversation(message.from, account.resource);
                    gotAccount(acc);
                }).catch(function(err){
                    console.log("Não foi possível buscar a conta", err)
                });
            }
            break;
        case 'choose_menu_help':
            if (!("next_state" in message.content)) {
                users[message.from].state = 'choose_menu_help'
                break;
            }

            state = message.content.next_state
            msgBot = botMessages['kadu'][state]
            response = buildResponse(message, msgBot)
            sendResponse(self, response, 600)
            // 2 via boleto
            if (msgBot.next_state === 'boleto_msg_2') {

                // Boleto request CPF
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)
                users[message.from].state = 'segunda_via_boleto'

            }// Check situation
            else if (msgBot.next_state === 'situation_msg_2') {
                // Situation request CPF
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                users[message.from].state = 'generate_situation_report'
            }// Negociações de inadimplência
            else if (msgBot.next_state === 'kadu_calls_lara_2') {

                // Kadu calls lara message 2
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                // Call lara image
                msgLaraBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgLaraBot)
                sendResponse(self, response, 2000)

                // Init Lara conversation
                msgLaraBot = botMessages['lara'][msgLaraBot .next_state]
                response = buildResponse(message, msgLaraBot)
                response.content = response.content.replace("NOME", users[message.from].name);
                sendResponse(self, response, 2600)

                // Request CPF
                msgLaraBot = botMessages['lara'][msgLaraBot.next_state]
                response = buildResponse(message, msgLaraBot)
                sendResponse(self, response, 5000)

                // Direct to next route
                users[message.from].state = 'show_situation_and_plans'
            } else {
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 600)
            }
            break;
        case 'show_situation_and_plans':

            if (matchCPF(message)) {
                msgBot = botMessages['lara']['validate_cpf']
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                // Send situation
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)

                var acc = DB.getAccountByConversation(message.from);
                var financ = DB.getLoan(acc.id)

                var dueInvoices = DB.getDueInvoices(financ.id)
                var totalDue = 0;
                var parCount = 0;
                var parcValue = dueInvoices[0].value;

                for(var i = 0; i < dueInvoices.length; i++){
                    totalDue += dueInvoices[i].value;
                    parCount ++;
                }

                response.content = response.content.replace("$FINANCTOTAL", Math.round(financ.price).toFixed(2));
                response.content = response.content.replace("$NUMPARCELAS", parCount );
                response.content = response.content.replace("$VALPARCELAS", Math.round(parcValue).toFixed(2));
                response.content = response.content.replace("$VALTOTAL", Math.round(totalDue).toFixed(2));
                response.content = response.content.replace("$VALRENEG", Math.round((totalDue * 1.056)/6).toFixed(2)); // juros
                                                                                                                        // 0,056%
                                                                                                                        // fixo.

                sendResponse(self, response, 3000)

                // Show plans message
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 4000)

                // Show plans collection
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 6000)

                users[message.from].state = 'choose_plans'
            } else {
                // Warn user 3 times, else direct to init.
                if (users[message.from].cpf_attempts < 3) {
                    msgBot = botMessages['lara']['cpf_undefined']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 600)
                } else {
                    // Restart conversation

                    msgBot = botMessages['kadu']['not_possible']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 300)

                    users[message.from].state = 'choose_menu_help';
                    users[message.from].cpf_attempts = 0;

                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 1200)
                }
            }

            break;
        case 'choose_plans':

            // Send link pagseguro
            state = message.content.next_state
            msgBot = botMessages['lara'][state]
            response = buildResponse(message, msgBot)
        
            //Mark all pending as payed
            var acc = DB.getAccountByConversation(message.from);

            var loan = DB.getLoan(acc.id);
            var invoices = DB.getDueInvoices(loan.id);


            for (var i = 0; i < invoices.length; i++) {
                console.log("pagando")
                DB.setPaid(invoices[i].id);
            }

            self.send(response)

            if (state !== 'other_options') {
                // Show negotation success
                msgBot = botMessages['lara'][msgBot.next_state]
                // msgBot.content = msgBox.content.replace("NOME", users[message.from].name);

                response = buildResponse(message, msgBot)
                sendResponse(self, response, 8000)

                // Show relax message
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                response.content = response.content.replace("NOME", users[message.from].name);
                sendResponse(self, response, 9000)

                // Thanks Lara
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 11000)

                // Thanks Kadu
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                response.content = response.content.replace("NOME", users[message.from].name);
                sendResponse(self, response, 14000)

                // Execute the function to end conversation
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = conversationEnd(message, msgBot)
                sendResponse(self, response, 16000)
            } else {
                // Choose other options
                msgBot = botMessages['lara'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 600)
                users[message.from].state = 'other_options'
            }
            // END OF INADIMPLENT FLOW
            break;
        case 'other_options':
            // Choose other options
            state = message.content.next_state
            msgBot = botMessages['lara'][state]
            response = buildResponse(message, msgBot)
            sendResponse(self, response, 600)

            if (state === 'send_number' || state === 'email') {
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = conversationEnd(message, msgBot)
                sendResponse(self, response, 1800)
            } else if (state === 'receive_call') {
                users[message.from].state = 'get_user_phone'
            }
            break;
        case 'get_user_phone':
            PHONE_REGEX = /(\(?\d{2}\)?) ?9?\d{4}-?\d{4}/

            if (message.content.match(PHONE_REGEX)) {
                // calling
                msgBot = botMessages['lara']['calling']
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                msgBot = botMessages['kadu'][msgBot.next_state]
                response = conversationEnd(message, msgBot)
                sendResponse(self, response, 2000)
            } else {
                // Warn user 3 times, else direct to init.
                users[message.from].phone_attempts += 1
                if (users[message.from].phone_attempts < 3) {
                    msgBot = botMessages['lara']['invalid_phone']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 600)
                } else {
                    // Restart conversation
                    msgBot = botMessages['lara']['not_possible_phone']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 300)

                    users[message.from].state = 'other_options';
                    users[message.from].phone_attempts = 0;

                    msgBot = botMessages['lara']['choose_other_options']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 2000)

                }
            }
            break;
        case 'generate_situation_report':
            if (matchCPF(message)) {
                msgBot = botMessages['kadu']['situation_please_wait']
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 600)

                // Send situation report
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot, 1200)

                var acc = DB.getAccountByConversation(message.from);
                var financ = DB.getLoan(acc.id)

                var dueInvoices = DB.getDueInvoices(financ.id)
                if(dueInvoices.length == 0){
                    dueInvoices[0].value = 699.00
                }
                var totalDue = 0;
                var parCount = 0;
                var parcValue = dueInvoices[0].value;

                for(var i = 0; i < dueInvoices.length; i++){
                    totalDue += dueInvoices[i].value;
                    parCount ++;
                }

                response.content = response.content.replace("$FINANCTOTAL", Math.round(financ.price).toFixed(2));
                response.content = response.content.replace("$NUMPARCELAS", parCount );
                response.content = response.content.replace("$VALPARCELAS", Math.round(parcValue).toFixed(2));
                response.content = response.content.replace("$VALTOTAL", Math.round(totalDue).toFixed(2));
                response.content = response.content.replace("$VALRENEG", Math.round((totalDue * 1.056)/6).toFixed(2)); // juros
                                                                                                                        // 0,056%
                                                                                                                        // fixo.

                sendResponse(self, response, 1800)

                // Execute the function to end conversation
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = conversationEnd(message, msgBot)
                sendResponse(self, response, 2400)

                // END OF SITUATION FLOW!!!
            } else {
                // Warn user 3 times, else direct to init.
                if (users[message.from].cpf_attempts < 3) {
                    msgBot = botMessages['kadu']['situation_cpf_undefined']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 600)
                } else {
                    // Restart conversation
                    msgBot = botMessages['kadu']['not_possible']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 300)

                    users[message.from].state = 'choose_menu_help';
                    users[message.from].cpf_attempts = 0;

                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response)
                }
            }
            break;
        case 'segunda_via_boleto':
            if (matchCPF(message)) {

                msgBot = botMessages['kadu']['boleto_please_wait']
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                // Generate pagseguro link

                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1200)

                // Execute the function to end conversation
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = conversationEnd(message, msgBot)
                sendResponse(self, response, 3500)


                // END OF SEGUNDA VIA BOLETO FLOW!!!
            } else {
                // Warn user 3 times, else direct to init.
                if (users[message.from].cpf_attempts < 3) {
                    msgBot = botMessages['kadu']['boleto_cpf_undefined']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 600)
                } else {
                    // Restart conversation
                    msgBot = botMessages['kadu']['not_possible']
                    response = buildResponse(message, msgBot)
                    sendResponse(self, response, 300)

                    users[message.from].state = 'choose_menu_help';
                    users[message.from].cpf_attempts = 0;

                    msgBot = botMessages['kadu'][msgBot.next_state]
                    response = buildResponse(message, msgBot, 1800)
                    sendResponse(self, response)

                }
            }
            break;

        case 'conversation_end':
            // Send continue message or user satisfaction
            state = message.content.next_state
            msgBot = botMessages['kadu'][state]
            response = buildResponse(message, msgBot)

            if (state == 'continue_message') {
                // Send happy message
                sendResponse(self, response, 1200)

                // Show menu
                msgBot = botMessages['kadu'][msgBot.next_state]
                response = buildResponse(message, msgBot)
                sendResponse(self, response, 1800)
                users[message.from].state = 'choose_menu_help'
            }else if (state == 'user_satisfaction'){
                // msgBot = botMessages['kadu'][msgBot.next_state]
                // response = buildResponse(message, msgBot)
                // sendResponse(self, response)
                users[message.from].state = 'thanks_message'
                sendResponse(self, response, 1800)
            }else{
              sendResponse(self, response, 1800)
            }
            break;

        case 'thanks_message':
            // Thanks Message
            state = message.content.next_state
            msgBot = botMessages['kadu'][state]
            msgBot.text = msgBot.text.replace("NOME", users[message.from].name);
            response = buildResponse(message, msgBot)
            sendResponse(self, response, 600)

            // Volta ao primeiro estado!
            users[message.from].state = 'init_conversation'
            break;
        default:
            users[message.from].state = 'init_conversation'
            break;
    }
}

var countDelayReponse = 1500;
function sendResponse(self, data, seconds) {

    // if (typeof time != 'undefined') {
    // countDelayReponse = 0;
    // } else
    // time = time + (countDelayReponse * 500);


    self.send({
        type: "application/vnd.lime.chatstate+json",
        to: data.to,
        content: {
            "state": "composing"
        }
    })

    setTimeout(function () {


        self.send(data)

    }, seconds)

    countDelayReponse = countDelayReponse + 750;
}

function replaceNewLine(response)
{
    return response.replace(/_NL_/g, '\n');
}


function buildResponse(message, msgBot) {
    var response = {
        id: message.id,
        to: message.from,
    }

    switch (msgBot.messageType) {
        case 'common_message':
            console.log('-------------------------')
            console.log(msgBot.text);

            response.content = replaceNewLine(msgBot.text)
            response.next_state = msgBot.next_state
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
        case 'image':
            // PARAM: image_uri
            image = chatbot_utils.createImage(msgBot.image_uri)
            response.content = image.content;
            response.type = image.type;
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
            switch (msgBot.id_payment) {
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
            response.next_state = msgBot.next_state
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
// var newStep = msgBot[step.personagem][step.messagePath.next_index];
// context.send(buildResponse(message, newStep));
//
// if ("next_index" in newStep.messagePath) {
// setTimeout(function () {
// nextStep(context, message, msgBot, newStep, count + 1);
// }, 3000 + 3000 * count)
// }
// }

function sendTyping(message) {
    var response = {
        type: "application/vnd.lime.chatstate+json",
        to: message.from,
        content: {
            "state": "composing"
        }
    }

    sendResponse(self, response);
}

app.listen(port, function () {
    console.log('App is running on http://localhost:' + port);
});

var statistics = setInterval(function () {
    var dueList = DB.getDueInvoiceList();
    var totalDue = 0;

    for(var i=0; i<dueList.length; i++){
        totalDue += dueList[i].value;
    }

    dashboard.gauge("invoices.due.total", totalDue);

    var dueCout = DB.getDueClientsCount();
    dashboard.gauge("invoices.due.count", dueCout);

    var okCount = (DB.accounts.length - dueCout);
    dashboard.gauge("invoices.ok.count", okCount);

}, 2000);
