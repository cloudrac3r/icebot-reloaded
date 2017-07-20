/// === REQUIREMENTS ===

let Discord = require('discord.io');
let request = require("request");
let fs = require("fs");

/// === GLOBALS ===
let channelIndex = [];
const messagePrefixes = {0: "[#]", 1: "[.]", 2: "[ ]"};
let restarted = false;

// Read the bot token from a file
let token = fs.readFileSync("token.txt", {encoding: "utf8"}).split("\n")[0];

// Load configurables from a file
let configurables = JSON.parse(fs.readFileSync("configurablesreloaded.txt", {encoding: "utf8"}));
log("Loaded configurables", 2);

// Load XP from a file
let xp = JSON.parse(fs.readFileSync("xpreloaded.txt", {encoding: "utf8"}).slice(9));
log("Loaded XP data", 2);

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
function isAbove(r1, r2, object) {
    if (typeof(object[r1]) != "object") {
        return false;
    } else if (object[r1].indexOf(r2) != -1) {
        return true;
    } else {
        let result = false;
        let index = 0;
        while (!result && index < object[r1].length) {
            if (object[r1][index] != r1) {
                if (isAbove(object[r1][index], r2, object)) return true;
            }
            index++;
        }
    }
}

// Log a message to console with regards to the logLevel (severity)
// Levels: 0 (critical) 1 (good to know) 2 (everything)
function log(message, level) {
    if (typeof(message) == "object") message = JSON.stringify(message);
    let prefix = messagePrefixes[level];
    if (!prefix) prefix = "[?]";
    if (level <= configurables.logLevel) console.log(prefix+" "+message);
}

// Convert a string to a text-channel-friendly form.
// More specifically, change spaces → underscores, special characters → hyphens, and remove leading hypens/underscores.
// This function is dedicated to Donald Trump, 2017. #covfefe
function makeStringGreatAgain(string) {
    let fakeNews = string.toLowerCase();
    let okay = fakeNews.replace(/ /g, "_");
    let good = okay.replace(/[^_a-z0-9]/g, "-");
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
        is: "are", foot: "feet", person: "people", werewolf: "werewolves", wolf: "wolves", that: "those" // Add more irrlegular plurals here if you need them
    };
    if (number != 1) {
        if (plurals[word.toLowerCase()] != undefined) {

            if (word.toUpperCase() == word) {
                word = plurals[word.toLowerCase()].toUpperCase();
            } else if (word.charAt(0).toUpperCase() == word.charAt(0)) {
                word = plurals[word.toLowerCase()].charAt(0).toUpperCase() + plurals[word.toLowerCase()].slice(1);
            } else {
                word = plurals[word.toLowerCase()];
            }
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

// Given an array, returns a random item
function randomResult(array) {
   return array[Math.floor(Math.random()*array.length)];
}

/// === BOT UTILITY FUNCTIONS ===

// Assigns roles that are required by other roles.
function assignExtraRoles(userID, serverID) {
    let checked = {};
    for (let a in configurables.accessRequirements) {
        checked[a] = false;
    }
    for (let a in configurables.accessRequirements) {
        for (let r of bot.servers[serverID].members[userID].roles) {
            if (configurables.accessRequirements[a].indexOf(r) != -1) {
                if (!checked[a]) {
                    checked[a] = true;
                    setUserRole(userID, a, serverID, true);
                }
            }
        }
    }
    for (let a in configurables.accessRequirements) {
        //if (!checked[a]) setUserRole(userID, a, serverID, false);
    }
}

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
                if (callback) callback(true);
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

// Create a new role on a server.
function createRole(name, server, colour, hoist, mentionable, permissions, callback, attempts) {
    if (!name || !server) {
        if (callback) callback(true);
        return;
    }
    if (!attempts) attempts = 0; // Set attempts if it was not set
    let failed = false;
    bot.createRole(server, function(err, res) {
        if (err) {
            failed = true;
        } else {
            bot.editRole({serverID: server, roleID: res.id, name: name, color: colour, hoist: hoist, permissions: permissions, mentionable: mentionable}, function(err2, res2) {
                if (err2) {
                    failed = true;
                }
            });
        }
        if (failed) {
            attempts++;
            let toLog = "An error occurred while creating a role (attempt "+attempts+")!\nserverID: "+server+", name: "+name+"\nError: "+err+"\n";
            // Retry (or not)
            if (attempts >= configurables.maxAttempts) {
                toLog += "Will not retry.";
                if (callback) callback(true);
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    createRole(name, server, colour, hoist, mentionable, permissions, callback, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else {
            log("Created a role: "+name, 2);
            if (callback) callback(false);
        }
    });
}

// Creates the channel index and sets channel positions correctly.
function createIndex(server) {
    let t = Date.now(); // Time how long it took
    channelIndex.length = 0; // Clear the channelIndex array
    let highest = 0;
    for (let c in bot.servers[server].channels) { // Find the highest index to loop up to
        if (bot.servers[server].channels[c].position > highest && bot.servers[server].channels[c].type == "voice") highest = bot.servers[server].channels[c].position;
    }
    for (let i = 0; i <= highest; i++) { // Loop through and push channels to channelIndex
        for (c in bot.servers[server].channels) {
            if (bot.servers[server].channels[c].position == i && bot.servers[server].channels[c].type == "voice") {
                channelIndex.push(c);
            }
        }
    }
    log("Indexed in "+(Date.now()-t)+"ms", 2); // Log the loop time
}

// Delete a channel.
function deleteChannel(channelID, callback, attempts) {
    if (!channelID) {
        if (callback) callback(true);
        return;
    }
    if (!attempts) attempts = 0; // Set attempts if it was not set
    bot.deleteChannel(channelID, function(err, res) {
        if (err) {
            attempts++;
            let toLog = "An error occurred while deleting a channel (attempt "+attempts+")!\nchannelID: "+channelID+", Error: "+err+"\n";
            // Retry (or not)
            if (attempts >= configurables.maxAttempts) {
                toLog += "Will not retry.";
                if (callback) callback(true);
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    deleteChannel(channelID, callback, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else {
            log("Deleted a channel with ID: "+channelID);
            if (callback) callback(false);
        }
    });
}

// Delete expired uncreated clans
function deleteExpiredClans(userID) {
    let again = true; // Loop again
    while (again) {
        let i = 0; // Array element to check
        again = false;
        while (!again && i < configurables.clanWaitingList.length) {
            if (configurables.clanWaitingList[i].timestamp + configurables.channelTimeout < Date.now() || configurables.clanWaitingList[i].userID == userID) {
                log("Deleting uncreated clan "+configurables.clanWaitingList[i].fullName, 2);
                configurables.clanWaitingList.splice(i, 1);
                again = true; // Look for another from the start
            }
            i++;
        }
    }
}

// Edits the permissions of a voice or text channels for a single group.
function editChannelPermissions(channelID, groupID, permissions, attempts) {
    if (!attempts) attempts = 0; // Set attempts if it was not set
    let object = permissions;
    object.channelID = channelID;
    if (bot.users[groupID] == undefined) {
        object.roleID = groupID;
    } else {
        object.userID = groupID;
    }
    bot.editChannelPermissions(object, function(err) {
        let failed = "";
        if (err) { // If an error occurred
            failed = err;
        }
        request({
            url: "https://discordapp.com/api/channels/"+channelID,
            headers: {
                "User-Agent": "DiscordBot (https://discordapp.com/, 2.0)",
                "Authorization": "Bot "+token,
                "Content-Type": "application/json"
            },
            method: "GET",
        }, function(error, response, body) {
            if (error) {
                if (failed == "") failed = error;
            } else {
                let combined = {allow: 0, deny: 0};
                if (permissions.allow) for (let i of permissions.allow) combined.allow += Math.pow(2, i);
                if (permissions.deny) for (let i of permissions.deny) combined.deny += Math.pow(2, i);
                for (let p of JSON.parse(body).permission_overwrites) {
                    if (p.id == groupID && ((p.allow & combined.allow) != combined.allow || (p.deny & combined.deny) != combined.deny)) {
                        if (failed == "") {
                            failed = "Discord lied";
                            log("Discord lied, here's the details:\nd.io permissions: "+JSON.stringify(permissions)+"\nDiscord permissions: "+JSON.stringify(combined)+"\nApplied permissions: "+JSON.stringify(p), 0);
                        }
                    }
                }
            }
            if (failed) {
                attempts++;
                let toLog = "An error occurred while editing single-group channel permissions (attempt "+attempts+")!\nchannelID: "+channelID+", groupID: "+groupID+"\nError: "+failed+"\n";
                // Retry (or not)
                if (attempts >= configurables.maxAttempts) {
                    toLog += "Will not retry.";
                } else {
                    toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                    setTimeout(function() {
                        editChannelPermissions(channelID, groupID, permissions, attempts);
                    }, configurables.retryTimeout);
                }
                log(toLog, 1);
            } else {
                log("Edited single-group permissions for "+channelID+"/"+groupID+" (took "+(attempts+1)+" "+plural("attempt", attempts+1)+")", 2);
            }
        });
    });
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
function fixChannelPositions(server, attempts) {
    if (!attempts) attempts = 0;
    let send = []; // What to send
    for (let i = 0; i < channelIndex.length; i++) { // Add every channel which needs to move
        if (bot.servers[server].channels[channelIndex[i]].position != i) send.push({"id": channelIndex[i], "position": i});
    }
    request({
        url: "https://discordapp.com/api/guilds/"+server+"/channels",
        headers: {
            "User-Agent": "DiscordBot (https://discordapp.com/, 2.0)",
            "Authorization": "Bot "+token,
            "Content-Type": "application/json"
        },
        method: "PATCH",
        body: JSON.stringify(send)
    }, function(error, response, body) {
        if (error) { // If an error occurred
            attempts++;
            let toLog = "An error occurred while resetting channel positions (attempt "+attempts+")!\nlength: "+channelIndex.length+"\nError: "+error+"\nresponse: "+JSON.stringify(response)+"\nbody: "+JSON.stringify(body)+"\n";
            // Retry (or not)
            if (attempts > configurables.maxAttempts) {
                toLog += "Will not retry.";
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    fixChannelPositions(configurables.server, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else { // If there was no error
            success = true;
            for (let i of send) {
                if (i.position != bot.servers[server].channels[i.id].position) success = false;
            }
            if (!success) {
                fixChannelPositions(server);
                log("Channel positions weren't actually reset properly, will retry", 2);
            } else {
                log("Reset channel positions successfully", 2);
            }
        }
    });
}

// Given the ID of a user, fetch their member role
function memberRoleOfUser(userID, server) {
    for (let r of bot.servers[server].members[userID].roles) {
        if (configurables.memberRoleLookup[r] != undefined) return r;
    }
    if (userID == "176580265294954507") return "313362139567882241"; // Return CMP for cloudrac3r if nothing found
    return null;
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
            color: configurables.colourLookup[type] || type,
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
            if (title == "multifield") {
                log("Sent a multifield embed message to "+channelID, 2);
            } else {
                log("Sent an embed message to "+channelID+": "+title+" // "+message, 2);
            }
        }
    });
}

// Send a message to a channel. Retries automatically if it fails.
// The attempts option should not be specified when calling this function outside of this function.
function sendMessage(channelID, message, attempts) {
    if (message == undefined) message = "The message was `undefined`. This was probably not supposed to happen.";
    if (typeof(message) == "object") message = JSON.stringify(message); // Convert some incompatible data types to strings
    if (typeof(message) == "number") message = message+"";
    if (typeof(message) == "boolean") message = (message ? "true" : "false");
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

// Set the permissions of a voice or text channel for multiple groups at once.
function setChannelPermissions(channelID, permissions) {
    let count = 0;
    for (let r in permissions) {
        editChannelPermissions(channelID, r, permissions[r]);
        count++;
    }
    log("Setting multi-group permissions ("+count+" groups) for channel "+channelID, 2);
}

function setUserRole(userID, roleID, server, mode, callback, attempts) {
    if (!attempts) attempts = 0; // Set attempts if it was not set
    let f;
    if (mode) {
        f = "addToRole";
    } else {
        f = "removeFromRole";
    }
    bot[f]({userID: userID, serverID: server, roleID: roleID}, function(err) {
        if (err) { // If an error occurred
            attempts++;
            let toLog = "An error occurred while setting a role (attempt "+attempts+")!\nuserID: "+userID+", roleID: "+roleID+"\nError: "+err+"\n";
            // Retry (or not)
            if (attempts >= configurables.maxAttempts) {
                toLog += "Will not retry.";
                if (callback) callback(true);
            } else {
                toLog += "Will retry in "+configurables.retryTimeout+"ms.";
                setTimeout(function() {
                    setUserRole(userID, roleID, server, mode, callback, attempts);
                }, configurables.retryTimeout);
            }
            log(toLog, 1);
        } else { // If there was no error
            log("Set the role "+roleID+" on "+userID, 2);
            if (callback) callback(false);
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

// Assign or remove (unassign) a role on a user
function assignRole(userID, channelID, targetID, roleName, mode) {
    // Set the assign mode
    let command = "assign";
    if (!mode) {
        command = "unassign";
    }
    // Check that a target was specified
    if (!targetID) {
        sendEmbedMessage(channelID, "Failed to set role!", "You must specify a target user. Try `/"+command+" @mention Role Name`.", "error");
        return;
    }
    targetID = targetID.id;
    // Check that the role exists
    let roleID = getRoleID(roleName, bot.channels[channelID].guild_id);
    if (!roleID) {
        sendEmbedMessage(channelID, "Failed to set role!", "That role (**­"+roleName+"**) does not exist. Check that you spelled it correctly.", "error"); //NOTE: a zero-width space is used after the first **
        return;
    }
    // Check that assigning the role is permitted
    let allowed = false;
    for (let r of bot.servers[bot.channels[channelID].guild_id].members[userID].roles) {
        if (isAbove(r, roleID, configurables.roleHierarchy)) allowed = true;
    }
    if (!allowed) {
        for (let r of bot.servers[bot.channels[channelID].guild_id].members[userID].roles) {
            if (isAbove(r, roleID, configurables.clanHierarchy) && memberRoleOfUser(userID, bot.channels[channelID].guild_id) == memberRoleOfUser(targetID, bot.channels[channelID].guild_id)) allowed = true;
        }
    }
    if (!allowed) {
        sendEmbedMessage(channelID, "Failed to set role!", "You are not permitted to set that role.", "error");
        return;
    }
    // Assign the role
    setUserRole(targetID, roleID, bot.channels[channelID].guild_id, mode, function(err) {
        if (err) {
            sendEmbedMessage(channelID, "Failed to set role!", "All checks passed, but Discord wouldn't let me set the role. Check that this bot user has the right permissions.", "error");
        } else {
            sendEmbedMessage(channelID, "Set role successfully!", "The role **"+roleName+"** was "+command+"ed on **"+userIDToNick(targetID, bot.channels[channelID].guild_id)+"**.", "success");
            assignExtraRoles(targetID, bot.channels[channelID].guild_id);
        }
    });
}

// Run input as a JS command.
function botEval(userID, channelID, command) {
    if (configurables.botAdmins.indexOf(userID) != -1 || matchingElementFromArray(bot.servers[bot.channels[channelID].guild_id].members[userID].roles, configurables.roleHierarchy["ADMIN"]).length > 0) {
        try {
            sendMessage(channelID, eval(command));
        } catch (e) {
            sendMessage(channelID, "Error caught while running command!\n"+e);
        }
    } else {
        sendMessage(channelID, "You don't have sufficient permissions to eval anything. Add your userID to `configurables.botAdmins` or obtain an admin role.");
    }
}

// Change a user's nickname.
function changeName(userID, channelID, targetID, nick) {
    // Check to make sure the required rank (Alliance Staff Access) is held
    if (bot.servers[bot.channels[channelID].guild_id].members[userID].roles.indexOf("313818382564589569") == -1) {
        sendEmbedMessage(channelID, "Failed to change nickname!", "You need the Alliance Staff Access role to be able to change nicknames.", "error");
        return;
    }
    // Check for a mention
    if (!targetID) {
        sendEmbedMessage(channelID, "Failed to change nickname!", "You must @mention a user to change the name of. Try `/changename @mention New Name`.", "error");
        return;
    }
    targetID = targetID.id;
    // Check to make sure the target user has the Needs Receptionist role
    if (bot.servers[bot.channels[channelID].guild_id].members[targetID].roles.indexOf(configurables.needsReceptionistRole) == -1) {
        sendEmbedMessage(channelID, "Failed to change nickname!", "The target user needs the Needs Receptionist role.", "error");
        return;
    }
    // Change the nickname
    if (nick == "") {
        sendEmbedMessage(channelID, "Failed to change nickname!", "You must supply a new nickname.", "error");
    } else if (nick.indexOf(" ") != -1) {
        sendEmbedMessage(channelID, "Failed to change nickname!", "Warframe names don't have spaces. You probably entered an incorrect name.", "error");
    } else {
        bot.editNickname({serverID: bot.channels[channelID].guild_id, userID: targetID, nick: nick}, function(err) {
            if (err) {
                sendEmbedMessage(channelID, "Failed to change nickname!", "Don't panic, you used the command correctly. <@176580265294954507> is on his way.", "error");
            } else {
                sendEmbedMessage(channelID, "Changed nickname successfully!", "**"+bot.users[targetID].username+"**'s name was changed to **"+nick+"**.", "success");
            }
        });
    }
}

// Prepares to create an entire clan
function createClan(userID, channelID, owner, short, full) {
    deleteExpiredClans(userID);
    for (let i = 0; i < configurables.clanWaitingList.length; i++) if (configurables.clanWaitingList[i].userID == userID) delete configurables.clanWaitingList[i];
    if (!full || !owner) {
        sendMessage(channelID, "Not enough information provided. Try `/clan @mention SHORT Full Clan Name`. Replace *SHORT* with a short name for the clan, e.g. *Crescent Moon Prime* → *CMP*, and *@mention* with a mention of the new Founding Warlord of the clan.");
        return;
    }
    owner = owner.id;
    let confirm = randomResult(configurables.confirmationStrings[0])+" "+randomResult(configurables.confirmationStrings[1])+" "+randomResult(configurables.confirmationStrings[2]);
    configurables.clanWaitingList.push({userID: userID, confirmation: confirm, shortName: short, fullName: full, owner: owner, channelID: channelID, timestamp: Date.now()});
    sendEmbedMessage(channelID, "multifield", [
        {
            name: "Details",
            value: "**Name:** "+full+"\n**Short name:** "+short+"\n**Owner:** "+bot.users[owner].username,
            inline: true
        },{
            name: "Roles",
            value: full.toUpperCase()+"\n"+full+" Member\nFormer "+full+" Member",
            inline: true
        },{
            name: "­", // Zero-width spaces are used here!!!!
            value: "­",
            inline: false
        },{
            name: "Text channels",
            value: short+"_rules\n"+short+"_news\n"+short+"_clan_lobby\n"+short+"_staff_lobby",
            inline: true
        },{
            name: "Voice channels",
            value: full+"\n---Public Lobby\n---Members Lobby\n(seperator)",
            inline: true
        },{
            name: "Confirm",
            value: "/confirmclan "+confirm,
            inline: false
        }
    ], 0xF07000);
}

// Confirms the clan creation and does the stuff
function confirmClan(userID, channelID, confirmation) {
    let created = false;
    for (let i of configurables.clanWaitingList) {
        if (i.userID == userID && i.confirmation == confirmation && !created) {
            created = true;
            let serverID = bot.channels[i.channelID].guild_id;
            createRole("Former "+i.fullName+" Member", i.serverID, 0x3292b3);
            createRole(i.fullName.toUpperCase(), i.serverID, 0, true, true, {allow: [Discord.Permissions.TEXT_READ_MESSAGES, Discord.Permissions.TEXT_SEND_MESSAGES, Discord.Permissions.VOICE_USE_VAD, Discord.Permissions.GENERAL_CREATE_INSTANT_INVITE]}, function(e,headerRes) {
                if (!e) createRole(i.fullName+" Member", i.serverID, 0x3167f8, true, false, {allow: [Discord.Permissions.TEXT_READ_MESSAGES, Discord.Permissions.TEXT_SEND_MESSAGES, Discord.Permissions.TEXT_READ_MESSAGE_HISTORY, Discord.Permissions.TEXT_ADD_REACTIONS, Discord.Permissions.VOICE_USE_VAD]}, function(e,memberRes) {
                    if (!e) {/*
                        createChannel(i.shortName+"_rules", "text", serverID);
                        createChannel(i.shortName+"_news", "text", serverID);
                        createChannel(i.shortName+"_clan_lobby", "text", serverID);
                        createChannel(i.shortName+"_staff_lobby", "text", serverID);

                        createChannel(i.fullName, "text", channelID);
                        createChannel("---Public Lobby", "voice", serverID);
                        createChannel("---Members Lobby", "voice", serverID);
                        createChannel("____________________", "voice", serverID);*/
                    }
                });
            });
        }
    }
    if (created) {
        sendMessage(channelID, "Okay, I'm creating the clan now. You won't see a confirmation message. After it appears to be done (should take several seconds), you should make sure that everything was set up correctly, especially channel positions and permissions.");
    } else {
        sendMessage(channelID, "That code didn't match any records, so either your confirmation code didn't match, or you never used `/clan` in the first place. It's also possible that `/clan` timed out, which happens after "+configurables.channelTimeout/1000+" seconds.");
    }
}

// Set the timeout on temporary channels 
function deleteTemporaryChannels() {
    for (let i in configurables.channelActivity) {
        configurables.channelActivity[i].time = Date.now()-configurables.channelTimeout;
    }
    log("Set unused temporary channels to be deleted on next cycle", 2);
}

function friendlyChannelCreation(name, type, userID, channelID) {
    if (!memberRoleOfUser(userID, bot.channels[channelID].guild_id)) { // Prevent member role errors
        sendMessage(channelID, "You don't have a Clan Member role, so you aren't permitted to create voice channels.");
        return;
    }
    if (!type || !name) { // Prevent missing field errors
        sendMessage(channelID, "Not enough information provided. Try `/create <public|members|recruiter|private> CHANNEL NAME`.");
        return;
    }
    type = type.toLowerCase(); // Convert type to lowercase
    if (type == "member") type = "members"; // Convert misspellings
    if (type.indexOf("recruit") == 0) type = "recruiter";
    if (["public", "members", "recruiter", "private"].indexOf(type) == -1) { // Prevent channel type errors
        sendMessage(channelID, "I didn't recognise the channel type **"+type+"**. It should be either `public`, `members`, `recruiter` or `private`.");
        return;
    }
    log("Creating a pair of channels with base name: "+name, 2);
    createChannel("۰ ۰ "+name, "voice", bot.channels[channelID].guild_id, function(err, vcid) { // Attempt to create the voice channel. Note: the dots are Arabic characters (U+06F0)
        if (err) { // If it failed, send a failure message and quit.
            sendEmbedMessage(channelID, "Failed to create a voice channel", "Something went wrong, and the voice channel wasn't created. Maybe you mistyped some information, or the bot doesn't have permission to manage channels.", "error");
            log("Voice channel creation failed!\ntype: "+type+", name: "+name, 1);
        } else { // If it succeeded...
            // Add to channel list
            configurables.channelActivity[vcid] = {time: Date.now(), members: [userID]};
            // Attempt to create the text channel
            createChannel(name, "text", bot.channels[channelID].guild_id, function(err, tcid) {
                if (err) { // If it failed, send a message and quit.
                    sendEmbedMessage(channelID, "Failed to create a text channel", "A voice channel was created but a text channel wasn't. Maybe the channel name couldn't be converted to a text-channel-friendly format. ("+name+" → "+makeStringGreatAgain(name)+")", "error");
                    log("Text channel creation failed!\ntype: "+type+", name: "+name+", greatName: "+makeStringGreatAgain(name), 1);
                } else { // If it succeeded...
                    configurables.channelActivity[vcid].text = tcid;
                    bot.createInvite({channelID: vcid}, function(err, res) { // Attempt to create an instant invite link to the voice channel
                        if (!err) { // If it succeeded, send the success message with link
                            sendEmbedMessage(channelID, "multifield", [
                            {
                                name: "Created channels successfully",
                                value: "You now have a new voice channel named **"+bot.channels[vcid].name+"** and a text channel named **"+bot.channels[tcid].name+"**."
                            }, {
                                name: "Instant invite link (click to connect)",
                                value: "https://discord.gg/"+res.code
                            }], "success");
                        } else { // If it failed, just send the success message
                            sendEmbedMessage(channelID, "Created channels successfully", "You now have a new voice channel named **"+bot.channels[vcid].name+"** and a text channel named **"+bot.channels[tcid].name+"**.", "success");
                        }
                        log("Channel creation successful", 2);
                    });
                    editChannelPermissions(tcid, bot.channels[tcid].guild_id, {deny: [Discord.Permissions.TEXT_READ_MESSAGES], allow: [Discord.Permissions.TEXT_EMBED_LINKS, Discord.Permissions.TEXT_ATTACH_FILES, Discord.Permissions.TEXT_SEND_TTS_MESSAGE]});
                    editChannelPermissions(tcid, userID, {allow: [Discord.Permissions.TEXT_READ_MESSAGES, Discord.Permissions.GENERAL_MANAGE_CHANNELS]});
                    sendMessage(tcid, "REMEMBER: No one else can see this channel until you invite them (or they connect to the linked voice channel).\nUse `/invite @mention`.");
                    log("Created a pair of channels: "+name+"/"+makeStringGreatAgain(name), 2);
                }
            });
            // As soon as the voice channel is created, set its permissions
            for (let r of configurables.roleHierarchy["VCModerators"]) editChannelPermissions(vcid, r, {allow: [Discord.Permissions.VOICE_CONNECT]}); // Allow voice chat moderators to connect
            for (let r of configurables.roleHierarchy["Moderators"]) editChannelPermissions(vcid, r, {allow: [Discord.Permissions.VOICE_CONNECT, Discord.Permissions.GENERAL_MANAGE_CHANNELS]}); // Allow moderators to moderate
            editChannelPermissions(vcid, userID, {allow: [Discord.Permissions.VOICE_CONNECT, Discord.Permissions.GENERAL_MANAGE_CHANNELS]}); // Allow creator
            switch (type) {
            case "public":
                // No other permissions need to be set for public channels.
                break;
            case "members":
                editChannelPermissions(vcid, bot.channels[vcid].guild_id, {deny: [Discord.Permissions.VOICE_CONNECT]}); // Deny everyone
                editChannelPermissions(vcid, memberRoleOfUser(userID, bot.channels[channelID].guild_id), {allow: [Discord.Permissions.VOICE_CONNECT]}); // Allow clan members
                break;
            case "private":
                editChannelPermissions(vcid, bot.channels[vcid].guild_id, {deny: [Discord.Permissions.VOICE_CONNECT]}); // Deny everyone
                editChannelPermissions(vcid, configurables.memberRoleLookup[memberRoleOfUser(userID, bot.channels[channelID].guild_id)].header, {allow: [Discord.Permissions.VOICE_CONNECT]}); // Allow clan staff
                break;
            }
            // Move the voice channel to the correct place
            switch (type) {
            case "recruiter":
                type = "public";
                break;
            case "private":
                type = "members";
                break;
            }
            createIndex(bot.channels[vcid].guild_id); // Create the channel index
            channelIndex.splice(channelIndex.indexOf(vcid), 1); // Remove the voice channel from the index
            channelIndex.splice(bot.servers[bot.channels[vcid].guild_id].channels[configurables.memberRoleLookup[memberRoleOfUser(userID, bot.channels[vcid].guild_id)][type]].position+1, 0, vcid); // Add the channel in the right place in the index. :hippo:
            fixChannelPositions(bot.channels[vcid].guild_id); // Ask Discord to move the channels
        }
    });
}

function inviteToChannel(userID, channelID, mentions) {
    let vcid = bot.servers[bot.channels[channelID].guild_id].members[userID].voice_channel_id;
    if (mentions.length == 0) {
        sendEmbedMessage(channelID, "No one was invited!", "Add some @mentions after /invite.", "error");
    } else if (vcid == null) {
        sendEmbedMessage(channelID, plural("That", mentions.length)+" "+plural("user", mentions.length)+" could not be invited!", "Connect to a voice channel, then issue the command again.", "error");
    } else if (configurables.channelActivity[vcid] == undefined) {
        sendEmbedMessage(channelID, plural("That", mentions.length)+" "+plural("user", mentions.length)+" could not be invited!", "You can only invite users to private rooms.", "error");
    } else {
        for (let m of mentions) {
            editChannelPermissions(vcid, m.id, {allow: [Discord.Permissions.VOICE_CONNECT]});
            editChannelPermissions(configurables.channelActivity[vcid].text, m.id, {allow: [Discord.Permissions.TEXT_READ_MESSAGES]});
            configurables.channelActivity[vcid].members.push(m.id);
        }
        sendEmbedMessage(channelID, "Permissions updated", "Allowed **"+mentions.length+"** more "+plural("person", mentions.length)+" to connect to **"+bot.channels[vcid].name+"** (and linked text channel)", "success");
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
    createIndex(configurables.server);
    fixChannelPositions(configurables.server);
    if (!restarted) {
        restarted = true;
        sendMessage("176580265294954507", "Bot started");
        setInterval(function() {
            deleteExpiredClans();
            // Keep voice channels alive and manage XP
            let modified = false;
            for (member in bot.servers[configurables.server].members) {
                let vcid = bot.servers[configurables.server].members[member].voice_channel_id;
                if (vcid != null) {
                    awardXP(member, Math.floor(Math.random()*3+4), 10);
                    modified = true;
                    if (configurables.channelActivity[vcid]) {
                        configurables.channelActivity[vcid].time = Date.now();
                        if (configurables.channelActivity[vcid].members.indexOf(member) == -1) {
                            configurables.channelActivity[vcid].members.push(member);
                            editChannelPermissions(configurables.channelActivity[vcid].text, member, {allow: [Discord.Permissions.TEXT_READ_MESSAGES]});
                        }
                    }
                }
            }
            // Write XP to a file
            if (modified) fs.writeFile("xpreloaded.txt", "let xp = "+JSON.stringify(xp), {encoding: "utf8"}, function() {});
            // Delete expired channels
            for (let channelID in configurables.channelActivity) {
                if ((Date.now() - configurables.channelActivity[channelID].time) > configurables.channelTimeout) {
                    log("Deleting channel "+JSON.stringify(bot.channels[channelID]), 2);
                    deleteChannel(channelID, function() {
                        deleteChannel(configurables.channelActivity[channelID].text, function() {
                            delete configurables.channelActivity[channelID];
                        });
                    });
                }
            }
            // Write configurables to a file
            saveConfigurables();
        }, 5000); // Every 5 seconds
    }
});

// When a message is sent
bot.on("message", function(user, userID, channelID, message, event) {
    // Failsafes
    if (userID == "326698088108392449") return; // WTF Dyno >:(
    if (!bot.users[userID]) {
        log("userID not found: "+userID, 0);
        return;
    }
    if (bot.users[userID].bot) return; // Ignore messages from bot users
    if (bot.directMessages[channelID]) {
        sendMessage(channelID, "Please use bot commands in a dedicated bot channel on a server. Commands do not work in direct messages.");
        return;
    }
    message = message.replace(/  */g, " "); // Convert multiple spaces into 1 space
    // Moderation
    if (message.search(/discord.gg\/[A-Za-z0-9]{5,}/) != -1 && userID != bot.id) {
        bot.queryInvite(message.match(/discord.gg\/([A-Za-z0-9]{5,})/)[1], function(e, r) {
            let d = false;
            if (!r) d = true;
            if (r) if (r.guild.id != bot.channels[channelID].guild_id) d = true;
            if (d) bot.deleteMessage({channelID: channelID, messageID: event.d.id}, function(e) {
                if (!e) sendMessage(channelID, "<@"+userID+"> Instant invite links to other servers are not allowed here! If you need to invite someone to a server, send the link via Direct Message.");
            });
        });
    // Commands
    } else if (message.charAt(0) == "/") {
        let isInTempChannel = false;
        for (let c in configurables.channelActivity) if (configurables.channelActivity[c].text == channelID) isInTempChannel = true;
        if (configurables.whitelistedChannels.indexOf(channelID) == -1 && !isInTempChannel) {
            let output = "You just used a command in **#"+bot.channels[channelID].name+"**. *This is severely discouraged!* You should only be using bot commands in these channels:\n";
            for (let c of configurables.whitelistedChannels) {
                output += "**#"+bot.channels[c].name+"**\n";
            }
            output += "You may only use commands outside of these channels if it's relevant to the current conversation! If your use of the command is not relevant to any ongoing conversation in the channel that you used it in, you should run the command in one of the channels mentioned above in order to be courteous to others and to stop seeing this message.";
            sendMessage(userID, output);
        }
        switch(message.split(" ")[0].toLowerCase()) { // Run code block based on first word of message
        case "/eval": // Run the message as a JS command
            botEval(userID, channelID, message.split(" ").slice(1).join(" "));
            break;
        case "/help": // Send the list of bot commands
            sendMessage(channelID, "Welcome to IceBot Reloaded! Here, commands are prefixed with a `/`.\nMember commands: **/help**, **/create**, **/invite**, **/rank**,\nImportant person commands: **/assign**, **/unassign**, **/changename**, **/roleid**, **/eval**\nFor more help with a command, just try using it. The bot will give a quick guide if you use it incorrectly.\nThis bot is open-source and its code can be found at https://github.com/cloudrac3r/icebot-reloaded.");
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
            friendlyChannelCreation(message.split(" ").slice(2).join(" "), message.split(" ")[1], userID, channelID);
            break;
        case "/invite": // Invite a user to a temporary voice channel
            inviteToChannel(userID, channelID, event.d.mentions);
            break;
        /*case "/dtc": // Delete temporary channels
            deleteTemporaryChannels();
            break;*/
        case "/assign":
        case "/unassign":
            assignRole(userID, channelID, event.d.mentions[0], message.split(" ").slice(2).join(" "), (message.charAt(2).toLowerCase() == "s"));
            break;
        case "/changename":
            changeName(userID, channelID, event.d.mentions[0], message.split(" ").slice(2).join(" "));
            break;
        case "/clan":
            createClan(userID, channelID, event.d.mentions[0], message.split(" ")[2], message.split(" ").slice(3).join(" "));
            break;
        case "/confirmclan":
            confirmClan(userID, channelID, message.split(" ").slice(1).join(" "));
            break;
        }
    }
    awardXP(userID, 1);
});

// If the bot disconnects from Discord...
bot.on("disconnect", function() {
    bot.connect(); // Reconnect.
    log("Bot disconnected. Reconnecting...", 1);
});