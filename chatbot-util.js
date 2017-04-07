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


ChatBotUtil.prototype.buildSelectMenu = function(menu_type, title, options){
  response = {
    "type": "application/vnd.lime.select+json",
    "content": {
      "text": title,
      "options": options
    }
  }

  if (menu_type === 'quick_reply') {
    response.scope = 'immediate'
  }

  return response;
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

ChatBotUtil.prototype.createPayment = function(price, description, date_dueTo){
  current_date = new Date();
  return {
    "type": "application/vnd.lime.invoice+json",
    "content": {
        "created": current_date.toISOString(),
        "dueTo": date_dueTo.toISOString(),
        "currency":"BRL",
        "total": price,
        "items":[
            {
                "quantity": 1.0,
                "unit": price,
                "currency":"BRL",
                "total": price,
                "description": description
            }
        ]
    }
  }
}

ChatBotUtil.prototype.getUserInput = function(question){
  return {
    "type": "application/vnd.lime.input+json",
    "content": {
        "label": {
          "type": "text/plain",
          "value": question
        },
        "validation": {
          "rule": "text"
        }
    }
}
}

module.exports = ChatBotUtil;
