const ChatBotClient = require('./chatbot-client');
const Constants = require('./constants');
const Customer = require('./customer');
const dotenv = require('dotenv').config();
const express = require('express');
const StatsDClient = require('./statsd-client');

const client = new ChatBotClient(process.env.BLIP_IDENTIFIER,
                                 process.env.BLIP_ACCESSKEY,onConnect);
const app = express();
const port = process.env.PORT || 8080;
const dashboard = new StatsDClient('gama.chatbot.autoja');

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
    var msgArriveTime = new Date().getTime();
    dashboard.increment('newmessage');

    var self = this;

    fetchAccount(message.from).then(function(account) {
        var acc = DB.getAccount(message.from);

        if(!acc){
            acc = DB.setAccount(message.from, account);
            var loan = DB.getLoan(acc.id);
            var invoices = DB.getInvoices(loan.id);

            console.log(invoices);
        }

        var welcomingStr = "Olá";
        switch (account.resource.gender) {
            case 'male':
                welcomingStr += " Sr.";
                break;
            case 'female':
                welcomingStr += " Sra.";
                break;
            default:
                break;
        }

        var firstName = account.resource.fullName.match(/^([^\s]+)\s/)[1];
        welcomingStr += " " + firstName + ". Tudo bem?";
        var response = {
            id : message.id,
            to : message.from,
            type : Constants.Type.TEXT_PLAIN,
            content : welcomingStr
        };

        var respTime = new Date().getTime() - msgArriveTime;

        self.send(response);
        dashboard.timing("answer", respTime);
    }).catch(function(err){
        console.log("Error: fetch account returned", err);
    });

    var content = message.content;
    if (typeof content == 'object') {

        for (var i = 0; i < data[content.personagem].length; i++) {
            // console.log(data[content.personagem][i].search)
            // console.log('=');
            // console.log(parseInt(content.item))
            //
            // console.log('\n');

            if (typeof data[content.personagem][i].search != 'undefined' && parseInt(content.search) == data[content.personagem][i].search) {
                step = data[content.personagem][i];
                break;
            }
        }
    } else {
        step = data.kadu[0];
    }

    var response = buildResponse(message, step);
    // console.log(response);

    setTimeout(function () {
        self.send(response);
    }, 3000)

    if (typeof step.nextStep != 'undefined') {
        setTimeout(function () {
            nextStep(self, message, data, step, 1);
        }, 6000)
    }

}

function nextStep(context, message, data, step, count) {

    var newStep = data[step.nextStep.personagem][step.nextStep.index];

    context.send(buildResponse(message, newStep));

    if (typeof newStep.nextStep != 'undefined') {
        setTimeout(function () {
            nextStep(context, message, data, newStep, count + 1);
        }, 3000 + 3000 * count)
    }
}

function buildResponse(message, data) {
    // console.log(data);

    var response = {
        id: message.id,
        to: message.from,
    }

    response.content = data.content;
    response.type = data.type;

    if (typeof data.options != 'undefined')
        response.options = data.options;

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








var data = {
        'kadu': [
            {
                'search': 'Começar',
                'content': {
                    'text': 'Oi, João! Fico feliz que você veio conversar comigo. Você gostaria de ver as opções que temos para negociar seus pagamentos?',
                    "options": [
                        {
                            "order": 1,
                            "text": "Sim",
                            "type": "application/json",
                            "value": {
                                "personagem": "kadu",
                                "search": 100
                            }
                        },
                        {
                            "order": 2,
                            "text": "Não",
                            "type": "application/json",
                            "value": {
                                "personagem": "kadu",
                                "search": 200
                            }
                        }
                    ]
                },
                'type': "application/vnd.lime.select+json"


            },
            {
                'search': 100,
                'content': 'Que ótimo! \nVou chamar a Lara! Ela será a sua assistente digital para negociações.\n\n @Lara',
                'type': "text/plain",
                'nextStep': {
                    "personagem": "lara",
                    "index": 0
                }
            }
            ,
            {
                'search': 200,
                'content': 'O que posso fazer por você Jõao?',
                'type': "text/plain"
            }

        ],
        'lara': [
            {
                // 'search': 100,
                'content': 'Oi, João! \nEu sou a Lara e estou aqui para te ajudar em suas negociações. De acordo com sua atual situação: \n\n' +
                'Valor líquido do financiamento= R$ 31.000,00\n' +
                'Valor devido: 3 parcelas de R$ 1.140,03 = 3.420,09\n' +
                'Parcelamento de 1+5 X 578,56\n' +
                'Forma pagamento: Boleto bancário\n' +
                '\nO que nós temos para você é o seguinte:',
                'type': "text/plain",
                'nextStep': {
                    "personagem": "lara",
                    "index": 1
                }
            },
            {
                // 'search': 101,
                'content': {
                    "itemType": "application/vnd.lime.document-select+json",
                    "items": [
                        {
                            "header": {
                                "type": "application/vnd.lime.media-link+json",
                                "value": {
                                    "title": "Pagamento sem juros",
                                    "text": "Ao realizar a quitação do valor devedor total agora ou pelo boleto, você não pagará pelos juros",
                                    "type": "image/jpeg",
                                    "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
                                }
                            },
                            "options": [
                                {
                                    "label": {
                                        "type": "text/plain",
                                        "value": "Saber mais"
                                    },
                                    "value": {
                                        "type": "application/json",
                                        "value": {
                                            "personagem": "lara",
                                            "search": 101
                                        }
                                    }
                                }
                            ]
                        },
                        {
                            "header": {
                                "type": "application/vnd.lime.media-link+json",
                                "value": {
                                    "title": "Pagamento sem 50% dos juros",
                                    "text": "Ao realizar o pagamento em uma data agendada nos próximos 30 dias você terá 50% de desconto nos juros",
                                    "type": "image/jpeg",
                                    "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
                                }
                            },
                            "options": [
                                {
                                    "label": {
                                        "type": "text/plain",
                                        "value": "Saber mais"
                                    },
                                    "value": {
                                        "type": "application/json",
                                        "value": {
                                            "personagem": "lara",
                                            "search": 102
                                        }
                                    }
                                }
                            ]
                        },
                        {
                            "header": {
                                "type": "application/vnd.lime.media-link+json",
                                "value": {
                                    "title": "Sem juros cumulativos",
                                    "text": "se realizar o pagamento da primeira fatura devedora agora ou via boleto, as 2 outras faturas param de acumular juros pelo próximos 30 dias consecutivos",
                                    "type": "image/jpeg",
                                    "uri": "https://i.forbesimg.com/media/2009/12/16/1216_cash-dollars_650x455.jpg"
                                }
                            },
                            "options": [
                                {
                                    "label": {
                                        "type": "text/plain",
                                        "value": "Saber mais"
                                    },
                                    "value": {
                                        "type": "application/json",
                                        "value": {
                                            "personagem": "lara",
                                            "search": 103
                                        }
                                    }
                                }
                            ]
                        }
                    ]
                },
                'type': "application/vnd.lime.collection+json",
                // 'nextStep': {
                //     "personagem": "lara",
                //     "key2": 100
                // }

            },

        ]
    }
;
