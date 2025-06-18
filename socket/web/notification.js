const sendnewsandshowcasenotif = async (io, socket) => {
    socket.on("sendnewsandshowcase", (data) => {

        console.log(`web has send a news and showcase ${data}`)
        console.log(`socket server will trigger news and showcase notification refresh to all clients`)
        
        socket.broadcast.emit("receivenewsandshowcase", data)
    })
}

const sendmessagesnotif = async (io, socket) => {
    socket.on("sendmessagesnotif", (data) => {

        console.log(`web has send a messages ${data}`)
        console.log(`socket server will trigger messages notification refresh to all clients`)
        
        socket.broadcast.emit("receivemessages", data)
    })
}

module.exports = {
    sendnewsandshowcasenotif,
    sendmessagesnotif
}