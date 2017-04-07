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
    installments: [12, 24, 36],
    models: [
        {
            model: "fusca",
            price: 10000.00
        },

        {
            model: "brasilia",
            price: 12000.00
        },

        {
            model: "fiat 147",
            price: 16000.00
        },
    ]
}

function getRandomInt(min, max) {
    max = max + 1;
    return Math.floor(Math.random() * (max - min)) + min;
}

// geração de uma conta (vazia)
function generateAccount(i) {
    return {
        id: i,
        firstname: "",
        lastname: "",
        cpf: "",
        gender: "",
        conversation: ""
    }
}

// geração de um financiamento pra um determinado cliente
function generateLoan(i) {
    var rand1 = getRandomInt(0, 2);
    var rand2 = getRandomInt(0, 2);

    var installments = DB.options.installments[rand1];
    var model = DB.options.models[rand2]
    var instValue = Math.floor(model.price / installments);

    return {
        id: i,
        account_id: i,
        model: model.model,
        price: model.price,
        installments: installments,
        instValue: instValue,
    }
}

// geração dos boletos pra um determinado financiamento
var monthTimeMs = 1000 * 60 * 60 * 24 * 31; // 1000ms * 60s * 60m * 24h * 31d
function generateInvoice(loanId, invoiceId) {
    var now = new Date().getTime();
    var dueDate = now + (invoiceId - 3) * monthTimeMs;

    return {
        id: loanId + invoiceId,
        loan_id: loanId,
        value: DB.loans[loanId].instValue,
        number: invoiceId + 1,
        dueDate: dueDate,
        payed: dueDate > now ? 0 : (getRandomInt(1, 10) <= 2 ? 0 : 1),
        // payed = 0: false, 1:true
        renegotiated: 0
    }
}

// geração dos valores aleatorios do banco.
DB.init = function () {
    for (var i = 0; i < 20; i++) {
        var account = generateAccount(i);
        DB.accounts.push(account);
    }

    for (var i = 0; i < 20; i++) {
        var loan = generateLoan(i);
        DB.loans.push(loan);
    }

    for (var i = 0; i < 20; i++) {
        for (var j = 0; j < 12; j++) {
            var invoice = generateInvoice(i, j);
            DB.invoices.push(invoice);
        }
    }
}

// inverted list: conversation -> id, cpf -> id
var accountCache = {};
var cpfCache = {};

// retorna uma conta pelo id da conversa
DB.getAccountByConversation = function (conversation) {
    return DB.accounts[accountCache[conversation]];
}

// retorna uma conta pelo CPF
DB.getAccountByCPF = function (cpf) {
    return DB.accounts[cpfCache[cpf]];
}

// grava as infrmações do id da conversa e da própria conta.
DB.setAccountConversation = function (conversation, account) {
    if (accountCache[conversation] != null) {
        return accountCache[conversation];
    }

    var acc = DB.accounts[nextAccount];

    acc.conversation = conversation;
    acc.gender = account.gender;

    acc.firstname = account.fullName.match(/^([^\s]+)\s?/)[1];
    acc.lastname = account.fullName.match(/^[^\s]+\s?(.*)$/)[1];

    accountCache[conversation] = acc.id;
    nextAccount++;

    return acc;
}

// grava as informações de conta com CPF, id da conversa e a propria conta.s
DB.setAccountCPF = function (CPF, conversation, account) {
    var account = DB.getAccountByConversation(conversation, account);
    if (account == null) {
        account = account = DB.setAccountConversation(conversation, account);
    }

    account.cpf = CPF;
    cpfCache[CPF] = account.id;

    return account;
}

// retorna o financiamento de 1 usuário
DB.getLoan = function (accountId) {
    return DB.loans[accountId];
}

// lista todos os boletos de 1 financiamento
DB.getInvoices = function (loanId) {
    var list = [];
    for (var i = 0; i < DB.invoices.length; i++) {
        if (DB.invoices[i].loan_id == loanId) {
            list.push(DB.invoices[i]);
        }
    }
    return list;
}

// lista todos os boletos vencidos de 1 financiamento
DB.getDueInvoices = function (loanId) {
    console.log("1")
    var invoices = DB.getInvoices(loanId);
    console.log("2")
    var due = [];

    var today = new Date().getTime();
    for (var i = 0; i < invoices.length; i++) {
        console.log("3")
        if (invoices[i].payed == 0 && invoices[i].dueDate < today) {
            console.log("4")
            due.push(invoices[i]);
        }
    }

    console.log("5")

    return due;
}

// lista de todos os boletos vencidos não pagos para atualizar o grafico
DB.getDueInvoiceList = function () {
    var list = [];

    var today = new Date().getTime();

    for (var i = 0; i < DB.invoices.length; i++) {
        if (DB.invoices[i].payed == 0 && DB.invoices[i].dueDate < today) {
            list.push(DB.invoices[i]);
        }
    }

    return list;
}

DB.getDueClientsCount = function () {
    var count = 0;

    var today = new Date().getTime();

    for (var i = 0; i < DB.accounts.length; i++) {
        var loan = DB.getLoan(DB.accounts[i].id);
        var invoices = DB.getInvoices(loan.id);

        for (var j = 0; j < invoices.length; j++) {
            if (invoices[j].payed == 0 && invoices[j].dueDate < today) {
                count++;
                break;
            }
        }
    }

    return count;
}

DB.setPaid = function (invoiceId) {
    DB.invoices[invoiceId].payed = true;
}

module.exports = DB;
