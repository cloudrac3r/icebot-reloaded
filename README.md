# Using IceBot's code

## Install node.js
IceBot Reloaded requires a fairly recent version of node.js. Version 6 or later works, older versions untested.

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

### Key
Type normal words exactly as shown. Replace words in <angle brackets> with a word or words tailored to your situation and remove the angled brackets. Words [square brackets] are the same as angled brackets, but optional: if they do not apply, leave them out. Words connected with pipes | show alternatives: you must specify exactly one of those words.

### Roles
/assign <@mention> <ROLE NAME>
/unassign <@mention> <ROLE NAME>

### Channels
/create public|members|recruiter|private <CHANNEL NAME>
/invite <@mention> [@mention] [...]

### XP
/rank [@mention]

### Clans
None yet

### Misc
/eval <JS COMMAND>
/roleid <ROLE NAME>
/changename <@mention> <New name>
