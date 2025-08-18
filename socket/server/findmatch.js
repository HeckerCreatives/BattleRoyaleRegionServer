const { matches, activeMatches } = require("../config/socketstates")
const { spawn, execSync } = require("child_process");
var en = require("nanoid-good/locale/en")
var customAlphabet = require("nanoid-good").customAlphabet(en);
const generatedname = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

//  #region SERVER APP CREATION


function generateRoomName() {
  return "room_" + generatedname();
}


//  FOR LINUX
function launchGameServer(roomName) {
  const logPath = `/ROF/logs/${roomName}.log`;

  const args = [
    "-a",
    "./Rof_Server.x86_64",
    "-batchmode",
    "-nographics",
    "-logfile", logPath,
    "-region", process.env.SERVER_REGION,
    "-server", "yes",
    "-mapname", "PrototypeMultiplayer",
    "-roomname", roomName,
  ];

  const child = spawn("xvfb-run", args, {
    cwd: "/ROF",
    detached: true,
    stdio: "ignore"
  });

  child.unref(); // <-- Call this separately
  
  activeMatches[roomName] = {
    pid: child.pid,
    roomName,
    logPath,
    launchedAt: Date.now()
  };

  console.log(`Launched Fusion server with room: ${roomName}`);

  // 🧼 Cleanup on exit
  child.on("exit", (code, signal) => {
    console.log(`Server for room "${roomName}" exited (code: ${code}, signal: ${signal})`);
    delete activeMatches[roomName];
    const index = matches.findIndex(m => m.roomName === roomName);
    if (index !== -1) matches.splice(index, 1);
  });

  // Optional: listen for errors
  child.on("error", (err) => {
    console.error(`Error launching server for room "${roomName}":`, err);
    delete activeMatches[roomName];
    const index = matches.findIndex(m => m.roomName === roomName);
    if (index !== -1) matches.splice(index, 1);
  });
}

//  #endregion


//  #region SOCKET

const findmatchreceive = async (io, socket) => {
    socket.on("findmatchreceive", async (data) => {


        const userdata = data
        const username = userdata.username
        const socketid = userdata.socketid
        
        console.log(`Find match receive data: ${data}`)

        let match = matches.find(m =>
            (m.status === "WAITING" || m.status === "SETTINGUP") &&
            m.players.length < m.maxPlayers
        );

        if (!match) {
            const roomName = generateRoomName();

            launchGameServer(roomName);

            match = {
                roomName,
                status: "SETTINGUP",
                players: [],
                playersocket: [],
                maxPlayers: 50
            };

            matches.push(match);
        }

        match.players.push(username);
        match.playersocket.push(socketid);

        console.log(`MATCH STATUS: ${match.status} ROOM: ${match.roomName}`)

        if (match.status === "WAITING") {
          console.log(`SENDING MATCH STATUS TO ${socketid} WITH MATCH DATA STATUS: ${match.status}  ROOM: ${match.roomName}`)
          socket.emit("matchfound", {
            roomname: match.roomName,
            socketid: socketid
          });
        }
    })
}

//  #endregion

//  #region SOCKET THIS SERVER TO GAME SERVER UNITY

const changematchstate = async (io, socket) => {
    socket.on("changematchstate", async (data) => {
        const matchdata = JSON.parse(data);
        const matchname = matchdata.sessioname;
        const matchstatus = matchdata.status;

        const match = matches.find(m => m.roomName === matchname);

        if (!match) {
            console.warn(`No match found with roomName: ${matchname}`);
            return;
        }

        match.status = matchstatus;
        console.log(`Match "${matchname}" status changed to "${matchstatus}"`);

        if (matchstatus === "WAITING") {
            notifyplayersformatchstatus(match, io);
        }
    });
}

const notifyplayersformatchstatus = (match, io) => {
    console.log(`SENDING MATCH STATUS ${match.status}`)
    io.emit("matchstatuschanged", match);
}

//  #endregion

module.exports = {
    findmatchreceive,
    changematchstate,
    notifyplayersformatchstatus
}