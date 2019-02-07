This project is simple musicbot used for Discord.
This project currently supports only youtube links.

Setting bot up

    NOTE: YOU MUST HAVE node.js INSTALLED ON YOUR SYSTEM!
    Windows:
        NOTE: You need to have python set up as environmental variable!
        open install-prerequisites.bat
        Edit config.json to your needs
        open startbot.bat
        bot should now be running!
    
    Linux:
        NOTE: To execute a file in Linux environment you first need to run command "sudo chmod +x {filename}" to make it       executable and then you can execute it with command "./{filename}".
        execute install-prerequisites.sh
        edit config.json to your needs
        execute startbot.sh
        bot should now be running!

Config.json

    token - put here your Discord bot token. You can get it from here: https://discordapp.com/developers

    prefix - put here your preferred prefix (I prefer "-")

    status - put here what you want your bot to be "playing" when in idle.

    volume - put here your preferred bot volume (I prefer "0.5")

    roast - message displayed with roast command

    radio - URL you want to stream from (This can be radio station for example)

    radioname - Will be the name for radio you have chosen. Radio will be queued with (prefix+radioname, ex. "-Metro95.1"). Don't use spaces in radioname!!

Commands:

    play - used to add song to queue Ex. "-play https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    skip - used to skip currently playing song

    stop - used to disconnect bot from voice channel

    volume - used to ask current volume ("-volume") or set volume to wanted value Ex. "-volume 0.2" will set volume to 0.2 (20%)

    reset/restart - used to completely reset the bot if something is not correct.

    roast - "fun" command to roast yourself

    queue - used to ask bot current queue

    pause - used to pause bot

    resume - used to resume bot

    help - used to display all the commands

    radioname - if you have set up radio you can play it with this command NOTE: radioname is what you have set up in config!

# discord-musicbot-js
