const { matches, activeMatches } = require("../config/socketstates")
const { spawn, execSync } = require("child_process");
var en = require("nanoid-good/locale/en")
var customAlphabet = require("nanoid-good").customAlphabet(en);
const generatedname = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
const path = require("path");
const os = require("os");

// Bursty per-match/per-event logs. Gate behind SOCKET_DEBUG=1 so prod stays
// quiet; warnings/errors (console.warn/console.error) are left intact.
const SOCKET_DEBUG = process.env.SOCKET_DEBUG === "1";
const dlog = (...a) => { if (SOCKET_DEBUG) console.log(...a); };

const Users = require("../../models/Users");
const PlayerCharacterSetting = require("../../models/Playercharactersettings");
const { time } = require("console");

const matchQueue = [];
const MAX_QUEUE_SIZE = 400;
const QUEUE_BATCH_SIZE = 2;

const BOT_SPAWN_AVATARS    = ["AVATAR1", "AVATAR2", "AVATAR3", "AVATAR4", "AVATAR5"];
const BOT_NAMES = [
    "Concierge", "Ganielle", "YatoGummy", "BonkMeHerta", "CurtainCall",
    "DKitaItemsSaLapag", "Yahi Cakes", "BlackPeach", "PDaveFile", "Yakeru",
    "Preaks", "Kaius", "Shirkish", "Shuyanii", "Claymist",
    "BoomBoomYehey", "Kelboogle", "HebePogi", "ZoeZoe", "CrazyChixx",
    "belleDOTexe", "Joshtr", "Darx", "Daryll", "kidneyfeliz",
    "PixelPioneer9T3", "NebulaVoyager42", "enviousdominant", "thievescounty",
    "focusedskein", "modifiedtophat", "JoeMama", "SpicyEnemy"
];
const BOT_HAIRSTYLES       = [0, 1, 2, 3, 4];
const BOT_HAIRCOLORS       = [0, 1, 2, 3, 4];
const BOT_CLOTHINGCOLORS   = [0, 1, 2, 3, 4];
const BOT_SKINCOLORS       = [0, 1, 2, 3, 4];

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
        dlog(`PROCESS QUEUE: ${queued.username} ${queued.socketid}`);

        handleFindMatchCore(queued.io, queued.socket, {
            username: queued.username,
            socketid: queued.socketid,
            avatarid: queued.avatarid  // ✅ add this
        });
    }
}

setInterval(() => {
  dlog("CHECK SERVER QUEUE")
  processMatchQueue();
}, 5000); // 2–5 seconds is perfect

const offers = new Map(); // offerId -> { roomName, players, socketIds, expiresAt, accepted:Set, acked:Set }
const OFFER_TTL_MS = 15000;

//  #region SERVER APP CREATION


function generateRoomName() {
  return "room_" + generatedname();
}

async function buildCharacterSettingsPayload(match) {
  const players = match.players; // [{ username, avatarid }]
  const usernames = players.map(p => p.username); // ✅ ["STRONGWARRIOR12"]

  const rows = await Users.aggregate([
    { $match: { username: { $in: usernames } } }, // ✅ now matches correctly
    { $project: { username: 1 } },
    {
      $lookup: {
        from: "playercharactersettings",
        localField: "_id",
        foreignField: "owner",
        as: "setting"
      }
    },
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

  const byUsername = new Map(rows.map(r => [r.username, r]));

  // ✅ Map over players to preserve avatarid alongside the DB result
  return players.map(player => {
    const r = byUsername.get(player.username);
    return {
      ...(r ?? {
        username: player.username,
        avatarid: player.avatarid, // ✅ always carry avatarid through
        ownerId: null,
        hairstyle: 0,
        haircolor: 0,
        clothingcolor: 0,
        skincolor: 0
      })
    };
  });
}

//  #endregion

// #region FOR LINUX
async function launchGameServer(match) {
  const logPath = `/ROF/logs/${match.roomName}.log`;

  const realPlayers = match.players.filter(p => !p.isBot);
  const botPlayers  = match.players.filter(p => p.isBot);

  const playerdata = await buildCharacterSettingsPayload({ ...match, players: realPlayers });

  const botcostumedata = botPlayers.map(bot => ({
    username:      bot.username,
    avatarid:      bot.avatarid,
    hairstyle:     randFrom(BOT_HAIRSTYLES),
    haircolor:     randFrom(BOT_HAIRCOLORS),
    clothingcolor: randFrom(BOT_CLOTHINGCOLORS),
    skincolor:     randFrom(BOT_SKINCOLORS)
  }));

  dlog(JSON.stringify(playerdata))

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
    "-totalplayers", realPlayers.length,
    "-totalai", match.ai,
    "-playernames", JSON.stringify(realPlayers.map(p => p.username)),
    "-playercostumedata", JSON.stringify(playerdata),
    "-botcostumedata", JSON.stringify(botcostumedata)
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

  dlog(`Launched Fusion server with room: ${match.roomName}`);

  // 🧼 Cleanup on exit
  child.on("exit", (code, signal) => {
    dlog(`Server for room "${match.roomName}" exited (code: ${code}, signal: ${signal})`);
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

  const realPlayers = match.players.filter(p => !p.isBot);
  const botPlayers  = match.players.filter(p => p.isBot);

  const playerdata = await buildCharacterSettingsPayload({ ...match, players: realPlayers });

  const botcostumedata = botPlayers.map(bot => ({
    username:      bot.username,
    avatarid:      bot.avatarid,
    hairstyle:     randFrom(BOT_HAIRSTYLES),
    haircolor:     randFrom(BOT_HAIRCOLORS),
    clothingcolor: randFrom(BOT_CLOTHINGCOLORS),
    skincolor:     randFrom(BOT_SKINCOLORS)
  }));

  dlog(JSON.stringify(playerdata))

  const args = [
    // "-batchmode",
    // "-nographics",
    "-logfile", logPath,
    "-region", process.env.SERVER_REGION,
    "-server", "yes",
    "-mapname", "Ethiopia",
    "-roomname", match.roomName,
    "-totalplayers", realPlayers.length,
    "-totalai", match.ai,
    "-playernames", JSON.stringify(realPlayers.map(p => p.username)),
    "-playercostumedata", JSON.stringify(playerdata),
    "-botcostumedata", JSON.stringify(botcostumedata)
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

  dlog(`Launched Fusion server with room: ${match.roomName}`);

  child.on("exit", (code, signal) => {
    dlog(`Server for room "${match.roomName}" exited (code: ${code}, signal: ${signal})`);
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
        (m.players.length < m.maxPlayers || m.players.some(p => p.isBot))
    );
}

function addPlayerToMatch(match, username, avatarid, socketid, socket, io) {
    // prevent duplicate inside same room (only real-player duplicates)
    if (
        match.playersocket.includes(socketid) ||
        match.players.some(p => !p.isBot && p.username === username)
    ) {
        return;
    }

    // If a bot has the same username, convert that slot into a real player slot.
    // This avoids false "already in room" rejections when bot names collide with player names.
    const sameNameBotIndex = match.players.findIndex(p => p.isBot && p.username === username);
    if (sameNameBotIndex !== -1) {
        match.players[sameNameBotIndex] = { username, avatarid };
        match.playersocket[sameNameBotIndex] = socketid;
        if (match.ai > 0) match.ai--;

        socket.emit("waitingroomupdate", {
            roomName: match.roomName,
            players: match.players,
            playerSocket: match.playersocket,
            maxPlayers: match.maxPlayers,
            status: match.status,
            countdown: match.countdown
        });
        return;
    }

    // Room is full — displace the last bot to make room for this real player
    if (match.players.length >= match.maxPlayers) {
        const lastBotIndex = match.players.reduce((found, p, i) => p.isBot ? i : found, -1);
        if (lastBotIndex === -1) return; // full with real players only
        match.players.splice(lastBotIndex, 1);
        match.playersocket.splice(lastBotIndex, 1);
        match.ai--;
        dlog(`Displaced a bot to make room for ${username} in ${match.roomName}`);
    }

    match.players.push({
      username: username,
      avatarid: avatarid
    });
    match.playersocket.push(socketid);

    dlog(`MATCH STATUS: ${match.status} ROOM: ${match.roomName}`);

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
        startBotSpawning(match, io);
    }
}

function handleFindMatchCore(io, socket, data) {
    const userdata = data;
    const username = userdata.username;
    const avatarid = userdata.avatarid;
    const socketid = userdata.socketid;

    // prevent duplicate queue entry
    if (matchQueue.some(q => q.username === username || q.socketid === socketid)) {
        dlog(`preventing dual entry for ${username}`)
        return;
    }

    // prevent duplicate join in existing matches
    const alreadyInMatch = matches.some(m =>
        m.playersocket.includes(socketid) || 
        m.players.some(p => !p.isBot && p.username === username)  // ✅ only real-player collisions
    );

    if (alreadyInMatch) {
        dlog(`already in match ${username}`)
        return;
    }

    // FIRST: try to join an existing waiting room
    let match = getAvailableWaitingMatch();

    if (match) {
        dlog(`JOINING EXISTING ROOM EVEN IF SERVER UNHEALTHY: ${match.roomName}`);
        addPlayerToMatch(match, username, avatarid, socketid, socket, io);
        return;
    }

    // SECOND: only check health if we need to create a new room
    if (!isServerHealthy()) {
        dlog("SERVER NOT HEALTHY AND NO AVAILABLE ROOM");

        if (matchQueue.length >= MAX_QUEUE_SIZE) {
            return;
        }

        matchQueue.push({ username, avatarid, socketid, socket, io }); // ✅ add avatarid
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
        countdown: 75,
        interval: null,
        botInterval: null,
        ai: 0,
        usedBotNames: new Set(),
        serversocket: socket
    };

    activeMatches[roomName] = {};
    matches.push(match);

    dlog(`CREATED NEW ROOM: ${roomName}`);

    addPlayerToMatch(match, username, avatarid, socketid, socket, io);
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

    let timeLeft = match.countdown;

    match.countdown = timeLeft;

    match.interval = setInterval(() => {
        timeLeft--;
        match.countdown = timeLeft

        // At 15s mark, flush any remaining bot slots instantly
        if (timeLeft === 15) {
            clearTimeout(match.botInterval);
            match.botInterval = null;
            fillRemainingWithBots(match);
        }

        if (timeLeft <= 0) {

            if (match.players.length < 2){

              match.countdown = 30
              timeLeft = 30;

              dlog(`Restarted timer for match: ${match}`)

              return;
            }

            clearInterval(match.interval);
            clearTimeout(match.botInterval);
            match.botInterval = null;
            startPhotonServer(match, io);
        }
    }, 1000);
}

function fillRemainingWithBots(match) {
    while (match.players.length < match.maxPlayers) {
        const availableNames = BOT_NAMES.filter(n => !match.usedBotNames.has(n));
        const botName = availableNames.length > 0
            ? randFrom(availableNames)
            : `BOT_${generatedname()}`;
        match.usedBotNames.add(botName);

        match.players.push({
            username: botName,
            avatarid: randFrom(BOT_SPAWN_AVATARS),
            isBot: true
        });
        match.playersocket.push(`BOT_SOCKET_${generatedname()}`);
        match.ai++;

        dlog(`Bot ${botName} filled remaining slot in ${match.roomName} (total: ${match.players.length}/${match.maxPlayers})`);
    }

    match.serversocket.emit("waitingroomupdate", {
        roomName: match.roomName,
        players: match.players,
        playerSocket: match.playersocket,
        maxPlayers: match.maxPlayers,
        status: match.status,
        countdown: match.countdown
    });
}

function startBotSpawning(match, io) {
    if (match.botInterval) return;

    // Bots finish joining before the 15s buffer — spread across the available window
    const STOP_AT_SECONDS = 15;
    const windowMs = (match.countdown - STOP_AT_SECONDS) * 1000; // 45 000 ms
    const baseIntervalMs = windowMs / (match.maxPlayers - 1);    // ~1 552 ms

    const scheduleNext = () => {
        // Randomize ±50 % around the base so joins feel organic
        const delay = baseIntervalMs * (0.5 + Math.random());
        match.botInterval = setTimeout(spawnBot, delay);
    };

    const spawnBot = () => {
        if (
            match.status !== "WAITING" ||
            match.players.length >= match.maxPlayers ||
            match.countdown <= STOP_AT_SECONDS
        ) {
            match.botInterval = null;
            return;
        }

        const availableNames = BOT_NAMES.filter(n => !match.usedBotNames.has(n));
        const botName = availableNames.length > 0
            ? randFrom(availableNames)
            : `BOT_${generatedname()}`;
        match.usedBotNames.add(botName);

        const bot = {
            username: botName,
            avatarid: randFrom(BOT_SPAWN_AVATARS),
            isBot: true
        };

        match.players.push(bot);
        match.playersocket.push(`BOT_SOCKET_${generatedname()}`);
        match.ai++;

        dlog(`Bot ${bot.username} joined room ${match.roomName} (total: ${match.players.length}/${match.maxPlayers})`);

        match.serversocket.emit("waitingroomupdate", {
            roomName: match.roomName,
            players: match.players,
            playerSocket: match.playersocket,
            maxPlayers: match.maxPlayers,
            status: match.status,
            countdown: match.countdown
        });

        if (match.players.length < match.maxPlayers) {
            scheduleNext();
        } else {
            match.botInterval = null;
        }
    };

    scheduleNext();
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
    dlog(`Reconnect request from: ${username} (${socketid})`);

    const match = matches.find(m => m.players.some(player => player.username == username));

    if (match){
      const index = match.players.findIndex(player => player.username == username);

      if (index !== -1){
        const oldSocket = match.playersocket[index];
        match.playersocket[index] = socketid;

        dlog(`✅ Player ${username} reconnected: oldSocket=${oldSocket}, newSocket=${socketid}`);

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
        dlog(`⚠️ No active match found for ${username}`);
        socket.emit("reconnectfail", { socketid });
      }
    }
    else{
      dlog(`⚠️ No active match found for ${username}`);
      socket.emit("reconnectfail", { socketid });
    }
  })
}

const removereconnect = async (io, socket) => {
  socket.on("removereconnect", async (data) => {
    const { username, socketid } = data;

    const match = matches.find(m => m.players.some(player => player.username == username));

    if (match == null){
      
      dlog(`🗑️ Removed player because match is null: ${username}, socket: ${socketid}`);

      socket.emit("doneremovereconnect", { socketid });

      io.emit("gameremoveplayer", username)

      return;
    }

    const index = match.players.findIndex(player => player.username == username);

    if (index === -1) {
      dlog(`🗑️ No remove reconnect`);
      return;
    }
    
    const removedPlayer = match.players.splice(index, 1)[0];
    const removedSocket = match.playersocket.splice(index, 1)[0];

    dlog(`🗑️ Removed player: ${removedPlayer.username}, socket: ${removedSocket}`);

    socket.emit("doneremovereconnect", { socketid });

    io.emit("gameremoveplayer", username)
  })
}

const serverremovereconnectplayer = async (io, socket) => {
  socket.on("serverremovereconnect", async (data) => {
    try {
      const matchdata = typeof data === "string" ? JSON.parse(data) : data;
      const username = matchdata.username?.trim();

      dlog("remove reconnect raw data:", data);
      dlog("parsed username:", username);

      if (!username) {
        dlog("🗑️ No remove reconnect because username is missing");
        return;
      }

      const match = matches.find(m => Array.isArray(m.players) && m.players.some(player => player.username == username));

      if (!match) {
        dlog(`🗑️ No remove reconnect because no match found for ${username}`);
        return;
      }

      dlog("match found:", {
        roomName: match.roomName,
        players: match.players,
        playersocket: match.playersocket
      });

      const index = match.players.findIndex(player => player.username == username);

      if (index === -1) {
        dlog(`🗑️ No remove reconnect because username not found in players`);
        return;
      }

      const removedPlayer = match.players.splice(index, 1)[0];

      let removedSocket = null;
      if (Array.isArray(match.playersocket) && match.playersocket.length > index) {
        removedSocket = match.playersocket.splice(index, 1)[0];
      }

      dlog(`🗑️ Server removed player: ${removedPlayer.username}`);
      dlog(`🗑️ Removed socket: ${removedSocket}`);
      dlog("updated match:", {
        roomName: match.roomName,
        players: match.players,
        playersocket: match.playersocket
      });
    } catch (error) {
      dlog("🗑️ Error in serverremovereconnect:", error);
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
      dlog(`🗑️ No room found to be done`);
      return;
    }

    const removedRoom = matches.splice(index, 1)[0];

    dlog(`🗑️ Server removed room: ${removedRoom.roomName}`);
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
        dlog(`Match "${matchname}" status changed to "${matchstatus}"`);

        if (matchstatus === "WAITING") {
            notifyplayersformatchstatus(match, io);
        }
    });
}

const notifyplayersformatchstatus = (match, io) => {
    dlog(`SENDING MATCH STATUS ${match.status}`)
    match.serversocket.emit("matchstatuschanged", match);
}

const cancelfindmatch = async (io, socket) => {
    socket.on("cancelfindmatch", (data) => {
        try {
            const username = data?.username;
            const socketid = data?.socketid;

            dlog(`Cancel find match: username=${username} socketid=${socketid}`);

            // 1) Drop from the pending matchmaking queue (the common case —
            //    player cancels while still queued, before any room exists).
            const qIndex = matchQueue.findIndex(
                q => (socketid && q.socketid === socketid) || q.username === username
            );
            if (qIndex !== -1) {
                matchQueue.splice(qIndex, 1);
                dlog(`Removed ${username} from matchQueue (cancel find)`);
            }

            // 2) Race window: processMatchQueue() runs on a 5s timer and may
            //    have already placed this player into a WAITING room before the
            //    cancel arrived. Pull them out so the room stops emitting
            //    enteringmatch/waitingroomupdate to a player who left.
            for (let i = matches.length - 1; i >= 0; i--) {
                const match = matches[i];
                if (match.status !== "WAITING") continue;

                let removed = false;
                const sIndex = socketid ? match.playersocket.indexOf(socketid) : -1;
                if (sIndex !== -1) {
                    match.players.splice(sIndex, 1);
                    match.playersocket.splice(sIndex, 1);
                    removed = true;
                } else if (username) {
                    const pIndex = match.players.findIndex(p => !p.isBot && p.username === username);
                    if (pIndex !== -1) {
                        match.players.splice(pIndex, 1);
                        match.playersocket.splice(pIndex, 1);
                        removed = true;
                    }
                }
                if (!removed) continue;

                dlog(`Removed ${username} from waiting room ${match.roomName} (cancel find)`);

                const realPlayersLeft = match.players.filter(p => !p.isBot);
                if (realPlayersLeft.length === 0) {
                    if (match.interval) { clearInterval(match.interval); match.interval = null; }
                    if (match.botInterval) { clearTimeout(match.botInterval); match.botInterval = null; }
                    matches.splice(i, 1);
                    if (activeMatches?.[match.roomName]) delete activeMatches[match.roomName];
                    dlog(`🗑️ Room ${match.roomName} removed (empty after cancel find)`);
                } else {
                    socket.emit("waitingroomupdate", {
                        roomName: match.roomName,
                        players: match.players,
                        playerSocket: match.playersocket,
                        maxPlayers: match.maxPlayers,
                        status: match.status,
                        countdown: match.countdown
                    });
                }
                break; // a player can only be in one room
            }
        } catch (err) {
            console.error("❌ cancelfindmatch error:", err);
        }
    });
}

//  #endregion

module.exports = {
    findmatchreceive,
    changematchstate,
    notifyplayersformatchstatus,
    needtoreconnect,
    removereconnect,
    serverremovereconnectplayer,
    doneroom,
    cancelfindmatch
}