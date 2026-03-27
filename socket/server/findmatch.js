const { matches, activeMatches } = require("../config/socketstates")
const { spawn, execSync } = require("child_process");
var en = require("nanoid-good/locale/en")
var customAlphabet = require("nanoid-good").customAlphabet(en);
const generatedname = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const path = require("path");
const os = require("os");

const Users = require("../../models/Users");
const PlayerCharacterSetting = require("../../models/Playercharactersettings");
const { time } = require("console");

const matchQueue = [];
const MAX_QUEUE_SIZE = 400;
const QUEUE_BATCH_SIZE = 2;

// resource assumptions
const RAM_PER_SESSION_MB = 500;
const MAX_CPU_LOAD = 0.95;

function isServerHealthy() {
    const freeRAM = os.freemem() / 1024 / 1024;
    const cpuLoad = os.loadavg()[0] / os.cpus().length;
    const activeSessions = Object.keys(activeMatches).length;

    const requiredRAM = (activeSessions + 1) * RAM_PER_SESSION_MB;
    return freeRAM > requiredRAM && cpuLoad < MAX_CPU_LOAD;
}

function processMatchQueue() {
    if (matchQueue.length === 0) return;

    const batch = matchQueue.splice(0, QUEUE_BATCH_SIZE);

    for (const queued of batch) {
        console.log(`PROCESS QUEUE: ${queued.username} ${queued.socketid}`);

        handleFindMatchCore(queued.io, queued.socket, {
            username: queued.username,
            socketid: queued.socketid
        });
    }
}

setInterval(() => {
  console.log("CHECK SERVER QUEUE")
  processMatchQueue();
}, 5000); // 2–5 seconds is perfect

const offers = new Map(); // offerId -> { roomName, players, socketIds, expiresAt, accepted:Set, acked:Set }
const OFFER_TTL_MS = 15000;

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

//  #endregion

// #region FOR LINUX
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
    "-mapname", "Ethiopia",
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

// #region FOR WINDOWS

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
    "-mapname", "Ethiopia",
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

//  #region FIND MATCH CORE

function getAvailableWaitingMatch() {
    return matches.find(m =>
        m.status === "WAITING" &&
        m.players.length < m.maxPlayers
    );
}

function addPlayerToMatch(match, username, socketid, socket, io) {
    // prevent duplicate inside same room
    if (match.playersocket.includes(socketid) || match.players.includes(username)) {
        return;
    }

    match.players.push(username);
    match.playersocket.push(socketid);

    console.log(`MATCH STATUS: ${match.status} ROOM: ${match.roomName}`);

    socket.emit("waitingroomupdate", {
        roomName: match.roomName,
        players: match.players,
        playerSocket: match.playersocket,
        maxPlayers: match.maxPlayers,
        status: match.status,
        countdown: match.countdown
    });

    if (match.players.length >= 1 && !match.countdownStarted) {
        startLobbyCountdown(match, io);
    }
}

function handleFindMatchCore(io, socket, data) {
    const userdata = data;
    const username = userdata.username;
    const socketid = userdata.socketid;

    // prevent duplicate queue entry
    if (matchQueue.some(q => q.username === username || q.socketid === socketid)) {
        console.log(`preventing dual entry for ${username}`)
        return;
    }

    // prevent duplicate join in existing matches
    const alreadyInMatch = matches.some(m =>
        m.playersocket.includes(socketid) || m.players.includes(username)
    );

    if (alreadyInMatch) {
        console.log(`already in match ${username}`)
        return;
    }

    // FIRST: try to join an existing waiting room
    let match = getAvailableWaitingMatch();

    if (match) {
        console.log(`JOINING EXISTING ROOM EVEN IF SERVER UNHEALTHY: ${match.roomName}`);
        addPlayerToMatch(match, username, socketid, socket, io);
        return;
    }

    // SECOND: only check health if we need to create a new room
    if (!isServerHealthy()) {
        console.log("SERVER NOT HEALTHY AND NO AVAILABLE ROOM");

        if (matchQueue.length >= MAX_QUEUE_SIZE) {
            return;
        }

        matchQueue.push({ username, socketid, socket, io });
        return;
    }

    // THIRD: create a new room because none exists and server is healthy
    const roomName = generateRoomName();

    match = {
        roomName,
        status: "WAITING",
        players: [],
        playersocket: [],
        maxPlayers: 30,
        countdownStarted: false,
        countdown: 90,
        interval: null,
        ai: 0,
        serversocket: socket
    };

    activeMatches[roomName] = {};
    matches.push(match);

    console.log(`CREATED NEW ROOM: ${roomName}`);

    addPlayerToMatch(match, username, socketid, socket, io);
}

// #endregion

//  #region SOCKET

const findmatchreceive = async (io, socket) => {
    socket.on("findmatchreceive", async (data) => {
        handleFindMatchCore(io, socket, data);
    });
}

function startLobbyCountdown(match, io) {
    match.countdownStarted = true;

    let timeLeft = 90;

    match.countdown = timeLeft;

    match.interval = setInterval(() => {
        timeLeft--;
        match.countdown = timeLeft

        if (timeLeft <= 0) {

            if (match.players.length < 2){

              match.countdown = 30
              timeLeft = 30;

              console.log(`Restarted timer for match: ${match}`)

              return;
            }

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
          countdown: match.countdown,
          playerneedtorecon: socketid
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
      
      console.log(`🗑️ Removed player because match is null: ${username}, socket: ${socketid}`);

      socket.emit("doneremovereconnect", { socketid });

      io.emit("gameremoveplayer", username)

      return;
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
    try {
      const matchdata = typeof data === "string" ? JSON.parse(data) : data;
      const username = matchdata.username?.trim();

      console.log("remove reconnect raw data:", data);
      console.log("parsed username:", username);

      if (!username) {
        console.log("🗑️ No remove reconnect because username is missing");
        return;
      }

      const match = matches.find(m => Array.isArray(m.players) && m.players.includes(username));

      if (!match) {
        console.log(`🗑️ No remove reconnect because no match found for ${username}`);
        return;
      }

      console.log("match found:", {
        roomName: match.roomName,
        players: match.players,
        playersocket: match.playersocket
      });

      const index = match.players.indexOf(username);

      if (index === -1) {
        console.log(`🗑️ No remove reconnect because username not found in players`);
        return;
      }

      const removedPlayer = match.players.splice(index, 1)[0];

      let removedSocket = null;
      if (Array.isArray(match.playersocket) && match.playersocket.length > index) {
        removedSocket = match.playersocket.splice(index, 1)[0];
      }

      console.log(`🗑️ Server removed player: ${removedPlayer}`);
      console.log(`🗑️ Removed socket: ${removedSocket}`);
      console.log("updated match:", {
        roomName: match.roomName,
        players: match.players,
        playersocket: match.playersocket
      });
    } catch (error) {
      console.log("🗑️ Error in serverremovereconnect:", error);
    }
  });
};

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