const sendnotification = async (io, socket) => {
    socket.on("sendnotification", (data) => {

        console.log(`web has send a notification`)
        console.log(`socket server will trigger notification refresh to all clients`)
        
        io.emit("receivenotification", "")
    })
}

module.exports = {
    sendnotification
}