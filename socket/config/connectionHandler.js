const { activeUsers } = require("./socketstates")
const { matches, activeMatches } = require("../config/socketstates")

const { findmatchreceive, changematchstate, needtoreconnect, removereconnect, serverremovereconnectplayer, doneroom, cancelfindmatch } = require("../server/findmatch")

const HEARTBEAT_INTERVAL = 5000; // Send ping every 10 seconds
const TIMEOUT = 10000;            // Wait 10 seconds for pong
const MAX_MISSED_PINGS = 3;

// Bursty per-event logs. Gate behind SOCKET_DEBUG=1 so prod stays quiet;
// warnings/errors (console.warn/console.error) are left intact.
const SOCKET_DEBUG = process.env.SOCKET_DEBUG === "1";
const dlog = (...a) => { if (SOCKET_DEBUG) console.log(...a); };

exports.eventconnection = (io, socket) => {
    //  #region SOCKET MAIN EVENTS

    socket.on("receiveusers", (data) => {

        const userdata = JSON.parse(data);

        dlog(userdata)

        const username = userdata.username;
        const region = userdata.region;

        const existing = activeUsers.get(username);

        if (existing) {
            activeUsers.delete(username)
        }

        activeUsers.set(username, region);

        dlog(`User ${username} with region ${region} logged in on ${process.env.SERVER_REGION}`);

        socket.emit("sendusercount", activeUsers.size)
    });

    socket.on("removeusers", data => {
        const userdata = JSON.parse(data);

        dlog(userdata)
        
        const username = userdata.username;
        const region = userdata.region;

        const existing = activeUsers.get(username);

        if (existing) {
            activeUsers.delete(username)
        }

        dlog(`User ${username} with region ${region} removed on ${process.env.SERVER_REGION}`);

        socket.emit("sendusercount", activeUsers.size)
    })

    socket.on("disconnect", (reason) => {
        dlog(`Master Server Socket ${socket.id} disconnected. Reason: ${reason}`);
        activeUsers.clear()
    });

    socket.on("playerquit", (data) => {
        const userdata = JSON.parse(data)
        const username = userdata.username
        dlog(`User ${username} disconnected.`);
        for (const match of matches) {
            const index = match.players.indexOf(username);
            if (index !== -1) match.players.splice(index, 1);
        }
    });

    socket.on("quitonmatch", (data) => {
        try {
            const username = data?.username;
            const roomname = data?.roomname;
            const socketid = data?.socketid;

            dlog(`User ${username} socket ${socketid} quit on match room ${roomname}.`);

            if (!roomname) {
                console.warn("⚠️ quitonmatch missing roomname");
                return;
            }

            const matchIndex = matches.findIndex(m => m.roomName === roomname);
            if (matchIndex === -1) {
                console.warn(`⚠️ Match not found: ${roomname}`);
                // still clean activeMatches if it exists (prevents health leak)
                if (activeMatches?.[roomname]) {
                    delete activeMatches[roomname];
                    dlog(`🧹 activeMatches cleared (match missing): ${roomname}`);
                }
                return;
            }

            const match = matches[matchIndex];

            // --- Remove player safely (prefer socketid to keep arrays aligned) ---
            let removed = false;

            if (socketid) {
                const sIndex = match.playersocket.indexOf(socketid);
                if (sIndex !== -1) {
                    match.playersocket.splice(sIndex, 1);
                    match.players.splice(sIndex, 1); // paired username at same index
                    removed = true;
                }
            }

            // Fallback: remove by username if socketid not found.
            // match.players holds objects ({username, avatarid, isBot}), so a
            // raw indexOf(string) never matched — the player stayed in the room
            // and kept receiving its broadcasts after quitting.
            if (!removed && username) {
                const pIndex = match.players.findIndex(p => !p.isBot && p.username === username);
                if (pIndex !== -1) {
                    match.players.splice(pIndex, 1);
                    match.playersocket.splice(pIndex, 1);
                    removed = true;
                }
            }

            if (!removed) {
                console.warn(`⚠️ Player not found in room ${roomname}. username=${username} socketid=${socketid}`);
                // Still continue: room might be empty already or desynced; we’ll evaluate below.
            }

            // --- If room is empty OR only bots remain -> cleanup EVERYTHING ---
            const realPlayersLeft = match.players.filter(p => !p.isBot);
            if (!match.players || match.players.length === 0 || realPlayersLeft.length === 0) {
                // stop countdown / tickers first
                if (match.interval) {
                    clearInterval(match.interval);
                    match.interval = null;
                }
                if (match.botInterval) {
                    clearTimeout(match.botInterval);
                    match.botInterval = null;
                }

                // remove from matches
                matches.splice(matchIndex, 1);
                dlog(`🗑️ Room ${roomname} removed (no real players left)`);

                // remove from activeMatches (what your health check reads)
                if (activeMatches?.[roomname]) {
                    delete activeMatches[roomname];
                    dlog(`🧹 activeMatches cleared: ${roomname}`);
                }

                return;
            }

            // --- Not empty: broadcast updated room state to remaining players ---
            const payload = {
                roomName: match.roomName,
                players: match.players,
                playerSocket: match.playersocket,
                maxPlayers: match.maxPlayers,
                status: match.status,
                countdown: match.countdown
            };

            socket.emit("waitingroomupdate", payload);
        } catch (err) {
            console.error("❌ quitonmatch error:", err);
        }
    });

    //  #endregion

    findmatchreceive(io, socket)
    changematchstate(io, socket)
    needtoreconnect(io, socket)
    removereconnect(io, socket)
    serverremovereconnectplayer(io, socket)
    doneroom(io, socket)
    cancelfindmatch(io, socket)
}