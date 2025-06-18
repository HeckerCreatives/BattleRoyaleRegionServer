const { activeUsers, socketHeartbeats } = require("./socketstates")
const {sendnotification} = require("../web/notification")

const HEARTBEAT_INTERVAL = 5000; // Send ping every 10 seconds
const TIMEOUT = 10000;            // Wait 10 seconds for pong
const MAX_MISSED_PINGS = 3;

exports.eventconnection = (io, socket) => {
    let currentUserId = null;

    const startHeartbeat = () => {

        const heartbeatData = {
            missedPings: 0,
            interval: null,
            timeout: null,
        };

        const sendPing = () => {
            if (!socket.connected) return;
                console.log(`Sending ping to ${socket.id}`);
                socket.emit("ping", Date.now());

                heartbeatData.timeout = setTimeout(() => {
                    heartbeatData.missedPings++;
                    console.warn(`Missed pong from ${socket.id} (${heartbeatData.missedPings}/${MAX_MISSED_PINGS})`);

                    if (heartbeatData.missedPings >= MAX_MISSED_PINGS) {
                        console.log(`Too many missed pings. Disconnecting ${socket.id}`);
                        forceLogout(socket);
                    }
            }, TIMEOUT);
        };

            // Start ping loop
        sendPing();
        heartbeatData.interval = setInterval(sendPing, HEARTBEAT_INTERVAL);

        socketHeartbeats.set(socket.id, heartbeatData);
    };

    const stopHeartbeat = () => {
        const hb = socketHeartbeats.get(socket.id);
        if (!hb) return;
        clearInterval(hb.interval);
        clearTimeout(hb.timeout);
        socketHeartbeats.delete(socket.id);
    };

    const forceLogout = (sock) => {
        stopHeartbeat();

        for (const [userId, sockId] of activeUsers.entries()) {
            if (sockId === sock.id) {
                activeUsers.delete(userId);
                console.log(`Force-logged out ${userId}`);
                break;
            }
        }

        sock.emit("duallogin", "")
        sock.disconnect(true)
    };

    //  #region SOCKET MAIN EVENTS

    socket.on("login", (id) => {
        currentUserId = id.toLowerCase();
        const existing = activeUsers.get(currentUserId);

        if (existing && existing !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existing);
            if (oldSocket) forceLogout(oldSocket);
        }

        activeUsers.set(currentUserId, socket.id);
        socket.join(currentUserId);
        startHeartbeat();

        console.log(`User ${currentUserId} logged in on ${socket.id}`);
    });

    socket.on("pong", (timestamp) => {
        const hb = socketHeartbeats.get(socket.id);
        if (hb) {
            clearTimeout(hb.timeout);
            hb.missedPings = 0; // Reset on success
        }

        const latency = Date.now() - timestamp;
        console.log(`Pong from ${socket.id}, latency: ${latency}ms`);
    });

    socket.on("disconnecting", (reason) => {
        console.log(`Disconnecting ${socket.id}, reason: ${reason}`);
        stopHeartbeat();

        if (currentUserId && activeUsers.get(currentUserId) === socket.id) {
            activeUsers.delete(currentUserId);
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
    });

    //  #endregion

    //  #region WEB

    sendnotification(io, socket)

    //  #endregion
}