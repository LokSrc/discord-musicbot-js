/*
    Simple musicbot for Discord so you can play your favorite songs on your
    own server. Currently supports only youtube.
    Author: Marius Niemenmaa, https://github.com/LokSrc/
*/

const Discord = require('discord.js');

const ytdl = require('ytdl-core');

const config = require('./config.json');

const TOKEN = config.token;

const PREFIX = config.prefix;

const STATUS = config.status;

const VOLUME = config.volume;

const roastMessage = config.roast;

const RADIO = config.radio;

const RADIONAME = config.radioName;

const discordStyles = {"codeblock": "```"};

var radiostatus;


/* TODO:
        soundcloud support
        shuffle command
        playlist support
        Logging
*/

function play(connection, message) { 
    var server = servers[message.guild.id];

    // Lets make sure url is youtube link and then stream it to current server
    if (ytdl.validateURL(server.queue[0])) {
        server.dispatcher = connection.playStream(ytdl(server.queue[0], {filter: "audioonly"}));

        // Set bot's status to match song it is playing
        ytdl.getBasicInfo(server.queue[0], function(err,info) {
            if (info == null || err) return;
            bot.user.setActivity(info.title);
        });

    } else if (server.queue[0] == RADIO) {
        server.dispatcher = connection.playFile(RADIO);
        bot.user.setActivity(RADIONAME);
    }

    // Make sure we have correct volume for current server and update song queue
    server.dispatcher.setVolume(server.volume);
    server.queue.shift();
    server.queueN.shift();

    // When song ends play next or if queue is empty leave voice channel.
    server.dispatcher.on("end", function() {
        if(server.queue[0]) play(connection, message);
        else {
            server.dispatcher = false;
            server.paused = false;
            message.guild.voiceConnection.disconnect();
            bot.user.setActivity(STATUS);
        }
    });
}

function resetBot(message) {
    /*
        Function that will be used if user wants to
        completely reset the bot for some reason.
    */
    message.channel.send("Resetting BOT!")
    .then(() => bot.destroy())
    .then(() => servers = {})
    .then(() => bot = new Discord.Client())
    .then(() => botSetup())
    .catch(function(error){
        console.log(error);
    });
}

function songQueued(message, link, youtube) {
    /*
        Function that will tell the user that song has been succesfully
        queued or in case of error will notice user about it.
    */
    if (youtube) {
        ytdl.getBasicInfo(link, function(err,info) {
            if (err) {
                console.log(err);
                return;
            }
            if (info == null) {
                message.reply('Invalid link (playlists not supported yet)...');
                return;
            }
            message.channel.send('Queued: ' + info.title);
            servers[message.guild.id].queueN.push(info.title);
        });
    }
}

function queueReply(message) {
    /*
        Function that will tell the user all the songs in
        current queue when asked.
    */
    var server = servers[message.guild.id];

    if (typeof server == "undefined") {
        message.channel.send("Queue is empty.");
        return;
    }

    if (typeof server.queueN == "undefined" || server.queueN.length == 0) {
        message.channel.send("Queue is empty.");
        return;
    } 

    message.channel.send("Current Queue: ");
    var msg = discordStyles.codeblock;
    for (var i = 0; i < server.queueN.length; i++) {
        msg += server.queueN[i] + "\n";
    }
    msg += discordStyles.codeblock;
    message.channel.send(msg);
}

function playerChecks(message) {
    // Will verify we can play some music
    if(!message.member.voiceChannel) {
        message.channel.send("You must be in a voice channel");
        return false;
    }   

    // Lets setup player for our server if there is not one
    if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: [],
        queueN: [],
        paused: false,
        volume: VOLUME
    };
    return true;
}

if (RADIO != "" && RADIONAME != "") {
    radiostatus = true;
} else {
    radiostatus = false;
}

var bot = new Discord.Client();
var servers = {};

function botSetup() {
    /* 
        This function is responsible of setting up all
        the functionality our bot has. This function is
        our so called "commandhandler".
    */
    bot.on("ready", () => bot.user.setActivity(STATUS));
    bot.on("error", (e) => console.log(e));
    bot.on("message", function(message) {    
        if (message.author.equals(bot.user)) return;
        if (!message.content.startsWith(PREFIX)) return;

        // Command arguments are stored in args.
        var args = message.content.substring(PREFIX.length).split(" ");

        switch (args[0].toLowerCase())  {
            case "play":
                if(!args[1]) {
                    message.channel.send("Arguments missing!");
                    return;
                }
                var ready = playerChecks(message);
                if (!ready) return;
                // Lets queue a song if it is recognized as youtube link
                if (ytdl.validateURL(args[1])) {
                    servers[message.guild.id].queue.push(args[1]);
                    songQueued(message, args[1], true);
                } else {
                    message.channel.send("Please provide valid link");
                    return;
                } 

                // Make the bot join users voice channel and play first song of queue
                if (!message.guild.voiceConnection) message.member.voiceChannel.join().then(function(connection) {
                    play(connection, message);
                });
                break;

            case "skip":
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var server = servers[message.guild.id];

                // If something is currently playing we will skip it
                if(server.dispatcher) {
                    server.dispatcher.end();
                    message.channel.send("Skipped 1 song!");
                } else {
                    message.channel.send("No songs to skip!");
                }
                break;

            case "stop":
                if (!servers[message.guild.id]) return;
                var server = servers[message.guild.id];
                
                bot.user.setActivity(STATUS);
                server.queue = [];
                server.queueN = [];
                server.paused = false;
                if(message.guild.voiceConnection) message.guild.voiceConnection.disconnect();
                break;

            case "volume":
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var server = servers[message.guild.id];

                // Reply with volume if value is not given else we will try to set volume to match value
                if(args.length < 2) {
                    message.reply("Volume is " + server.volume);
                } else {
                    try {
                        var want_vol = Number(args[1]);
                        if (want_vol <= 1 && want_vol > 0) {
                            server.volume = want_vol;
                            servers[message.guild.id].dispatcher.setVolume(server.volume);
                            message.reply("Volume set to " + server.volume);
                        } else {
                            throw "e";
                        }
                    } catch  (e) {
                        message.reply("Incorrect value for volume");
                    }
                }
                break;

            case "reset":
            case "restart":
                    resetBot(message);
                    break;   

            case "roast":
                message.reply(roastMessage, {tts:true});
                break;

            case "queue":
            case "q":
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                }
                queueReply(message);
                break;

            case "pause":
            case "p":
                // Will pause player
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var player = servers[message.guild.id].dispatcher;

                if (player && !servers[message.guild.id].paused) {
                    player.pause();
                    servers[message.guild.id].paused = true;
                    message.reply("Pausing player!");
                } else {
                    message.reply("Player already paused or not playing anything!");
                }
                break;

            case "resume":
            case "r":
                // Will resume player
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var server = servers[message.guild.id];

                if(server.paused) {
                    server.dispatcher.resume();
                    server.paused = false;
                    message.reply("Resuming...");
                } else {
                    message.reply("Player is not paused...");
                }
                break;

            case RADIONAME.toLowerCase():
                if (!radiostatus) {
                    message.channel.send("Invalid command");
                    return;
                }
                var ready = playerChecks(message);
                if (!ready) return;
                servers[message.guild.id].queue.push(RADIO);
                servers[message.guild.id].queueN.push(RADIONAME);
                message.reply(RADIONAME + " queued!");
                // Make the bot join users voice channel and play first song of queue
                if (!message.guild.voiceConnection) message.member.voiceChannel.join().then(function(connection) {
                    play(connection, message);
                });
                break;

            case "help":
                // TODO: Make this message more user friendly
                if (radiostatus) {
                    message.reply("reset, restart, roast, help, play, stop, volume, skip, q(ueue), p(ause), r(esume), " + RADIONAME.toLowerCase());
                } else {
                    message.reply("reset, restart, roast, help, play, stop, volume, skip, q(ueue), p(ause), r(esume)");
                }
                break;

            default:
                message.channel.send("Invalid command");
        }
    });
    // Connect bot to discord
    bot.login(TOKEN);
}

botSetup();
