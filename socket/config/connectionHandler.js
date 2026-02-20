const { activeUsers } = require("./socketstates")
const { matches, activeMatches } = require("../config/socketstates")

const { findmatchreceive, changematchstate, needtoreconnect, removereconnect, serverremovereconnectplayer, doneroom } = require("../server/findmatch")

const HEARTBEAT_INTERVAL = 5000; // Send ping every 10 seconds
const TIMEOUT = 10000;            // Wait 10 seconds for pong
const MAX_MISSED_PINGS = 3;

exports.eventconnection = (io, socket) => {
    //  #region SOCKET MAIN EVENTS

    socket.on("receiveusers", (data) => {

        const userdata = JSON.parse(data);

        console.log(userdata)

        const username = userdata.username;
        const region = userdata.region;

        const existing = activeUsers.get(username);

        if (existing) {
            activeUsers.delete(username)
        }

        activeUsers.set(username, region);

        console.log(`User ${username} with region ${region} logged in on ${process.env.SERVER_REGION}`);

        socket.emit("sendusercount", activeUsers.size)
    });

    socket.on("removeusers", data => {
        const userdata = JSON.parse(data);

        console.log(userdata)
        
        const username = userdata.username;
        const region = userdata.region;

        const existing = activeUsers.get(username);

        if (existing) {
            activeUsers.delete(username)
        }

        console.log(`User ${username} with region ${region} removed on ${process.env.SERVER_REGION}`);

        socket.emit("sendusercount", activeUsers.size)
    })

    socket.on("disconnect", (reason) => {
        console.log(`Master Server Socket ${socket.id} disconnected. Reason: ${reason}`);
        activeUsers.clear()
    });

    socket.on("playerquit", (data) => {
        const userdata = JSON.parse(data)
        const username = userdata.username
        console.log(`User ${username} disconnected.`);
        for (const match of matches) {
            const index = match.players.indexOf(username);
            if (index !== -1) match.players.splice(index, 1);
        }
    });

    socket.on("quitonmatch", data => {
        const username = data.username;
        const roomname = data.roomname;
        const socketid = data.socketid;

        console.log(`User ${username} socket ${socketid} quit on match room ${roomname}.`);

        const match = matches.find(m => m.roomName === roomname);

        if (!match) {
            console.warn(`⚠️ Match not found: ${roomname}`);
            return;
        }

        // remove player
        const playerIndex = match.players.indexOf(username);
        if (playerIndex !== -1) {
            match.players.splice(playerIndex, 1);
            match.playersocket.splice(playerIndex, 1);
        }

        // if room is empty → remove it
        if (match.players.length === 0) {
            const index = matches.findIndex(m => m.roomName === roomname);
            if (index !== -1) {
                matches.splice(index, 1);
                console.log(`🗑️ Room ${roomname} removed (empty)`);
            }

            clearInterval(match.interval)
            return;
        }

        // send updated room state
        socket.emit("waitingroomupdate", {
            roomName: match.roomName,
            players: match.players,
            playerSocket: match.playersocket,
            maxPlayers: match.maxPlayers,
            status: match.status,
            countdown: match.countdown
        });
    });

    //  #endregion

    findmatchreceive(io, socket)
    changematchstate(io, socket)
    needtoreconnect(io, socket)
    removereconnect(io, socket)
    serverremovereconnectplayer(io, socket)
    doneroom(io, socket)
}