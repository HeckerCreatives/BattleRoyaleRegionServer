const { matches, activeMatches } = require("../config/socketstates")
const { spawn, execSync } = require("child_process");
var en = require("nanoid-good/locale/en")
var customAlphabet = require("nanoid-good").customAlphabet(en);
const generatedname = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const path = require("path");

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

//  FOR WINDOWS

function launchGameWindowsServer(roomName) {
  const logPath = path.join("C:", "ROF", "logs", `${roomName}.log`);
  const exePath = path.join("C:", "ROF", "Rise of Fearless.exe");

  const args = [
    // "-batchmode",
    // "-nographics",
    "-logfile", logPath,
    "-region", process.env.SERVER_REGION,
    "-server", "yes",
    "-mapname", "PrototypeMultiplayer",
    "-roomname", roomName,
  ];

  // ⚡ for production (hidden background)
  const child = spawn(exePath, args, {
    cwd: "C:/ROF",
    detached: true,
    windowsHide: false,   // hides extra console window
    stdio: ["ignore", "pipe", "pipe"]     // don’t tie logs to parent Node
  });

  child.unref();

  activeMatches[roomName] = {
    pid: child.pid,
    roomName,
    logPath,
    launchedAt: Date.now()
  };

  console.log(`Launched Fusion server with room: ${roomName}`);

  child.on("exit", (code, signal) => {
    console.log(`Server for room "${roomName}" exited (code: ${code}, signal: ${signal})`);
    delete activeMatches[roomName];
    const index = matches.findIndex(m => m.roomName === roomName);
    if (index !== -1) matches.splice(index, 1);
  });

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

            if (process.env.SERVER_TYPE == "windows"){
              launchGameWindowsServer(roomName)
            }
            else{
              launchGameServer(roomName);
            }

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

const needtoreconnect = async (io, socket) => {
  socket.on("needtoreconnect", async (data) => {
    const { username, socketid } = data;
    console.log(`Reconnect request from: ${username} (${socketid})`);

    const match = matches.find(m => m.players.includes(username));

    if (match){
      const index = match.players.indexOf(username);

      if (index !== -1){
        const oldSocket = match.playersocket[index];
        match.playersocket[index] = socketid;

        console.log(`✅ Player ${username} reconnected: oldSocket=${oldSocket}, newSocket=${socketid}`);

        // Return updated match only to the reconnecting socket
        socket.emit("reconnectexist", match);
      }
      else{
        console.log(`⚠️ No active match found for ${username}`);
        socket.emit("reconnectfail", { socketid });
      }
    }
    else{
        console.log(`⚠️ No active match found for ${username}`);
        socket.emit("reconnectfail", { socketid });
    }
  })
}

const removereconnect = async (io, socket) => {
  socket.on("removereconnect", async (data) => {
    const { username, socketid } = data;

    const match = matches.find(m => m.players.includes(username));

    const index = match.players.indexOf(username);

    if (index === -1) {
      console.log(`🗑️ No remove reconnect`);
      return;
    }
    
    const removedPlayer = match.players.splice(index, 1)[0];
    const removedSocket = match.playersocket.splice(index, 1)[0];

    console.log(`🗑️ Removed player: ${removedPlayer}, socket: ${removedSocket}`);

    socket.emit("doneremovereconnect", { socketid });

    io.emit("gameremoveplayer", username)
  })
}

const serverremovereconnectplayer = async (io, socket) => {
  socket.on("serverremovereconnect", async (data) => {
    const matchdata = JSON.parse(data);
    const username = matchdata.username;

    const match = matches.find(m => m.players.includes(username));

    const index = match.players.indexOf(username);

    if (index === -1) {
      console.log(`🗑️ No remove reconnect`);
      return;
    }
    
    const removedPlayer = match.players.splice(index, 1)[0];

    console.log(`🗑️ Server removed player: ${removedPlayer}`);
  })
}

const doneroom = async (io, socket) => {
  socket.on("doneroom", async (data) => {
    const matchdata = JSON.parse(data);
    const matchname = matchdata.sessioname;

    // Correct search
    const index = matches.findIndex(m => m.roomName === matchname);

    if (index === -1) {
      console.log(`🗑️ No room found to be done`);
      return;
    }

    const removedRoom = matches.splice(index, 1)[0];

    console.log(`🗑️ Server removed room: ${removedRoom.roomName}`);
  });
};

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
    notifyplayersformatchstatus,
    needtoreconnect,
    removereconnect,
    serverremovereconnectplayer,
    doneroom
}