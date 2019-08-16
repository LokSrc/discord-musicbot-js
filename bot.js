/*
    Simple musicbot for Discord so you can play your favorite songs on your
    own server. Currently supports only youtube.
    Author: Marius Niemenmaa, https://github.com/LokSrc/
*/

require('./logger.js');

logger.info('Loading dependencies and config...');

require('./constants.js');

logger.info('Dependencies and config loaded!');

var radiostatus;


/* TODO:
        playlist support
        additional music providers? -> edit Entry accordingly
*/

if (RADIO != "" && RADIONAME != "") {
    logger.info('Radio enabled!');
    radiostatus = true;
} else {
    logger.info('Radio disabled!');
    radiostatus = false;
}

var bot = new Discord.Client();
var servers = {};

logger.info('Loading functions...');

function play(connection, message) { 
    /* This function is responsible of actually playing the music to guild channel.
    * @param connection: connection to guild channel
    * @param message: message which called this function
    */
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
    /* Function that will be used if user wants to completely reset the bot for some reason.
    * @param message: message which called this function
    */
    message.channel.send("Resetting BOT!")
    .then(() => bot.destroy())
    .then(() => servers = {})
    .then(() => bot = new Discord.Client())
    .then(() => botSetup())
    .catch(function(err){
        logger.error(err.name + "\n" + err.message + "\n" + err.stack);
    });
}

function songQueued(message, youtube, entry) {
    /* Responds to user that song has been succesfully queued or in case of error will notice user about it.
    * @param message: message which called this function
    * @param youtube: is song from youtube or other platform
    * @param entry: instance of Entry class which is the currently handled song
    */
    var queue = servers[message.guild.id].queue
    if (!entry instanceof Entry) {
        logger.error(`Queue included non Entry object! \n${queue[index]}`);
        return;
    }

    if (youtube) {
        ytdl.getBasicInfo(entry.getLink(), function(err,info) {
            if (err) {
                logger.error(err.name + "\n" + err.message + "\n" + err.stack);
                return;
            }
            if (info == null) {
                message.reply('Invalid link (playlists not supported yet)...');
                entry.setName("Not supported");
                return;
            }
            message.channel.send('Queued: ' + info.title);
            entry.setName(info.title);
        });
    }
}

function queueReply(message) {
    /* Responds to the user with a message containing all songs in the queue. (Including currently playing one).
    * @param message: message which called this function
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
    /* If there is no player for current guild. This function sets it up.
    * @param message: message which called this function
    */
    logger.info(`Initializing player for guild: ${message.guild.name}`)
    if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: [],
        looping: false,
        paused: false,
        volume: VOLUME
    };
}

function checkLink(message) {
    /* Checks that links are not posted in channel "noLinksChannel". noLinksChannel is set-up from config
    * @param message: message which called this function
    */
    if (message.channel.id == noLinksChannel && (message.content.includes('www.') || message.content.includes('http') || message.content.includes('.fi') || message.content.includes('.com') || message.content.includes('.net'))) {
        logger.info('Message containing link deleted!');
        message.author.send('Links are not allowed in this channel!');
        message.delete();
    }
    return;
}

function playerChecks(message) {
    /* Will verify we can play some music
    * @param message: message which called this function
    * @return Boolean: determines if bot can play music or not
    */
    if(!message.member.voiceChannel) {
        message.channel.send("You must be in a voice channel");
        return false;
    }
    initPlayer(message);   
    return true;
}

function shuffle(a) {
    /* Fisher-Yales shuffle algorithm
    * Shuffles array 
    * @param a variable where value is to be returned to
    * @return Array shuffled array*/
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

function findVoiceChannel(guild, id, returnChannel) {
    /* Searches for given voice channel by id
    * @param guild: guild where function was called from
    * @param id: id of the voiceChannel we are searching for
    * @param returnChannel: variable where value is to be returned to
    * @return Channel:  voiceChannel we searched for
    */
    var channels = guild.channels;
    channels.forEach(channel => {
        if (channel.id == id) returnChannel = channel;
    });
    return returnChannel;
}

function skipVotesNeeded(message, votesNeeded) {
    /* Returns the amount of skip votes needed to
    * skipping a queue Entry. 
    * @param message: message which activated this function
    * @param votesNeeded: variable where value is to be returned to
    * @return votesNeeded: amount of votes needed. -1 stands for error
    */
    votesNeeded = 0;
    try {
        var voiceConnection = bot.voiceConnections.get(message.guild.id);
        var channel = voiceConnection.channel.id;
        message.guild.members.forEach(member => {
            if (member.voiceChannel != undefined && !member.user.bot && channel == member.voiceChannel.id) votesNeeded++;
        });
        votesNeeded = Math.floor(votesNeeded / 2);
        return votesNeeded;

    } catch (err) {
        // This error appears if bot is not playing anything on server that reguested skip
        logger.error(err.name + "\n" + err.message + "\n" + err.stack);
        return -1;
    }
}

logger.info('Functions loaded!');

function botSetup() {
    /* 
        This function is responsible of setting up all
        the functionality our bot has. This function is
        our so called "commandhandler".
    */
    bot.on("ready", () => {
        bot.user.setActivity(STATUS);
        logger.info('Bot is ready!')});
    bot.on("error", (err) => logger.error(err.name + "\n" + err.message + "\n" + err.stack));
    bot.on("message", function(message) {
        if (!!message && !!message.guild) logger.info(`Discord message [${message.guild.name}][${message.channel.name}] ${message.author.username}: ${message.content}`);  
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

                var hasRole = message.member.roles.has(movemeRole);
                var channelName = findVoiceChannel(message.guild, movemeChannel, channelName).name;
                if (message.member.voiceChannel && hasRole) {
                    logger.info("Moving " + message.author.username + " to " + channelName);
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
                    var entry = new Entry(args[1], message.author);
                    songQueued(message, true, entry);
                    queue.push(entry);
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
                        var votesNeeded = skipVotesNeeded(message, votesNeeded);
                        if (votesNeeded <= server.queue[index].getVotes()) {
                            if (index == 0) server.dispatcher.end();
                            else server.queue.splice(index,1);
                            message.channel.send("Removed song from index: " + index.toString());
                            return;
                        }
                        message.channel.send("Voteskip started for: " + server.queue[index].getName() + ". Votes received: " + server.queue[index].getVotes() + "/" + votesNeeded);
                        return;
                }
                } catch (e) {
                    logger.error(e.message);
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
                logger.info(`Bot has been stopped by user: ${message.author.username}`);
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
                logger.info('Trying to reset the bot!');
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
    logger.info('Functionalities ready!');
    logger.info('Connecting to Discord...');
    bot.login(TOKEN);
}

logger.info('Setting up functionality...');
botSetup();
