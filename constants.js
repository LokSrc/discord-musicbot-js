global.Discord = require('discord.js');

global.ytdl = require('ytdl-core');

const config = require('./config.json');

global.Entry = require('./entry.js');

global.roasts = require('./roasts.json').roasts.array;

global.TOKEN = config.token;

global.PREFIX = config.prefix;

global.STATUS = config.status;

global.VOLUME = config.volume;

global.RADIO = config.radio;

global.RADIONAME = config.radioName;

global.noLinksChannel = config.noLinksChannel;

global.movemeChannel = config.movemeChannel;

global.movemeRole = config.movemeRole;

global.adminRole = config.adminRole;

global.voteSkip = config.voteSkip;

global.discordStyles = {"codeblock": "```"};

global.helpMsg = "reset/restart - Resets bot in case it has become unresponsive\nroast - Bot takes random roast and roasts your friend!\nhelp - Show all commands\np/play - Used to queue music\nstop - Used to stop all music and empty the queue\nvol/volume - Get/Set volume\ns/skip - Skip current song\nq/queue - Shows queue\nshuffle - shuffles current queue\np/pause - Pauses the player\nr/resume - Resumes paused player\nloop - Sets the current queue to loop\n";