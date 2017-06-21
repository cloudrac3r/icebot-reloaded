/// === REQUIREMENTS ===

let Discord = require('discord.io');
let request = require("request");
let fs = require("fs");

/// === GLOBALS ===
let channelIndex = [];

// Read the bot token from a file
let token = fs.readFileSync("token.txt", {encoding: "utf8"}).split("\n")[0];

// Load configurables from a file
let configurables = JSON.parse(fs.readFileSync("configurablesreloaded.txt", {encoding: "utf8"}));
log("Loaded configurables", 1);

// Load XP from a file
let xp = JSON.parse(fs.readFileSync("xpreloaded.txt", {encoding: "utf8"}).slice(9));
log("Loaded XP data", 1);

// Create the bot
let bot = new Discord.Client({
    token: token,
    autorun: true
});

/// === GENERAL UTILITY FUNCTIONS ===

/*  LEGAL STUFF!
    The following Date.prototype.customFormat function is copyright 2002-2016 by Gavin Kistner, !@phrogz.net
    It is covered under the license viewable at http://phrogz.net/JS/_ReuseLicense.txt
    Reuse or modification is free provided you abide by the terms of that license. */
// Given a date object and a format string, create a new string with the date in that format.
Date.prototype.customFormat = function(formatString){
    var YYYY,YY,MMMM,MMM,MM,M,DDDD,DDD,DD,D,hhhh,hhh,hh,h,mm,m,ss,s,ampm,AMPM,dMod,th;
    var dateObject = this;
    YY = ((YYYY=dateObject.getFullYear())+"").slice(-2);
    MM = (M=dateObject.getMonth()+1)<10?('0'+M):M;
    MMM = (MMMM=["January","February","March","April","May","June","July","August","September","October","November","December"][M-1]).substring(0,3);
    DD = (D=dateObject.getDate())<10?('0'+D):D;
    DDD = (DDDD=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dateObject.getDay()]).substring(0,3);
    th=(D>=10&&D<=20)?'th':((dMod=D%10)==1)?'st':(dMod==2)?'nd':(dMod==3)?'rd':'th';
    formatString = formatString.replace("#YYYY#",YYYY).replace("#YY#",YY).replace("#MMMM#",MMMM).replace("#MMM#",MMM).replace("#MM#",MM).replace("#M#",M).replace("#DDDD#",DDDD).replace("#DDD#",DDD).replace("#DD#",DD).replace("#D#",D).replace("#th#",th);

    h=(hhh=dateObject.getHours());
    if (h==0) h=24;
    if (h>12) h-=12;
    hh = h<10?('0'+h):h;
    hhhh = hhh<10?('0'+hhh):hhh;
    AMPM=(ampm=hhh<12?'am':'pm').toUpperCase();
    mm=(m=dateObject.getMinutes())<10?('0'+m):m;
    ss=(s=dateObject.getSeconds())<10?('0'+s):s;
    return formatString.replace("#hhhh#",hhhh).replace("#hhh#",hhh).replace("#hh#",hh).replace("#h#",h).replace("#mm#",mm).replace("#m#",m).replace("#ss#",ss).replace("#s#",s).replace("#ampm#",ampm).replace("#AMPM#",AMPM);
}

// Checks the role hierarchy to see if a role is above another role.
function isAbove(r1, r2) {
    if (typeof(configurables.roleHierarchy[r1]) != "object") {
        return false;
    } else if (configurables.roleHierarchy[r1].indexOf(r2) != -1) {
        return true;
    } else {
        let result = false;
        let index = 0;
        while (!result && index < configurables.roleHierarchy[r1].length) {
            if (configurables.roleHierarchy[r1][index] != r1) {
                if (isAbove(configurables.roleHierarchy[r1][index], r2)) return true;
            }
            index++;
        }
        return false;
    }
}

// Log a message to console with regards to the logLevel (severity)
// Levels: 0 (critical) 1 (good to know) 2 (everything)
function log(message, level) {
    if (level <= configurables.logLevel) console.log(message);
}

// Convert a string to a text-channel-friendly form.
// More specifically, change spaces → underscores, special characters → hyphens, and remove leading hypens/underscores.
// This function is dedicated to Donald Trump, 2017. #covfefe
function makeStringGreatAgain(string) {
    let fakeNews = string.toLowerCase();
    let okay = fakeNews.replace(/ /g, "_");
    let good = okay.replace(/[^_a-z]/g, "-");
    let great = good.replace(/^[-_]*/, "");
    return great;
}

// Returns all the elements shared between two arrays in another array.
function matchingElementFromArray(array1, array2) {
    let matches = [];
    for (let i of array1) {
        if (array2.indexOf(i) != -1) matches.push(i);
    }
    return matches;
}

// Given a word and a number, returns the plural form of that word.
function plural(word, number) {
    var plurals = {
        is: "are", foot: "feet", person: "people", werewolf: "werewolves", wolf: "wolves" // Add more irrlegular plurals here if you need them
    };
    if (number != 1) {
        if (plurals[word] != undefined) {
            word = plurals[word];
        } else {
            if (word.endsWith("s") || word.endsWith("ch")) {
                word += "es";
            } else {
                word += "s";
            }
        }
    }
    return word;
}

/// === BOT UTILITY FUNCTIONS ===

// Award that userID with a certain amount of XP and voice chat time
function awardXP(userID, amount, time) {
    if (xp[userID] == undefined) { // Create an XP object for the user if there isn't already one
        xp[userID] = {};
        xp[userID].xp = 0;
        xp[userID].totalxp = 0;
        xp[userID].time = 0;
        xp[userID].level = 1;
        xp[userID].lastSpoke = 0;
    }
    xp[userID].name = bot.users[userID].username; // Update the username, nickname and roles
    xp[userID].nick = userIDToNick(userID, configurables.server);
    xp[userID].roles = bot.servers[configurables.server].members[userID].roles;
    if (time) { // If time was specified, increase it
        xp[userID].time += time;
        xp[userID].lastSpoke = Date.now();
    }
    if (amount) { // If amount was specified, increase it
        xp[userID].xp += amount;
        xp[userID].totalxp += amount;
    }
    while (xp[userID].xp > xp[userID].level*100) { // Level up
        xp[userID].xp -= xp[userID].level*100;
        xp[userID].level++;
    }

}

// Create a new channel on a server.
function createChannel(name, type, server, callback, attempts) {
    if (!name || !type || !server) {
        if (callback) callback(true);
        return;
    }
    if (!attempts) attempts = 0; // Set attempts if it was not set
    if (type == "text") { // Set up variables depending on the channel type
        name = makeStringGreatAgain(name);
    }
    bot.createChannel({serverID: server, name: name, type: type}, function(err, res) {
        if (err) {
            attempts++;
            let toLog = "An error occurred while creating a channel (attempt "+attempts+")!\nserverID: "+server+", name: "+name+"\nError: "+err+"\n";
            // Retry (or not)
            if (attempts >= configurables.maxAttempts) {
                toLog += "Will not retry.";
                callback(true);
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    createChannel(name, type, server, callback, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else {
            log("Created a channel \""+name+"\".");
            if (callback) callback(false, res.id);
        }
    });
}

// Creates the channel index and sets channel positions correctly.
function createIndex() {
    let t = Date.now(); // Time how long it took
    channelIndex.length = 0; // Clear the channelIndex array
    let highest = 0;
    for (let c in bot.servers[server].channels) { // Find the highest index to loop up to
        if (bot.servers[server].channels[c].position > highest && bot.servers[server].channels[c].type == "voice") highest = bot.servers[server].channels[c].position;
    }
    for (let i = 0; i <= highest; i++) { // Loop through and push channels to channelIndex
        for (c in bot.servers[server].channels) {
            if (bot.servers[server].channels[c].position == i && bot.servers[server].channels[c].type == "voice") {
                channelIndex.push(bot.servers[server].channels[c]);
            }
        }
    }
    log("Indexed in "+(Date.now()-t)+"ms", 2); // Log the loop time
    fixChannelPositions(); // Send a request to Discord
}

// Given a role name, fetches its ID. Returns undefined if name couldn't be matched. 
function getRoleID(name, server) {
    for (let r in bot.servers[server].roles) { // Loop through every role on the server
        let role = bot.servers[server].roles[r]; // If the role matches...
        if (role.name == name) return role.id; // Return it.
    }
    return null; // Otherwise, return null
}

// Set the position values of every channel
function fixChannelPositions(attempts) {
    if (!attempts) attempts = 0;
    let body = []; // What to send
    for (let i = 0; i < channelIndex.length; i++) { // Add every channel which needs to move
        if (channelIndex[i].position != i) {
            body.push({"id": channelIndex[i].id, "position": i});
        }
    }
    request({
        url: "https://discordapp.com/api/guilds/"+configurables.server+"/channels",
        headers: {
            "User-Agent": "DiscordBot (https://discordapp.com/, 1.0)",
            "Authorization": "Bot "+token,
            "Content-Type": "application/json"
        },
        method: "PATCH",
        body: JSON.stringify(body)
    }, function(error, response, body) {
        if (error) { // If an error occurred
            attempts++;
            let toLog = "An error occurred while resetting channel positions (attempt "+attempts+")!\nlength: "+channelIndex.length+"\nError: "+error+", response: "+response+", body: "+body+"\n";
            // Retry (or not)
            if (attempts > configurables.maxAttempts) {
                toLog += "Will not retry.";
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    fixChannelPositions(attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else { // If there was no error
            log("Reset channel positions successfully", 2);
        }
    });
}

// Save the current configurables object to a file
function saveConfigurables() {
    fs.writeFile("configurablesreloaded.txt", JSON.stringify(configurables, null, 4), {encoding: "utf8"}, function() {});
}

// Send a message made of an embed to a channel. Retries automatically if it fails.
// The attempts option should not be specified when calling this function outside of this function.
function sendEmbedMessage(channelID, title, message, type, attempts) {
    let fields = [];
    if (title == "multifield") {
        fields = message;
    } else {
        fields.push({name: title, value: message});
    }
    bot.sendMessage({
        to: channelID,
        embed: {
            color: configurables.colourLookup[type],
            fields: fields
        }
    }, function(err) {
        if (err) { // If an error occurred
            attempts++;
            let toLog = "An error occurred while sending a message (attempt "+attempts+")!\nchannelID: "+channelID+", message: "+message+"\nError: "+err+"\n";
            // Retry (or not)
            if (attempts > configurables.maxAttempts) {
                toLog += "Will not retry.";
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    sendEmbedMessage(channelID, title, message, type, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else { // If there was no error
            log("Sent a message to "+channelID+": "+message, 2);
        }
    });
}

// Send a message to a channel. Retries automatically if it fails.
// The attempts option should not be specified when calling this function outside of this function.
function sendMessage(channelID, message, attempts) {
    if (message == undefined) return;
    if (typeof(message) == "object") message = JSON.stringify(message);
    if (!attempts) attempts = 0; // Set attempts if it was not set
    bot.sendMessage({to: channelID, message: message}, function(err) {
        if (err) { // If an error occurred
            attempts++;
            let toLog = "An error occurred while sending a message (attempt "+attempts+")!\nchannelID: "+channelID+", message: "+message+"\nError: "+err+"\n";
            // Retry (or not)
            if (attempts >= configurables.maxAttempts) {
                toLog += "Will not retry.";
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    sendMessage(channelID, message, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else { // If there was no error
            log("Sent a message to "+channelID+": "+message, 2);
        }
    });
}

// Given a userID, return the username or nickname.
function userIDToNick(userID, serverID) {
    if (serverID) { // If a server was specified...
        return (bot.servers[serverID].members[userID].nick || bot.users[userID].username); // Return the nickname if there is one, otherwise return the username
    } else {
        return bot.users[userID].username; // Return the username
    }
}

/// === BOT FUNCTIONS ===

function friendlyChannelCreation(name, type, channelID) {
    if (!type || !name) {
        sendMessage(channelID, "Not enough information provided. Try `/create <public|members|recruiter|private> CHANNEL NAME`.");
        return;
    }
    type = type.toLowerCase(); // Convert type to lowercase
    if (type == "member") type = "members"; // Convert misspellings
    log("Creating a pair of channels with base name: "+name, 2);
    createChannel("--- "+name, "voice", bot.channels[channelID].guild_id, function(err, vcid) {
        if (err) {
            sendEmbedMessage(channelID, "Failed to create a voice channel", "Something went wrong, and the voice channel wasn't created. Maybe you mistyped some information, or the bot doesn't have permission to manage channels.", "error");
            log("Voice channel creation failed!\ntype: "+type+", name: "+name, 1);
        } else {
            createChannel(name, "text", bot.channels[channelID].guild_id, function(err, tcid) {
                if (err) {
                    sendEmbedMessage(channelID, "Failed to create a text channel", "A voice channel was created but a text channel wasn't. Maybe the channel name couldn't be converted to a text-channel-friendly format. ("+name+" → "+makeStringGreatAgain(name)+")", "error");
                    log("Text channel creation failed!\ntype: "+type+", name: "+name+", greatName: "+makeStringGreatAgain(name), 1);
                } else {
                    bot.createInvite({channelID: vcid}, function(err, res) {
                        if (!err) {
                            sendEmbedMessage(channelID, "multifield", [
                            {
                                name: "Created channels successfully",
                                value: "You now have a new voice channel named **"+bot.channels[vcid].name+"** and a text channel named **"+bot.channels[tcid].name+"**."
                            }, {
                                name: "Instant invite link (click to connect)",
                                value: "https://discord.gg/"+res.code
                            }], "success");
                        } else {
                            sendEmbedMessage(channelID, "Created channels successfully", "A new voice channel and a new text channel were created.", "success");
                        }
                    });
                    log("Created a pair of channels: "+name+"/"+makeStringGreatAgain(name), 2);
                }
            });
        }
    });
    return;
    
    if (type == "/create") { // 
        bot.sendMessage({to: channelID, message: "Not enough information provided. Try `/create <public|members|recruiter|private> CHANNEL NAME`."});
    } else if (words[1] != "public" && words[1] != "members" && words[1] != "private" && words[1] != "recruiter") {
        bot.sendMessage({to: channelID, message: "Incorrect channel type - must be `public`, `members`, `recruiter` or `private`. Try `/create <public|members|recruiter|private> CHANNEL NAME`."});
    } else if (words.length < 3) {
        bot.sendMessage({to: channelID, message: "Not enough information provided. Try `/create <public|members|recruiter|private> CHANNEL NAME`."});
    } else {
        let position;
        let marker;
        let roleP;
        let roles = bot.servers[server].members[userID].roles;
        for (let r of roles) {
            if (roleLookup[r] != undefined) {
                roleP = r;
                switch (words[1]) {
                case "private":
                    marker = roleLookup[r]["members"];
                    break;
                case "recruiter":
                    marker = roleLookup[r]["public"];
                    break;
                default:
                    marker = roleLookup[r][words[1]];
                    break;
                }
            }
        }
        for (let i of channelIndex) {
            if (i.id == marker) position = i.position;
        }
        if (position != undefined) {
            bot.createChannel({
                serverID: server,
                name: "---"+message.split("<")[0].split(" ").slice(2).join(" "),
                type: "voice"
            }, (err, res) => {
                if (err) {
                    bot.sendMessage({to: channelID, message: "Failed to create channel. Logged to console."});
                    console.log(err);
                    return;
                } else {
                    channelIndex.splice(position+1, 0, bot.channels[res.id]);
                    fixChannelPositions();
                    channel_activity[res.id] = {time: Date.now(), members: [userID]};
                    bot.createChannel({
                        serverID: server,
                        name: makeStringGreatAgain(message.split("<")[0].split(" ").slice(2).join(" ")),
                        type: "text"
                    }, function(e, r) {
                        if (e) {
                            bot.sendMessage({to: channelID, message: "Couldn't create a text channel. This is probably because its name couldn't be converted to a text-channel-friendly form (i.e. alphanumeric with dashes and underscores only)."});
                        } else {
                            channel_activity[res.id].text = r.id;
                            bot.editChannelPermissions({channelID: r.id, roleID: server, deny: [Discord.Permissions.TEXT_READ_MESSAGES], allow: [Discord.Permissions.TEXT_EMBED_LINKS, Discord.Permissions.TEXT_ATTACH_FILES]}, function() {
                                bot.editChannelPermissions({channelID: r.id, userID: userID, allow: [Discord.Permissions.TEXT_READ_MESSAGES]}, function() {
                                    bot.sendMessage({to: r.id, message: "REMEMBER: No one else can see this channel until you invite them (or they connect to the linked voice channel).\nUse `/invite @mention`."});
                                });
                                bot.editChannelPermissions({channelID: r.id, roleID: VCmodRole, allow: [Discord.Permissions.TEXT_READ_MESSAGES]});
                            });
                            for (let m of event.d.mentions) {
                                bot.editChannelPermissions({channelID: r.id, userID: m.id, allow: [Discord.Permissions.TEXT_READ_MESSAGES]});
                                channel_activity[r.id].members.push(m.id);
                            }
                        }
                    });
                    console.log("Created channel "+bot.channels[res.id].name+" at "+Date.now()+"\nEntire list looks like:\n"+JSON.stringify(channel_activity));
                    if (words[1] == "members") {
                        bot.editChannelPermissions({channelID: res.id, roleID: server, deny: [Discord.Permissions.VOICE_CONNECT]});
                        bot.editChannelPermissions({channelID: res.id, roleID: roleP, allow: [Discord.Permissions.VOICE_CONNECT]});
                        bot.editChannelPermissions({channelID: res.id, roleID: VCmodRole, allow: [Discord.Permissions.VOICE_CONNECT]});
                    } else if (words[1] == "private" || words[1] == "recruiter") {
                        console.log(event.d.mentions);
                        bot.editChannelPermissions({channelID: res.id, roleID: server, deny: [Discord.Permissions.VOICE_CONNECT]});
                        bot.editChannelPermissions({channelID: res.id, userID: userID, allow: [Discord.Permissions.VOICE_CONNECT]});
                        bot.editChannelPermissions({channelID: res.id, roleID: VCmodRole, allow: [Discord.Permissions.VOICE_CONNECT]});
                        for (let m of event.d.mentions) {
                            bot.editChannelPermissions({channelID: res.id, userID: m.id, allow: [Discord.Permissions.VOICE_CONNECT]});
                        }
                        if (words[1] == "recruiter") bot.editChannelPermissions({channelID: res.id, roleID: configurables.needsReceptionistRole, allow: [Discord.Permissions.VOICE_CONNECT, Discord.Permissions.VOICE_SPEAK]});
                    }
                    sendEmbedMessage(channelID, "A new channel has been created!", "**"+user+"** made a new channel: **"+res.name+"**", "success");
                }
            });
        } else {
            sendEmbedMessage(channelID, "Channel could not be created!", "**"+user+"** doesn't have a clan role.", "error");
        }
    }
}

// Gathers information about the rank of the supplied userID and sends it.
function rank(userID, channelID) {
    if (xp[userID] == undefined) { // If there's no data available...
        sendEmbedMessage(channelID, "No data exists", "Spend time in a voice channel to gain experience!", "error");
    } else { // If there is data available...
        let timeSpent = new Date(xp[userID].time*1000); // Convert the seconds to a Date object
        let days = Math.floor(xp[userID].time/(60*60*24)); // Convert the seconds to days
        let daysM = ""; // Will hold the days message
        if (days > 0) daysM = "**"+days+"** "+plural("day", days)+", "; // If there's at least 1 day, set daysM
        bot.sendMessage({ // Send the embed message. Enough said.
            to: channelID,
            embed: {
                color: 0x402590,
                author: {
                    name: "Voice chat rank of "+bot.users[userID].username,
                    icon_url: "https://cdn.discordapp.com/avatars/"+userID+"/"+bot.users[userID].avatar+".png"
                },
                fields: [
                    {
                        name: "XP earned",
                        value: "**"+xp[userID].xp+"** points\nNext level at **"+xp[userID].level*100+"** points",
                        inline: true
                    },{
                        name: "Level reached",
                        value: "Level **"+xp[userID].level+"**",
                        inline: true
                    },{
                        name: "Time spent",
                        value: daysM+"**"+timeSpent.getUTCHours()+"** "+plural("hour", timeSpent.getUTCHours())+
                                   ", **"+timeSpent.getUTCMinutes()+"** "+plural("minute", timeSpent.getUTCMinutes())+
                                   ", **"+timeSpent.getUTCSeconds()+"** "+plural("second", timeSpent.getUTCSeconds()),
                        inline: true
                    }
                ]
            }
        });
    }
}

// Return a roleID in a prettier form
function friendlyRoleLookup(channelID, roleName) {
    let roleID = getRoleID(roleName, bot.channels[channelID].guild_id);
    if (!roleID) {
        sendMessage(channelID, "There's no role with the name \""+roleName+"\".");
    } else {
        sendMessage(channelID, "The ID of the role named \""+roleName+"\" is `"+roleID+"`.");
    }
}

/// === BOT SCRIPT ===

// When the bot connects to Discord
bot.on("ready", function() {
    log("Logged in", 1);
    setInterval(function() {
        let modified = false;
        for (member in bot.servers[configurables.server].members) {
            let vcid = bot.servers[configurables.server].members[member].voice_channel_id;
            if (vcid) {
                awardXP(member, Math.floor(Math.random()*3+4), 10);
            }
        }
        if (modified) fs.writeFile("xpreloaded.txt", "let xp = "+JSON.stringify(xp), {encoding: "utf8"}, function() {});
        //saveConfigurables();
    }, 10000);
});

// When a message is sent
bot.on("message", function(user, userID, channelID, message, event) {
    if (bot.users[userID].bot) return; // Ignore messages from bot users
    message = message.replace(/  */g, " "); // Convert multiple spaces into 1 space
    if (message.charAt(0) == "/") {
        switch(message.split(" ")[0].toLowerCase()) { // Run code block based on first word of message
        case "/eval": // Run the message as a JS command
            sendMessage(channelID, eval(message.split(" ").slice(1).join(" ")));
            break;
        case "/help": // Send the list of bot commands
            sendMessage(channelID, "Welcome to "+bot.username+"! Commands are prefixed with a `/`.\nHere's the list of common commands: /help, /rank\nHere's the list of less useful commands: /eval, /roleid");
            break;
        case "/rank": // Send a user's XP, level, and related info
            if (event.d.mentions[0]) {
                rank(event.d.mentions[0].id, channelID);
            } else {
                rank(userID, channelID);
            }
            break;
        case "/roleid": // Send the ID of a role
            friendlyRoleLookup(channelID, message.split(" ").slice(1).join(" "));
            break;
        case "/create": // Create a temporary voice channel and linked text channel
            friendlyChannelCreation(message.split(" ").slice(2).join(" "), message.split(" ")[1], channelID);
            break;
        }
    }
    awardXP(userID, 1);
});

// If the bot disconnects from Discord...
bot.on("disconnect", function() {
    bot.connect(); // Reconnect.
    console.log("Bot disconnected. Reconnecting...");
});