const { io } = require("socket.io-client");

const createClient = (name) => {
    const socket = io("http://localhost:3000");

    socket.on("connect", () => {
        // console.log(`${name} connected`);
        socket.emit("join_game", { name });
    });

    return socket;
};

const clients = [
    createClient("Player1"),
    createClient("Player2"),
    createClient("Player3")
];

let startedCount = 0;
let hasStarted = false;

const checkDone = () => {
    if (startedCount === 3) {
        console.log("Test Passed: All players received game_started");
        process.exit(0);
    }
};

clients.forEach(s => {
    s.on("game_started", (data) => {
        // console.log(`Game started for client. Role: ${data.role}`);
        startedCount++;
        checkDone();
    });

    s.on("update_players", (players) => {
        if (!hasStarted && players.length === 3) {
            const myPlayer = players.find(p => p.id === s.id);
            if (myPlayer && myPlayer.isHost) {
                console.log(`I am host (${myPlayer.name}), starting game...`);
                s.emit("start_game");
                hasStarted = true;
            }
        }
    });
});

setTimeout(() => {
    console.log("Test Failed: Timeout");
    process.exit(1);
}, 8000);
