# Using IceBot's code

## Install node.js
Requires a fairly recent version of node.js. Version 6 or later works, older versions untested.
On common Linux distributions, use your package manager to install node.js
For other operating systems, download a binary or source from http://nodejs.org
You will also need npm; this should be included with node.js.

## Install libraries
    npm install request
    npm install discord.io
    
## Customise to your server
- Replace the contents of `token.txt` with your bot token
- Edit `configurablesreloaded.txt` to match your own server setup

## Run
    node icebot.js

# Command list

### Roles
None yet

### Channels
/create <public|members|recruiter|private> CHANNEL NAME

### XP
/rank [@mention]

### Clans
None yet

### Misc
/eval JS COMMAND

/roleid ROLE NAME
