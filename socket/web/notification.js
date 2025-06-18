const sendnotification = async (io, socket) => {
    socket.on("sendnewsandshowcase", (data) => {

        console.log(`web has send a news and showcase ${data}`)
        console.log(`socket server will trigger news and showcase notification refresh to all clients`)
        
        socket.broadcast.emit("receivenotification", data)
    })
}

module.exports = {
    sendnotification
}