/*
* Simulated Client Database
*
* */
DB = {}

var nextAccount = 0;
DB.accounts = [
    /*
     * accounts: // usuarios
     *  - firstname //  Primeiro Nome
     *  - lastname // Ultimo Nome
     *  - cpf
     *  - conversation // id@channel da conversa
     *  - id // id dessa account no banco
     * */
]


DB.loans = [
    /**
     *  loans: // financiamentos
     *   - model // modelo do carro
     *   - price // valor original do carro
     *   - installments // numero de parcelas
     *   - instValue // valor da parcela
     *   - id // id desse loan no banco
     *   - account_id // id do account que fez esse financiamento
     **/
]


DB.invoices = [
    /*
     *   invoices: // boletos
     *    - value // valor do boleto
     *    - number // numero deste boleto (1 a 36, por ex)
     *    - dueDate // data de vencimento
     *    - loan_id // id do financiamento
     *    - id // this invoice id
     * */
]

DB.options = {
    installments : [12, 24, 36],
    models : [
        {
            model : "fusca",
            price : 10000.00
        },


        {
            model : "brasilia",
            price : 12000.00
        },


        {
            model : "fiat 147",
            price : 16000.00
        },
    ]
}

function getRandomInt(min, max) {
    max = max + 1;
    return Math.floor(Math.random() * (max - min)) + min;
}

function generateAccount(i){
    return {
        id : i,
        firstname : "",
        lastname: "",
        cpf : "",
        conversation : ""
    }
}

function generateLoan(i){
    var rand1 = getRandomInt(0,2);
    var rand2 = getRandomInt(0,2);

    var installments = DB.options.installments[rand1];
    var model =  DB.options.models[rand2]
    var instValue = Math.floor(model.price / installments);

    return {
        id : i,
        account_id : i,
        model : model.model,
        price : model.price,
        installments : installments,
        instValue : instValue,
    }
}

var monthTimeMs = 1000 * 60 * 60 * 24 * 31; // 1000ms * 60s * 60m * 24h * 31d
function generateInvoice(loanId, invoiceId){
    var now = new Date().getTime();
    var dueDate = now + (invoiceId-2) * monthTimeMs;

    return   {
        id : loanId+invoiceId,
        loan_id : loanId,
        value : DB.loans[loanId].instValue,
        number : invoiceId+1,
        dueDate : dueDate,
        payed : dueDate  > now ? 0 : getRandomInt(0,1) //0: false, 1:true
    }
}

DB.init = function(){
    for (var i=0; i<20; i++){
        var account = generateAccount(i);
        DB.accounts.push(account);
    }

    for (var i=0; i<20; i++){
        var loan = generateLoan(i);
        DB.loans.push(loan);
    }

    for (var i=0; i<20; i++){
        for (var j=0; j<12; j++) {
            var invoice = generateInvoice(i, j);
            DB.invoices.push(invoice);
        }
    }
}

//inverted list: conversation -> id
var accountCache = {};
var cpfCache = {};

DB.getAccountByConversation = function(conversation){
    return DB.accounts[accountCache[conversation]];
}

DB.getAccountByCPF = function(cpf){
    return DB.accounts[cpfCache[cpf]];
}

DB.setAccountConversation = function(conversation, account){
    if(accountCache[conversation] != null){
        return accountCache[conversation];
    }

    var acc = DB.accounts[nextAccount];

    acc.conversation = conversation;

    acc.firstname =  account.fullName.match(/^([^\s]+)\s?/)[1];
    acc.lastname =  account.fullName.match(/^[^\s]+\s?(.*)$/)[1];

    accountCache[conversation] = acc.id;
    nextAccount++;

    return acc;
}

DB.setAccountCPF = function(CPF, conversation, account){
    var account = DB.getAccountByConversation(conversation, account);
    if (account == null){
        account = account = DB.setAccountConversation(conversation, account);
    }

    account.cpf = CPF;
    cpfCache[CPF] = account.id;

    return account;
}

DB.getLoan = function(accountId){
    return DB.loans[accountId];
}

DB.getInvoices = function(loanId) {
    var list = [];
    for(var i=0; i<DB.invoices.length; i++){
        if(DB.invoices[i].loan_id == loanId){
            list.push(DB.invoices[i]);
        }
    }
    return list;
}

DB.getDueInvoiceList = function(){
    var list = [];

    var today = new Date().getTime();

    var due = 0;
    var ok = 0;

    for (var i=0; i<DB.invoices.length; i++){
        if(DB.invoices[i].payed == 0 && DB.invoices[i].dueDate < today){
            list.push(DB.invoices[i]);
            due += DB.invoices[i].value;
        } else {
            ok += DB.invoices[i].value;
        }
    }

    console.log(due, ok);

    return list;
}

module.exports = DB;