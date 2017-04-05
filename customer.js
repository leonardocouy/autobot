

function Customer(conversationId){
    var self = this;

    self.id = self._getIdFromConversation(conversationId);
    self.channel = self._getChannelFromConversation(conversationId);

    return self;
}


Customer.prototype.getId = function(){
    return this.id;
}


Customer.prototype.getChannel = function(){
    return this.channel;
}

Customer.prototype._getIdFromConversation = function(conversationId){
    return conversationId.match(/^(.*)@.*/)[1];
}


Customer.prototype._getChannelFromConversation = function(conversationId){
    return conversationId.match(/.*@(.*)$/)[1];
}

module.exports = Customer;