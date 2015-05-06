// npm install request node-xmpp express nodester-api

const config = require('./config.js').settings;
var express = require('express');

var commands = execute_bot();

var app = express();


app.get('/api/send', function (req, res)
{
    var job_name = req.param('job');
    var status = req.param('status');

    res.send('Hello World!' );
    config.friends.forEach(function(email){

        commands.send_message(email,"Jenkins launch "+job_name+ " and finished with status "+status);
    })

});


var server = app.listen(3000, function () {

    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);

});

function creaFunc() {
    var nombre = "Mozilla";
    function muestraNombre() {
        return nombre;
    }
    return muestraNombre;
}



function execute_bot() {

    /**
     * A simple XMPP client bot aimed specifically at Google Talk
     * @author FerCanon
     * @version 2015.18.01
     */

    console.log("Staring boot in" + __dirname) ;
    const xmpp = require('node-xmpp');
    const util = require('util');
    const request_helper = require('request');

    const conn = new xmpp.Client(config.client);
    conn.connection.socket.setTimeout(0);

    conn.connection.socket.setKeepAlive(true, 10000);

    var commands = {};

    /**
     * Request the roster from the Google identity query service
     * http://code.google.com/apis/talk/jep_extensions/roster_attributes.html#3
     */
    function request_google_roster() {
        var roster_elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'google-roster'})
                        .c('query', { xmlns: 'jabber:iq:roster', 'xmlns:gr': 'google:roster', 'gr:ext': '2' });
        conn.send(roster_elem);
    }

    /**
     * Accept any subscription request stanza that is sent over the wire
     * @param {Object} stanza
     */
    function accept_subscription_requests(stanza) {
        if(stanza.is('presence')
           && stanza.attrs.type === 'subscribe') {
            var subscribe_elem = new xmpp.Element('presence', {
                to: stanza.attrs.from,
                type: 'subscribed'
            });
            conn.send(subscribe_elem);
            send_help_information(stanza.attrs.from);
        }
    }

    /**
     * Set the status message of the bot to the supplied string
     * @param {String} status_message
     */

    function set_status_message(status_message) {
        var presence_elem = new xmpp.Element('presence', { })
            .c('show').t('chat').up()
            .c('status').t(status_message);
        conn.send(presence_elem);
    }
        commands.set_status_message   =set_status_message;
    /**
     * Send a XMPP ping element to the server
     * http://xmpp.org/extensions/xep-0199.html
     */
    function send_xmpp_ping() {
        var elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'c2s1' })
                 .c('ping', { 'xmlns': 'urn:xmpp:ping' });
        conn.send(elem);
    }

    /**
     * Send a message to the supplied JID
     * @param {String} to_jid
     * @param {String} message_body
     */
    function send_message(to_jid, message_body) {
        var elem = new xmpp.Element('message', { to: to_jid, type: 'chat' })
                 .c('body').t(message_body);
        conn.send(elem);
     //   util.log('[message] SENT: ' + elem.up().toString());
    }

    commands.send_message   =send_message;
    /**
    /**
     * A wrapper for send message to wrap the supplied command in help
     * text
     */
    function send_unknown_command_message(request) {

        send_message(request.stanza.attrs.from, 'Unknown command: "' + request.command + '". Type "help" for more information.');
    }



    function sendHelloMessage(request){

        var word =request.body;

        var re = /\bh(ola|i)?\b/g;
        var found = word.match(re);

      //  console.log(found);
        if(found !== null){
            send_message(request.from  ,config.hello_message);
            return false;
        }
        return true;
    }
    /**
     * Send out some help information detailing the available
     * bot commands
     * @param {String} to_jid
     */
    function send_help_information(to_jid) {

        var message_body = "Hola, soy baby Gabriela, Voy a nacer hoy. Sólo sé estos comandos:\n";
        message_body += "b;Echo de tus palabras\n";
        message_body += "t;Buscar en twitter\n";
        message_body += "w;Buscar en wikipedia\n";
        send_message(to_jid, message_body);
    }

    /**
     * Break the message up into components
     * @param {Object} stanza
     */
    function split_request(stanza) {
        var message_body = stanza.getChildText('body');
        if(null !== message_body) {
            util.log("from:" +stanza.attrs.from + " message: "+message_body);

            message_body = message_body.split(config.command_argument_separator);
            var command = message_body[0].trim().toLowerCase();
            if(typeof message_body[1] !== "undefined") {
                return { "command" : command,
                         "argument": message_body[1].trim(),
                         "stanza"  : stanza };
            } else {
                if(sendHelloMessage({"from":stanza.attrs.from, "body":command}))
                {
                    send_help_information(stanza.attrs.from);
                }
            }
        }
        return false;
    }

    /**
     * Dispatch requests sent in message stanzas
     * @param {Object} stanza
     */
    function message_dispatcher(stanza) {
//        console.log('Incoming stanza: ', stanza.toString())

        if('error' === stanza.attrs.type) {
            util.log('[error] ' + stanza.toString());
        } else if(stanza.is('message')) {
            var request = split_request(stanza);
            if(request) {
                if(!execute_command(request)) {
                    send_unknown_command_message(request);
                }
            }
        }
    }

    /**
     * Add a command to the bot for processing
     * @param {String} command
     * @param {Function} callback (should return true on success)
     */
    function add_command(command, callback) {
        commands[command] = callback;
    }

    /**
     * Execute a command
     * @param {Object} request
     */
    function execute_command(request) {
        if(typeof commands[request.command] === "function") {
            return commands[request.command](request);
        }
        return false;
    }

    /**
     * Bounce any message the user sends to the bot back to them
     * @param {Object} request
     */
    add_command('b', function(request) {
        send_message(request.stanza.attrs.from, request.stanza.getChildText('body'));
        return true;
    });

    /**
     * Search twitter for the provided term and give back 5 tweets
     * @param {Object} request
     */
    add_command('t', function(request) {
        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Searching twitter, please be patient...');
        var url = 'http://search.twitter.com/search.json?rpp=5&show_user=true&lang=en&q='
                + encodeURIComponent(request.argument);
        request_helper(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                var body = JSON.parse(body);
                if(body.results.length) {
                    for(var i in body.results) {
                        send_message(to_jid, body.results[i].text);
                    }
                } else {
                    send_message(to_jid, 'There are no results for your query. Please try again.');
                }
            } else {
                send_message(to_jid, 'Twitter was unable to provide a satisfactory response. Please try again.');
            }
        });
        return true;
    });

    add_command('w', function(request){

        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Gabriela is searching on wikipedia, please be patient...');

        var options = {
            url: 'https://community-wikipedia.p.mashape.com/api.php?action=query&format=json&prop=info&titles='+request.argument,
            headers: {
                'X-Mashape-Key': 'bv1DLXqY1fmshsJ8Z5qSSSg4YKZNp166maLjsnboblWBtB2JMB',
                'Accept':'application/json'
            }
        };

        request_helper(options,function(error, response, body) {

                if (!error && response.statusCode == 200) {
                    var data = JSON.parse(body);
                    data = data.query.pages;
                    var key = Object.keys(data)[0];
                    var title=data[key].title;
                    title=title.replace(' ','_');
                    send_message(request.stanza.attrs.from,"Te recomiendo que visites esta pagina: https://en.wikipedia.org/wiki/"+title);
                }
        });

        return true;
    });

    /**
     * Set the bot's status message to the provided term
     * @param {Object} request
     */
    add_command('s', function(request) {
        //set_status_message(request.argument);
        send_message(request.stanza.attrs.from, "Status message now set to " + request.argument);
        send_message(request.stanza.attrs.from, "This feature has been disabled on this public bot due to abuse. Sorry");
        return true;
    });

    if(config.allow_auto_subscribe) {
        // allow the bot to respond to subscription requests
        // and automatically accept them if enabled in the config
        conn.addListener('online', request_google_roster);
        conn.addListener('stanza', accept_subscription_requests);
    }

    conn.on('stanza',message_dispatcher);

    conn.on('online', function() {

        console.log("online")   ;
        set_status_message(config.status_message);
        // send whitespace to keep the connection alive
        // and prevent timeouts
        setInterval(function() {
            conn.send(' ');
        }, 30000);
    });

    conn.on('error', function(stanza) {
        util.log('[error] ' + stanza.toString());
    });

    return commands;
}
                      /*
                      *           var options2 = {
                       url: 'https://community-wikipedia.p.mashape.com/api.php?action=parse&prop=text&pageid='+ key+'&format=json',
                       headers: {
                       'X-Mashape-Key': 'bv1DLXqY1fmshsJ8Z5qSSSg4YKZNp166maLjsnboblWBtB2JMB',
                       'Accept':'application/json'
                       }
                       };

                       request_helper(options,function(error, response, body) {

                       if (!error && response.statusCode == 200) {
                       console.log(body);
                       }
                       });

                       }*/