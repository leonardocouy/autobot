function ChatBotUtil() {
  var self = this;

  return self;
}

ChatBotUtil.prototype.createOption = function(order, caption, value){
  var content;

  if (typeof(value) !== 'undefined'){
    content = {
      "type": "application/json",
      "order": order,
      "text": caption,
      "value": value
    };
  }else{
    content = {
      "type": "application/json",
      "order": order,
      "text": caption
    };
  }
  return content;
}


ChatBotUtil.prototype.buildSelectMenu = function(title, options){
  return {
    "type": "application/vnd.lime.select+json",
    "content": {
      "text": title,
      "options": options
    }
  };
}

ChatBotUtil.prototype.createMediaHeader = function(title, text, image_uri){
  return {
    "type": "application/vnd.lime.media-link+json",
    "value": {
      "title": title,
      "text": text,
      "type": "image/jpeg",
      "uri": image_uri
    }

  };
}

ChatBotUtil.prototype.createMediaItem = function(label, value){
  return [{
    "label": {
      "type": "text/plain",
      "value": label
    },
    "value": {
      "type": "application/json",
      "value": value
    }
  }];
}

ChatBotUtil.prototype.buildMediaMenu = function(items){
  return {
    "itemType": "application/vnd.lime.document-select+json",
    "items": items
  };

}

ChatBotUtil.prototype.buildCollection = function(menu){
  return {
    "type": "application/vnd.lime.collection+json",
    "content": menu
  };
}

ChatBotUtil.prototype.createInputUser = function(text){
  return {
    "type": "application/vnd.lime.input+json",
    "content": {
        "label": {
          "type": "text/plain",
          "value": text
        },
        "validation": {
          "rule": "text"
        }
    }
  }
}



module.exports = ChatBotUtil;
