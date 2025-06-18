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

app.use(cors(corsConfig));
const server = http.createServer(app);

app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false, parameterLimit: 50000 }))

socketserver(server, corsConfig)

const port = process.env.PORT || 5002; // Dynamic port for deployment
server.listen(port, () => console.log(`Server is running on port: ${port}`));