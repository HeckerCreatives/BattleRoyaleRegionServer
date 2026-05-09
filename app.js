const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const { socketserver } = require("./socket/config/socketconfig")

const app = express();

const corsConfig = {
    origin: [""],
    methods: ["GET", "POST", "PUT", "DELETE"], // List only` available methods
    credentials: true, // Must be set to true
    allowedHeaders: ["Origin", "Content-Type", "X-Requested-With", "Accept", "Authorization"],
    credentials: true, // Allowed Headers to be received
};

mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => console.log(err));

app.use(cors(corsConfig));
const server = http.createServer(app);

app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false, parameterLimit: 50000 }))

const dgram = require("dgram");
const serverpinger = dgram.createSocket("udp4");

serverpinger.on("message", (msg, rinfo) => {
    // DO NOT log anything (console.log slows things)
    serverpinger.send(msg, rinfo.port, rinfo.address);
});

serverpinger.bind(5096, "0.0.0.0");

socketserver(server, corsConfig)

const port = process.env.PORT || 5009;  // Dynamic port for deployment
server.listen(port, () => console.log(`Server is running on port: ${port}`));