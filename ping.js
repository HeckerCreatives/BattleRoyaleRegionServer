const dgram = require("dgram");

const client = dgram.createSocket("udp4");

client.on("message", (msg) => {
    console.log("reply:", msg.toString());
    client.close();
});

client.send("ping", 5096, "3.141.1.233");