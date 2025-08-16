const { activeUsers } = require("./socketstates")
const {sendnewsandshowcasenotif, sendmessagesnotif, sendchangeraidboss} = require("../web/notification")

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

    socket.on("disconnect", (reason) => {
        console.log(`Master Server Socket ${socket.id} disconnected. Reason: ${reason}`);
        activeUsers.clear()
    });

    //  #endregion

    //  #region WEB

    sendnewsandshowcasenotif(io, socket)
    sendmessagesnotif(io, socket)
    sendchangeraidboss(io, socket)

    //  #endregion
}