var http    = require('http');
var express = require('express');
var irc 		= require('./node-irc/irc');
var io      = require('socket.io');

var app     = express().engine('html', require('ejs').renderFile)
                       .set('view engine', 'html')
                       .set('views', __dirname + '/views')
                       .use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.render('index');
});

var server  = http.createServer(app)
                  .listen(process.env.PORT || 3000);

var io      = io.listen(server);

io.sockets.on('connection', function (client) {	
	client.on('connectToIRC', function (data) {
		var channels = data.options.channels.replace(" ","").split(",");
		
		// initialize irc connection
		var ircClient = new irc.Client(data.options.server, data.options.nickname, {
			port: 		data.options.port || 6667,
			channels: channels
		});

    // join channel listener
    ircClient.addListener('join', function (channel, nick, message) {
      client.emit('joinedChannel', { channel: channel });
		});
    
    // listener for normal messages
    ircClient.addListener('message', function (from, to, text, message) {
			client.emit('newChannelMessage', { channel: to, from: from, message: text });
		});

    // add listener for private messages
    ircClient.addListener('pm', function (from, text, message) {
			client.emit('newPrivateMessage', { from: from, message: text });
		});

		// clients wanting to send a message
		client.on('sendMsg', function (data) {
			ircClient.say(data.to, data.message);
		});
    
    client.on('command', function (data) {
      var command = data.split(' ')[0].substr(1).toUpperCase();
      
      var args = data.split(' ');
      args.shift();
      
      var message = {
        command:  command,
        nick:     ircClient.nick,
        args:     args
      }
      
      ircClient.emit('raw', message);
      ircClient.send.apply(ircClient, [command].concat(args));
		});
    
		// client disconnected
		client.on('disconnect', function () {
			ircClient.disconnect();
		});
	});
});