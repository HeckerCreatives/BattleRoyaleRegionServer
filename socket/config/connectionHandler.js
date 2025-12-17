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

    //  #endregion

    findmatchreceive(io, socket)
    changematchstate(io, socket)
    needtoreconnect(io, socket)
    removereconnect(io, socket)
    serverremovereconnectplayer(io, socket)
    doneroom(io, socket)
}