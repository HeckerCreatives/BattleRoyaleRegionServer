const { matches, activeMatches } = require("../config/socketstates")
const { spawn, execSync } = require("child_process");
var en = require("nanoid-good/locale/en")
var customAlphabet = require("nanoid-good").customAlphabet(en);
const generatedname = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const path = require("path");
const os = require("os");

const Users = require("../../models/Users");
const PlayerCharacterSetting = require("../../models/Playercharactersettings");

const matchQueue = [];
const MAX_QUEUE_SIZE = 400;
const QUEUE_BATCH_SIZE = 2;

// resource assumptions
const RAM_PER_SESSION_MB = 500;
const MAX_CPU_LOAD = 0.85;

function isServerHealthy() {
    const freeRAM = os.freemem() / 1024 / 1024;
    const cpuLoad = os.loadavg()[0] / os.cpus().length;
    const activeSessions = Object.keys(activeMatches).length;

    const requiredRAM = (activeSessions + 1) * RAM_PER_SESSION_MB;
    return freeRAM > requiredRAM && cpuLoad < MAX_CPU_LOAD;
}

function processMatchQueue() {
    if (!isServerHealthy()) {
      console.log("SERVER NOT HEALTHY")
      return;
    }
    if (matchQueue.length === 0) return;

    const batch = matchQueue.splice(0, QUEUE_BATCH_SIZE);

    for (const queued of batch) {
      console.log(`process queue and re emit by ${queued.username}  ${queued.socketid}`)
      HandleFindMatchReceiveOnServerHealthy(queued.io, queued.socket, {
          username: queued.username,
          socketid: queued.socketid
      })
      // queued.socket.emit("findmatchreceive", {
      //     username: queued.username,
      //     socketid: queued.socketid
      // });
    }
}

setInterval(() => {
  console.log("CHECK SERVER QUEUE")
  processMatchQueue();
}, 5000); // 2–5 seconds is perfect

//  #region SERVER APP CREATION


function generateRoomName() {
  return "room_" + generatedname();
}

async function buildCharacterSettingsPayload(match) {
  const usernames = match.players;

  // Users -> lookup PlayerCharacterSettings via owner
  const rows = await Users.aggregate([
    { $match: { username: { $in: usernames } } },

    // only keep what we need
    { $project: { username: 1 } },

    {
      $lookup: {
        from: "playercharactersettings", // ✅ collection name (see note below)
        localField: "_id",
        foreignField: "owner",
        as: "setting"
      }
    },

    // setting is array; keep first or null
    { $unwind: { path: "$setting", preserveNullAndEmptyArrays: true } },

    {
      $project: {
        username: 1,
        ownerId: "$_id",
        hairstyle: { $ifNull: ["$setting.hairstyle", 0] },
        haircolor: { $ifNull: ["$setting.haircolor", 0] },
        clothingcolor: { $ifNull: ["$setting.clothingcolor", 0] },
        skincolor: { $ifNull: ["$setting.skincolor", 0] }
      }
    }
  ]);

  // rows are not guaranteed to be in the same order as usernames
  const byUsername = new Map(rows.map(r => [r.username, r]));

  return usernames.map(username => {
    const r = byUsername.get(username);
    return r ?? {
      username,
      ownerId: null,
      hairstyle: 0,
      haircolor: 0,
      clothingcolor: 0,
      skincolor: 0
    };
  });
}


//  FOR LINUX
async function launchGameServer(match) {
  const logPath = `/ROF/logs/${match.roomName}.log`;

  const playerdata = await buildCharacterSettingsPayload(match)

  console.log(JSON.stringify(playerdata))

  const args = [
    "-a",
    "./Rof_Server.x86_64",
    "-batchmode",
    "-nographics",
    "-logfile", logPath,
    "-region", process.env.SERVER_REGION,
    "-server", "yes",
    "-mapname", "PrototypeMultiplayer",
    "-roomname", match.roomName,
    "-totalplayers", match.players.length,
    "-totalai", match.ai,
    "-playernames", JSON.stringify(match.players),
    "-playercostumedata", JSON.stringify(playerdata)
  ];

  const child = spawn("xvfb-run", args, {
    cwd: "/ROF",
    detached: true,
    stdio: "ignore"
  });

  child.unref(); // <-- Call this separately
  
  activeMatches[match.roomName] = {
    pid: child.pid,
    roomName: match.roomName,
    logPath,
    launchedAt: Date.now()
  };

  console.log(`Launched Fusion server with room: ${match.roomName}`);

  // 🧼 Cleanup on exit
  child.on("exit", (code, signal) => {
    console.log(`Server for room "${match.roomName}" exited (code: ${code}, signal: ${signal})`);
    delete activeMatches[match.roomName];
    const index = matches.findIndex(m => m.roomName === match.roomName);
    if (index !== -1) matches.splice(index, 1);
  });

  child.on("error", (err) => {
    console.error(`Error launching server for room "${match.roomName}":`, err);
    delete activeMatches[match.roomName];
    const index = matches.findIndex(m => m.roomName === match.roomName);
    if (index !== -1) matches.splice(index, 1);
  });
}

//  #endregion

//  FOR WINDOWS

async function launchGameWindowsServer(match) {
  const logPath = path.join("C:", "ROF", "logs", `${match.roomName}.log`);
  const exePath = path.join("C:", "ROF", "Rise of Fearless.exe");

  const playerdata = await buildCharacterSettingsPayload(match)

  console.log(JSON.stringify(playerdata))

  const args = [
    // "-batchmode",
    // "-nographics",
    "-logfile", logPath,
    "-region", process.env.SERVER_REGION,
    "-server", "yes",
    "-mapname", "PrototypeMultiplayer",
    "-roomname", match.roomName,
    "-totalplayers", match.players.length,
    "-totalai", match.ai,
    "-playernames", JSON.stringify(match.players),
    "-playercostumedata", JSON.stringify(playerdata)
  ];

  // ⚡ for production (hidden background)
  const child = spawn(exePath, args, {
    cwd: "C:/ROF",
    detached: true,
    windowsHide: false,   // hides extra console window
    stdio: ["ignore", "pipe", "pipe"]     // don’t tie logs to parent Node
  });

  child.unref();

  activeMatches[match.roomName] = {
    pid: child.pid,
    roomName: match.roomName,
    logPath,
    launchedAt: Date.now()
  };

  console.log(`Launched Fusion server with room: ${match.roomName}`);

  child.on("exit", (code, signal) => {
    console.log(`Server for room "${match.roomName}" exited (code: ${code}, signal: ${signal})`);
    delete activeMatches[match.roomName];
    const index = matches.findIndex(m => m.roomName === match.roomName);
    if (index !== -1) matches.splice(index, 1);
  });

  child.on("error", (err) => {
    console.error(`Error launching server for room "${match.roomName}":`, err);
    delete activeMatches[match.roomName];
    const index = matches.findIndex(m => m.roomName === match.roomName);
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

        // prevent duplicate queue
        if (matchQueue.some(q => q.username === username)) {
          return;
        }

        // server overloaded → queue
        if (!isServerHealthy()) {

          console.log("SERVER NOT HEALTHY ON FIND MATCH RECEIVE")

          if (matchQueue.length >= MAX_QUEUE_SIZE) {
              return;
          }

          matchQueue.push({ username, socketid, socket, io });
          return;
        }
        
        console.log(`Find match receive data: ${data}`)

        let match = matches.find(m =>
            m.status === "WAITING" &&
            m.players.length < m.maxPlayers
        );

        if (!match) {
            const roomName = generateRoomName();

            match = {
                roomName,
                status: "WAITING",
                players: [],
                playersocket: [],
                maxPlayers: 30,
                countdownStarted: false,
                countdown: 180,
                interval: null,
                ai: 0,
                serversocket: socket
            };

            activeMatches[roomName] = {}

            matches.push(match);
        }

        match.players.push(username);
        match.playersocket.push(socketid);

        console.log(`MATCH STATUS: ${match.status} ROOM: ${match.roomName}`)

        socket.emit("waitingroomupdate", {
            roomName: match.roomName,
            players: match.players,
            playerSocket: match.playersocket,
            maxPlayers: match.maxPlayers,
            status: match.status,
            countdown: match.countdown
        });

        if ( match.players.length >= 1 && !match.countdownStarted) {
            startLobbyCountdown(match, io);
        }
    })
}

function HandleFindMatchReceiveOnServerHealthy (io, socket, data) {
  
  const userdata = data
  const username = userdata.username
  const socketid = userdata.socketid

  // prevent duplicate queue
  if (matchQueue.some(q => q.username === username)) {
    return;
  }

  // server overloaded → queue
  if (!isServerHealthy()) {

    console.log("SERVER NOT HEALTHY ON FIND MATCH RECEIVE")

    if (matchQueue.length >= MAX_QUEUE_SIZE) {
        return;
    }

    matchQueue.push({ username, socketid, socket, io });
    return;
  }

  //  CHECK IF THERE'S STILL A QUEUE IF STILL HAVE, THEN QUEUE THE PLAYER
  if (matchQueue.length > 0) {
    matchQueue.push({ username, socketid, socket });
    return;
  }
  
  console.log(`Find match receive data: ${data}`)

  let match = matches.find(m =>
      m.status === "WAITING" &&
      m.players.length < m.maxPlayers
  );

  if (!match) {
      const roomName = generateRoomName();

      match = {
          roomName,
          status: "WAITING",
          players: [],
          playersocket: [],
          maxPlayers: 30,
          countdownStarted: false,
          countdown: 180,
          interval: null
      };

      activeMatches[roomName] = {}

      matches.push(match);
  }

  match.players.push(username);
  match.playersocket.push(socketid);

  console.log(`MATCH STATUS: ${match.status} ROOM: ${match.roomName}`)

  socket.emit("waitingroomupdate", {
      roomName: match.roomName,
      players: match.players,
      playerSocket: match.playersocket,
      maxPlayers: match.maxPlayers,
      status: match.status,
      countdown: match.countdown
  });

  if ( match.players.length >= 1 && !match.countdownStarted) {
      startLobbyCountdown(match, io);
  }
}

function startLobbyCountdown(match, io) {
    match.countdownStarted = true;

    let timeLeft = 180;

    match.countdown = 180;

    match.interval = setInterval(() => {
        timeLeft--;
        match.countdown = timeLeft
        if (timeLeft <= 0) {
            clearInterval(match.interval);
            startPhotonServer(match, io);
        }
    }, 1000);
}

function startPhotonServer(match, io) {
  match.status = "STARTING";

  if (process.env.SERVER_TYPE === "windows") {
      launchGameWindowsServer(match);
  } else {
      launchGameServer(match);
  }

  // OPTIONAL: wait for health check here

  match.serversocket.emit("enteringmatch",{
    roomName: match.roomName,
    playerSocket: match.playersocket,
    maxPlayers: match.maxPlayers,
    status: match.status
  });

  match.status = "BATTLE";
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
        socket.emit("reconnectexist", {
          roomName: match.roomName,
          players: match.players,
          playerSocket: match.playersocket,
          maxPlayers: match.maxPlayers,
          status: match.status,
          countdown: match.countdown
        });
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

    if (match == null){
      
      console.log(`🗑️ Removed player because match is null: ${removedPlayer}, socket: ${removedSocket}`);

      socket.emit("doneremovereconnect", { socketid });

      io.emit("gameremoveplayer", username)
    }

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
    match.serversocket.emit("matchstatuschanged", match);
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