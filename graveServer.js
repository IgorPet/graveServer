var jayson = require("jayson");

var Validator = require('jsonschema').Validator;
var idValidator = new Validator();

var config = require("./data/config");

var rand = function() {
    return Math.random().toString(36).substr(2); // remove `0.`
};

var token = function() {
    return rand() + rand(); // to make it longer
};


var tokenMap = {};


var fs = require('fs');
// TODO: создаем список учетных записей - прочитать из файла на диске
// Формат { client_id : "id432478927",
//          data : { sn_id : "vk", access_token: "ruweoiruwofjaldjf832", expired: "date:time" },
//          terminalId : 4671384676481
//        }

// TODO: создаем список учетных записей - прочитать из файла на диске ИЛИ ТАК
// Формат { "vk:id432478927", { access_token: "ruweoiruwofjaldjf832", expired: "date:time" , terminalId : 4671384676481 } }

// JSON registrator format

var users = JSON.parse(fs.readFileSync('./data/users.json', encoding="ascii"));

var regSchema = {
    "id": "/regScheme",
    "type": "object",
    "properties": {
        "sn_id": {"type": "string"},
        "user_id": {"type": "string"},
        "friends": {
            "type": "array",
            "items": {"type": "string"}
        }
    }
};

var idSchema = {
    "id": "/idScheme",
    "type": "object",
    "properties": {
        "sn_id": {"type": "string"},
        "user_id": {"type": "string"},
        "rip_id": { "type": "string"}
    }
};

// create a server
var server = jayson.server({
    registration: function(regJSONArray, callback) {
        var ret = [];
        console.log(regJSONArray);
        console.log(Array.isArray(regJSONArray));
        if( Array.isArray(regJSONArray) ) {
            regJSONArray.forEach(function (json) {
                var valid = idValidator.validate(json, regSchema);
                if ( !valid.errors.length ) {
                    var tmp = tryToFindDiedFriends(json);
                    if (tmp) {
                        ret.push(tmp);
                    }
                } else {
                    console.log(valid.errors);
                };
            });
            console.log(ret);
            callback(null, !ret.length ? null : ret);
        }
    },
    get_token: function(idJSON, callback) {
        var ret = [];
        var validObjects = [];
        idJSON.forEach(function (json) {
            var valid = idValidator.validate(json, idSchema);
            if ( !valid.errors.length ) {
                validObjects.push(json);
            } else {
                console.log(valid.errors);
            };
        });

        // Создать токены;
        createTokens(idJSON, callback);
    },
    show_Pray: function(idJSON, callback) {
        var ret = [];
        var error = false;
        idJSON.forEach(function (json) {
            ret.push(idValidator.validate(json, idSchema));
        });
        ret.forEach(function (t){
            console.log(t.errors);
            if (t.errors.length) {
                error = true;
                console.log(t.errors);
            }
        })
        callback(null, error ? "fail" : "ok");
    },
    show_photo_album:function(tokenJSON, callback) {
        var retMSG = null;
        console.log(tokenJSON[0]);
        console.log(tokenMap);
        if ( tokenJSON[0].token in tokenMap) {
            var user_id = tokenMap[tokenJSON[0].token];
            console.log(user_id);
            users.some(function(user){
                console.log("USER = "  +user.id);
                if (user_id == user.id) {
                    console.log("TUT");
                    if (user.data.terminalStatus == 1) {
                        var vkontakte = require('vkontakte');
                        var vk = vkontakte(user.data.access_token);
                        vk('photos.getAlbums', function (err, albums) {
                            returnAlbum(user, albums, callback)
                            console.log(albums);
                        });
                    } else {
                        retMSG = "terminal is offline";
                        console.log(retMSG);
                        callback(null, retMSG);
                    }
                    return true;
                } else {
                    retMSG = "no terminal found by this token";
                    console.log(retMSG);
                    callback(null, retMSG);
                }
            });

        } else {
            retMSG = "you fucking kidding me";
            console.log(retMSG);
            callback(null, retMSG);
        }
    },
    show_document:function(tokenJSON, callback) {
        var retMSG = null;
        console.log(tokenJSON[0]);
        console.log(tokenMap);
        if ( tokenJSON[0].token in tokenMap) {
            var user_id = tokenMap[tokenJSON[0].token];
            console.log(user_id);
            users.some(function(user){
                console.log("USER = "  +user.id);
                if (user_id == user.id) {
                    console.log("TUT");
                    if (user.data.terminalStatus == 1) {
                        var vkontakte = require('vkontakte');
                        var vk = vkontakte(user.data.access_token);
                        vk('docs.get', function (err, docs) {
                            returnDocs(user, docs, callback)
                            console.log(docs);
                        });
                    } else {
                        retMSG = "terminal is offline";
                        console.log(retMSG);
                        callback(null, retMSG);
                    }
                    return true;
                } else {
                    retMSG = "no terminal found by this token";
                    console.log(retMSG);
                    callback(null, retMSG);
                }
            });

        } else {
            retMSG = "you fucking kidding me";
            console.log(retMSG);
            callback(null, retMSG);
        }
    },
    show_next_photo:function(tokenJSON, callback) {
        sendMessageToTerminal(tokenJSON[0], 'show_next_photo', callback);
    },
    show_previous_photo:function(tokenJSON, callback) {
        sendMessageToTerminal(tokenJSON[0], 'show_previous_photo', callback);
    },
    scroll_up:function(tokenJSON, callback) {
        sendMessageToTerminal(tokenJSON[0], 'scroll_up', callback);
    },
    scroll_down:function(tokenJSON, callback) {
        sendMessageToTerminal(tokenJSON[0], 'scroll_down', callback);
    },
    show_main_screen:function(tokenJSON, callback) {
        sendMessageToTerminal(tokenJSON[0], 'show_main_screen', callback);
    }
});

function sendMessageToTerminal(tokenJSON, message, callback) {
    var retMSG = null;
    if ( tokenJSON.token in tokenMap) {
        var user_id = tokenMap[tokenJSON.token];
        users.some(function(user){
            if (user_id === user.id) {
                if (user.data.terminalStatus == 1) {
                    console.log('send message \"' + message + '\" for terminal id' + user.data.terminalId);
                    user.data.socket.write(message);
                    retMSG = "ok";
                    return true;
                } else {
                    retMSG = "terminal is offline";
                }
            } else {
                retMSG = "no terminal found by this token";
            }
        });
    } else {
        retMSG = "you fucking kidding me";
    }
    console.log(retMSG);
    try {
        callback(null, retMSG);
    } catch (e) {
        console.log('callback is missing');
    }
};

server.on("request", function(c){
    console.log("receive requst");
});

tryToFindDiedFriends = function(registrationJSON) {

    // для каждой записи пробегаемся по списку друзей
    // проверям есть ли указанный user_id у них в друзьях
    // в случае успеха создаем запись для отправки формата
    // { sn_id : "", died_friends = ["id_1", "Id_3"] }

    var retValue = null;
    var retFriends = [];

    registrationJSON.friends.forEach(function (client_id) {
        var tmpId = registrationJSON.sn_id + '_' + client_id;

        users.forEach(function(user_id){
            if (tmpId === user_id.id) {
                retFriends.push(client_id);
            }
        });
    });

    if (retFriends.length) {
        retValue = {
            sn_id: registrationJSON.sn_id,
            died_friends: retFriends
        }
    }
    return retValue;
};

function returnDocs(user, docs, callback) {

    var retObj;

    docs.some(function(doc){
        if (doc.title == "завещание.doc") {
            retObj = { "show_document" : doc.did };
            return true;
        }
    });

    user.data.socket.write(JSON.stringify(retObj));
    retMSG = "ok";
    console.log(retMSG);
    try {
        callback(null, retMSG);
    } catch (e) {
        console.log('callback is missing');
    }
};

function returnAlbum(user, album, callback) {

    var retObj;
    album.some(function(alb){
        if (alb.title === "RIP") {
            retObj = { "show_photo" : alb.aid };
//            console.log(user.id.split("_")[1]);
//            var vkontakte = require('vkontakte');
//            var vk = vkontakte(user.data.access_token);
//            vk('photos.get', { uid : user.id.split("_")[1] , aid: alb.aid }, function (err, photos) {
//                console.log(photos);
//                console.log(err);
//            });
            return true;
        }
    });


    user.data.socket.write(JSON.stringify(retObj));
    retMSG = "ok";
    console.log(retMSG);
    try {
        callback(null, retMSG);
    } catch (e) {
        console.log('callback is missing');
    }
};

function checkFriendship(jsonObj, callback){
    //{ sn_id : "vk", user_id : "XXX", rip_id : "id_1" }
    // если такой клиент дляуказаной соцсети существует, то
    // проверям дружбу нашего client_id и user_id если да, то
    // проверяем авторизован ли такой терминал
    // после возвращаем

    var vkontakte = require('vkontakte');

    var tmpId = jsonObj.sn_id + '_' + jsonObj.rip_id;
    var acces_token = null;
    users.forEach(function(user){
        if (user.id === tmpId ) {
            acces_token = user.data.access_token;
        }
    });
    var vk = vkontakte(acces_token);
    vk('friends.get', { fields: 'uid, first_name, photo' }, function (err, friends) {
        if ( friends && friends.length) {
            var flag = false;
            friends.forEach(function(friend){
                console.log(friend.uid + " " + jsonObj.user_id + "is equal = " + (friend.uid == jsonObj.user_id) );
                if ( friend.uid == jsonObj.user_id) {
                    flag = true;
                    someHack(jsonObj, true, callback);
                }
            });
            if (flag) {
                return 0;
            } else {
                someHack(jsonObj, false, callback);
            }
        }
        console.log("NO");
        someHack(jsonObj, false, callback);
    });
}

function theyAreFriends(){

}

function someHack(jsonObject, flag, callback) {
    var retVal = null;
    console.log(flag ? "friendship is approve" : "no friendship");
    if (flag) {
        retVal = {
            sn_id : jsonObject.sn_id,
            token : token()
        }
        tokenMap[retVal.token] = jsonObject.sn_id + "_" + jsonObject.rip_id;
    }
    callback(null, retVal);
}
function createTokens(jsonObjArray, callback) {
    //[{ sn_id : "vk", user_id : "XXX", rip_id : "id_1" }[
    var retVal = null;
    jsonObjArray.forEach(function(jsonObj){
        console.log(jsonObj);
        checkFriendship(jsonObj, callback);
    });
}
var tcpServer = server.tcp();
// Bind a http interface to the server and let it listen to localhost:3000
tcpServer.listen(config.client_port, '0.0.0.0', function(){
    console.log('Listening on 0.0.0.0:' + config.client_port);
});

tcpServer.on('connection', function (stream) {
    console.log('someone connected!' + stream.remoteAddress + ":" + stream.remotePort);
});

tcpServer.on('data', function(data) {
    console.log('FROM client > ' + data.toString());
});

var net = require("net");
var clients = [];
var server = net.createServer(function(socket){
    socket.name = socket.remoteAddress + ':' + socket.remotePort;
    console.log('Client ' + socket.name + ' connected to server');
    clients.push(socket);
//    socket.write('Welcome ' + socket.name + '\n');
    socket.on('data', function(data) {

        var regData;
        try {
            regData = JSON.parse(data);
        } catch (e) {
            return;
        }

        var retValue;
        console.log('FROM client '+ socket.name + '> ' + data.toString());
        users.forEach(function(user_id){
            if (regData.terminal === user_id.data.terminalId) {
                retValue = { "access_token" : user_id.data.access_token };
                console.log(JSON.stringify(retValue));
                socket.write(JSON.stringify(retValue));
                user_id.data.terminalStatus = 1;
                user_id.data.socket = socket;
            }
        });
    });
    socket.on('end', function() {
        console.log('Client ' + socket.name + ' was disconnected');
        users.forEach(function(user_id){
            if (socket === user_id.data.socket) {
                user_id.data.terminalStatus = 0;
                user_id.data.socket = null;
                console.log(user_id);
            }
        });
        clients.splice(clients.indexOf(socket), 1);
    });
    socket.on('error', function() {
        console.log(socket.name + ' broke connection');
        clients.splice(clients.indexOf(socket), 1);
    });
});

server.listen(config.terminal_port);