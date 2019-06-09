/*
    Simple musicbot for Discord so you can play your favorite songs on your
    own server. Currently supports only youtube.
    Author: Marius Niemenmaa, https://github.com/LokSrc/
*/

const Discord = require('discord.js');

const ytdl = require('ytdl-core');

const config = require('./config.json');

const Entry = require('./entry.js');

const roasts = require('./roasts.json').roasts.array;

const TOKEN = config.token;

const PREFIX = config.prefix;

const STATUS = config.status;

const VOLUME = config.volume;

const RADIO = config.radio;

const RADIONAME = config.radioName;

const noLinksChannel = config.noLinksChannel;

const movemeChannel = config.moveme;

const movemeRole = config.movemeRole;

const adminRole = config.adminRole;

const discordStyles = {"codeblock": "```"};

const helpMsg = "reset/restart - Resets bot in case it has become unresponsive\nroast - Bot takes random roast and roasts your friend!\nhelp - Show all commands\np/play - Used to queue music\nstop - Used to stop all music and empty the queue\nvol/volume - Get/Set volume\ns/skip - Skip current song\nq/queue - Shows queue\nshuffle - shuffles current queue\np/pause - Pauses the player\nr/resume - Resumes paused player\nloop - Sets the current queue to loop\n";

const voteSkip = false;

var radiostatus;


/* TODO:
        playlist support
        Logging
*/

function play(connection, message) { 
    var server = servers[message.guild.id];
    var song = server.queue[0];

    // Lets make sure url is youtube link and then stream it to current server
    if (song instanceof Entry && ytdl.validateURL(song.getLink())) {
        server.dispatcher = connection.playStream(ytdl(song.getLink(), {filter: "audioonly"}));

        // Set bot's status to match song it is playing
        ytdl.getBasicInfo(song.getLink(), function(err,info) {
            if (info == null || err) return;
            bot.user.setActivity(info.title);
        });

    } else if (server.queue[0] == RADIO) {
        server.dispatcher = connection.playFile(RADIO);
        bot.user.setActivity(RADIONAME);
    }

    // Make sure we have correct volume for current server
    server.dispatcher.setVolume(server.volume);

    // When song ends play next or if queue is empty leave voice channel.
    server.dispatcher.on("end", function() {
        // If looping is set to true -> loop playlist
        if (server.looping) {
            server.queue.push(server.queue[0]);
        }
        server.queue.shift();

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

function songQueued(message, link, youtube, index) {
    /*
        Function that will tell the user that song has been succesfully
        queued or in case of error will notice user about it.
    */
    var queue = servers[message.guild.id].queue
    if (!queue[index] instanceof Entry) return; // TODO: Log this
    if (youtube) {
        ytdl.getBasicInfo(link, function(err,info) {
            if (err) {
                console.log(err);
                return;
            }
            if (info == null) {
                message.reply('Invalid link (playlists not supported yet)...');
                queue[index].setName("Not supported");
                return;
            }
            message.channel.send('Queued: ' + info.title);
            queue[index].setName(info.title);
            if (index == 0) bot.user.setActivity(info.title);
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

    if (typeof server.queue == "undefined" || server.queue.length == 0) {
        message.channel.send("Queue is empty.");
        return;
    } 

    message.channel.send("Current Queue: ");
    var msg = discordStyles.codeblock;
    for (var i = 0; i < server.queue.length; i++) {
        let song = server.queue[i];
        if (!song instanceof Entry) continue;
        if (i == 0) msg += "Current song: " + song.getName() + " - Queued by: " + song.getAuthor().username + "\n";
        else msg += i.toString() + ": " + song.getName() + " - Queued by: " + song.getAuthor().username + "\n";
    }
    msg += discordStyles.codeblock;
    message.channel.send(msg);
}

function initPlayer(message) {
    // Lets setup player for our server if there is not one
    if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: [],
        looping: false,
        paused: false,
        volume: VOLUME
    };
}

function checkLink(message) {
    // Checks that links are not posted in channel "noLinksChannel"
    if (message.channel.id == noLinksChannel && (message.content.includes('www.') || message.content.includes('http') || message.content.includes('.fi') || message.content.includes('.com') || message.content.includes('.net'))) {
        message.author.send('Links are not allowed in this channel!');
        message.delete();
    }
    return;
}

function playerChecks(message) {
    // Will verify we can play some music
    if(!message.member.voiceChannel) {
        message.channel.send("You must be in a voice channel");
        return false;
    }
    initPlayer(message);   
    return true;
}

function shuffle(a) {
    /* Fisher-Yales shuffle algorithm
     * Shuffles array */
    var currentSong = a[0];
    a.shift();
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    a.unshift(currentSong);
    return a;
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
        if (!message.content.startsWith(PREFIX)) {
            checkLink(message);
            return;
        };
        if (message.channel instanceof Discord.DMChannel) return;

        // Command arguments are stored in args.
        var args = message.content.substring(PREFIX.length).split(" ");

        switch (args[0].toLowerCase())  {
            case "moveme":
                // If moveme is not fully activated from config.json -> return
                if (movemeChannel == "") return;
                if (movemeRole == "") return;

                var hasRole = message.member.roles.has(movemeRole)
                if (message.member.voiceChannel && hasRole) {
                    console.log("Moving " + message.author.username + " to ") // TODO
                    message.member.setVoiceChannel(movemeChannel);
                };
                message.delete();
                break;

            case "p":    
            case "play":
                if(!args[1]) {
                    message.channel.send("Arguments missing!");
                    return;
                }
                var ready = playerChecks(message);
                if (!ready) return;
                // Lets queue a song if it is recognized as youtube link
                var queue = servers[message.guild.id].queue;
                if (ytdl.validateURL(args[1])) {
                    queue.push(new Entry(args[1], message.author));
                    songQueued(message, args[1], true, queue.length - 1); // TODO: Better implementation of this
                } else {
                    message.channel.send("Please provide valid link");
                    return;
                } 

                // Make the bot join users voice channel and play first song of queue
                if (!message.guild.voiceConnection) message.member.voiceChannel.join().then(function(connection) {
                    play(connection, message);
                });
                break;
            
            case "s":
            case "skip":
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var server = servers[message.guild.id];

                // We will try to skip targeted song
                try {
                    var index;
                    if (args.length > 1) index = Number(args[1]);
                    else index = 0;
                
                    if (index < 0 || index > server.queue.length - 1) {
                        message.reply("Check your index...");
                        return;
                    }
                    if (!voteSkip || message.member.roles.has(adminRole) || server.queue[index].getAuthor().id == message.author.id) {
                        if (index == 0) server.dispatcher.end();
                        else server.queue.splice(index,1);
                        message.channel.send("Removed song from index: " + index.toString());
                        return;
                    } else {
                        server.queue[index].addVote(message.author.id);
                        var votesNeeded = 10; // TODO: Correct rate
                        if (votesNeeded < server.queue[index].getVotes()) {
                            server.queue.splice(index,1);
                            message.channel.send("Removed song from index: " + index.toString());
                            return;
                        }
                        message.channel.send("Voteskip started for: " + server.queue[index].getName() + ". Votes received: " + server.queue[index].getVotes() + "/" + votesNeeded);
                        return;
                }
                } catch (e) {
                    message.reply("Queue doesn't include that index...");
                }
                break;

            case "stop":
                if (!servers[message.guild.id]) return;
                var server = servers[message.guild.id];
                if (adminRole != "" && !message.member.roles.has(adminRole)) {
                    message.reply("You are not allowed to use this command!");
                    return;
                }
                bot.user.setActivity(STATUS);
                server.queue = [];
                server.paused = false;
                server.looping = false;
                if(message.guild.voiceConnection) message.guild.voiceConnection.disconnect();
                break;
            
            case "vol":
            case "volume":
                if (!servers[message.guild.id]) {
                    message.channel.send("Queue something first.");
                    return;
                };
                var server = servers[message.guild.id];

                // Reply with volume if value is not given else we will try to set volume to match value
                if (args.length < 2) {
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
                if (adminRole != "" && !message.member.roles.has(adminRole)) {
                    message.reply("You are not allowed to use this command!");
                    return;
                }
                resetBot(message);
                break;   

            case "roast":
                if (args.length < 2) {
                    message.author.send("Usage of this command is 'roast nameOfPersonBeingRoasted'");
                    message.delete();
                    return;
                }
                var ranLen = roasts.length;
                message.channel.send(roasts[Math.floor((Math.random() * ranLen) + 1)].replace(/\$\{roastedName\}/g, args[1]), {tts:true});
                message.delete();
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
                var queue = servers[message.guild.id].queue;
                var ready = playerChecks(message);
                if (!ready) return;
                queue.push(new Entry(RADIO, message.author));
                queue[queue.length - 1].setName(RADIONAME);
                message.reply(RADIONAME + " queued!");
                // Make the bot join users voice channel and play first song of queue
                if (!message.guild.voiceConnection) message.member.voiceChannel.join().then(function(connection) {
                    play(connection, message);
                });
                break;
            
            case "loop":
                initPlayer(message);
                var server = servers[message.guild.id];
                server.looping = !server.looping;

                if (server.looping) message.reply("Now looping the queue!");
                else message.reply("Looping turned off!");
                break;

            case "shuffle":
                var server = servers[message.guild.id];
                if (typeof server.queue != "undefined" && server.queue.length > 0) {
                    shuffle(server.queue);
                    message.reply("Shuffling done!");
                } else {
                    message.channel.send("Queue something first!");
                }
                break;

            case "help":
                if (radiostatus) {
                    message.reply(discordStyles.codeblock + helpMsg + discordStyles.codeblock);
                } else {
                    message.reply(discordStyles.codeblock + helpMsg  + RADIONAME.toLowerCase() + discordStyles.codeblock);
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
