require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { NIGHT_ORDER, INTERACTIVE_ROLES, WOLF_WAKE_ROLES, ALL_WOLF_ROLES, autoResolveRole, processNightAction, getNextNightTurn } = require('./gameLogic');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = express();
const server = createServer(app);

// Configure Socket.IO with CORS for development
const io = new Server(server, {
    cors: dev ? {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    } : undefined
});

const gameStore = require('./src/server/gameStore');
const auth = require('./src/server/auth');
const statsCollector = require('./src/server/statsCollector');
const statsAPI = require('./src/server/statsAPI');

// Track authenticated users by socket
const socketToUser = new Map(); // socketId -> { userId, username }

// Track night phase processing to prevent duplicate emissions (idempotency)
// Maps roomCode -> nightIndex currently being processed
const nightPhaseProcessing = new Map();

// Middleware for JSON parsing
app.use(express.json({ limit: '10mb' }));

// CORS for development
if (dev) {
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        next();
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP auth middleware
function authenticateHTTP(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const payload = auth.verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = payload.userId;
    req.username = payload.username;
    next();
}

// Get user's own stats
app.get('/api/stats', authenticateHTTP, async (req, res) => {
    try {
        const stats = await statsAPI.getPlayerStats(req.userId);
        res.json(stats);
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get any user's stats by ID (public)
app.get('/api/stats/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const stats = await statsAPI.getPlayerStats(userId);
        res.json(stats);
    } catch (err) {
        console.error('Stats error:', err);
        res.status(404).json({ error: 'User not found' });
    }
});

// Upload user avatar
app.post('/api/user/avatar', authenticateHTTP, async (req, res) => {
    try {
        const { avatarUrl } = req.body;
        // Basic validation - check if it looks like a base64 Data URL or an empty string to clear
        if (avatarUrl && !avatarUrl.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        await require('./src/lib/db').user.update({
            where: { id: req.userId },
            data: { avatarUrl: avatarUrl || null }
        });

        res.json({ success: true, avatarUrl });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// Serve the static frontend in production
if (!dev) {
    app.use(express.static(path.join(__dirname, 'client/dist')));
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
    });
}
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Advances the night phase for a game room.
 * Determines the next role to act, emits events, and handles auto-resolution.
 * 
 * IMPORTANT: This function is at module scope (not per-socket) to prevent
 * duplicate event emissions when multiple sockets trigger it simultaneously.
 * Idempotency is enforced via nightPhaseProcessing map.
 */
async function advanceNightPhase(roomCode) {
    try {
        const game = await gameStore.getGame(roomCode);
        if (!game || game.state !== 'NIGHT') return;

        // Idempotency check: prevent duplicate processing of same nightIndex
        const processingKey = `${roomCode}:${game.nightIndex}`;
        if (nightPhaseProcessing.has(processingKey)) {
            return; // Already processing this night index for this room
        }
        nightPhaseProcessing.set(processingKey, Date.now());

        // Clean up old processing entries for this room (from previous night indices)
        for (const key of nightPhaseProcessing.keys()) {
            if (key.startsWith(`${roomCode}:`) && key !== processingKey) {
                nightPhaseProcessing.delete(key);
            }
        }

        const turn = getNextNightTurn(game);

        if (turn.done) {
            // Clear processing state for this room when transitioning to DAY
            nightPhaseProcessing.delete(processingKey);
            
            await gameStore.updateGameState(roomCode, {
                state: 'DAY',
                votes: {}
            });
            const updatedGame = await gameStore.getGame(roomCode);

            io.to(roomCode).emit('phase_change', {
                phase: 'DAY',
                players: updatedGame.players.map(p => ({ id: p.id, name: p.name }))
            });
            console.log(`Game ${roomCode} switching to DAY`);
            return;
        }

        const { role: currentRole, players: playersWithRole, isInteractive } = turn;

        const flavorText = {
            'Sentinel': 'Sentinel, wake up. You may place a shield on another player\'s card.',
            'Werewolf': 'Werewolves, wake up and look for other werewolves.',
            'Alpha Wolf': 'Alpha Wolf, wake up. Choose a non-wolf player to turn into a Werewolf.',
            'Mystic Wolf': 'Mystic Wolf, wake up. You may look at another player\'s card.',
            'Minion': 'Minion, wake up. Werewolves, stick out your thumb.',
            'Mason': 'Masons, wake up and look for other masons.',
            'Seer': 'Seer, wake up. You may look at another player\'s card or two center cards.',
            'Apprentice Seer': 'Apprentice Seer, wake up. You may look at one center card.',
            'Paranormal Investigator': 'P.I., wake up. You may look at up to two players\' cards.',
            'Robber': 'Robber, wake up. You may exchange your card with another player\'s card.',
            'Witch': 'Witch, wake up. Look at a center card. You may swap it with any player\'s card.',
            'Troublemaker': 'Troublemaker, wake up. You may exchange cards between two other players.',
            'Drunk': 'Drunk, wake up and exchange your card with a card from the center.',
            'Insomniac': 'Insomniac, wake up and look at your card.',
            'Revealer': 'Revealer, wake up. You may flip another player\'s card face up.'
        };

        console.log(`Night turn: ${currentRole} (interactive: ${isInteractive})`);

        if (isInteractive) {
            const activeIds = playersWithRole.map(p => p.id);
            let flavor = flavorText[currentRole] || `${currentRole}, wake up.`;
            if (currentRole === 'Werewolf' && playersWithRole.length === 1) {
                flavor = 'You are the lone wolf — you may look at one center card.';
            }

            activeIds.forEach(pid => {
                io.to(pid).emit('night_turn', {
                    activeRole: currentRole,
                    activePlayerIds: activeIds,
                    flavor,
                    isInteractive: true
                });
            });

            game.players.forEach(p => {
                if (!activeIds.includes(p.id)) {
                    io.to(p.id).emit('night_turn', {
                        activeRole: null,
                        activePlayerIds: [],
                        flavor: 'Close your eyes...',
                        isInteractive: false
                    });
                }
            });
            return;
        } else {
            const results = autoResolveRole(game, currentRole);
            const activeIds = playersWithRole.map(p => p.id);

            activeIds.forEach(pid => {
                io.to(pid).emit('night_turn', {
                    activeRole: currentRole,
                    activePlayerIds: activeIds,
                    flavor: flavorText[currentRole] || `${currentRole}, wake up.`,
                    isInteractive: false
                });
            });

            game.players.forEach(p => {
                if (!activeIds.includes(p.id)) {
                    io.to(p.id).emit('night_turn', {
                        activeRole: null,
                        activePlayerIds: [],
                        flavor: 'Close your eyes...',
                        isInteractive: false
                    });
                }
            });

            for (const [playerId, result] of Object.entries(results)) {
                io.to(playerId).emit('action_result', result);
            }

            const ackIds = Object.keys(results);
            if (ackIds.length > 0) {
                await gameStore.updateGameState(roomCode, {
                    pendingAcks: ackIds,
                    nightLog: game.nightLog
                });
            } else {
                await gameStore.updateGameState(roomCode, {
                    nightIndex: game.nightIndex + 1,
                    nightLog: game.nightLog
                });
                setTimeout(() => advanceNightPhase(roomCode), 1000);
            }
            return;
        }
    } catch (e) {
        console.error("Error advancing night:", e);
        // Clean up processing state on error to allow retry
        for (const key of nightPhaseProcessing.keys()) {
            if (key.startsWith(`${roomCode}:`)) {
                nightPhaseProcessing.delete(key);
            }
        }
    }
}

// Auth namespace for unauthenticated connections (login/register)
const authNamespace = io.of('/auth');

authNamespace.on('connection', (socket) => {
    console.log('Auth connection:', socket.id);

    socket.on('register', async ({ username, password }, callback) => {
        try {
            const result = await auth.register(username, password);
            callback({ success: true, ...result });
        } catch (err) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('login', async ({ username, password }, callback) => {
        try {
            const result = await auth.login(username, password);
            callback({ success: true, ...result });
        } catch (err) {
            callback({ success: false, error: err.message });
        }
    });
});

// Main namespace with authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    const payload = auth.verifyToken(token);
    if (!payload) {
        return next(new Error('Invalid token'));
    }

    // Store user info on socket
    socket.userId = payload.userId;
    socket.username = payload.username;
    socketToUser.set(socket.id, { userId: payload.userId, username: payload.username });

    next();
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, '- User:', socket.username);

    socket.on('create_game', async () => {
        const { userId, username } = socketToUser.get(socket.id);
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const roomCode = generateRoomCode();
                const newGame = await gameStore.createGame(roomCode, userId, username, socket.id);

                socket.join(roomCode);

                socket.emit('game_created', { roomCode, players: newGame.players, selectedRoles: newGame.selectedRoles });
                io.to(roomCode).emit('update_players', newGame.players.filter(p => !p.disconnected));
                console.log(`Game created: ${roomCode} by ${username}`);
                return;
            } catch (err) {
                if (err.code === 'P2002' && attempt < maxAttempts - 1) {
                    console.log(`Room code collision, retrying (attempt ${attempt + 1}/${maxAttempts})`);
                    continue;
                }
                console.error("Create game error:", err);
                socket.emit('error', { message: 'Failed to create game' });
                return;
            }
        }
    });

    socket.on('join_game', async ({ roomCode }) => {
        const { userId, username } = socketToUser.get(socket.id);
        try {
            const room = roomCode?.toUpperCase();
            const game = await gameStore.joinGame(room, userId, username, socket.id);

            socket.join(room);

            io.to(room).emit('update_players', game.players.filter(p => !p.disconnected));
            socket.emit('joined_room', { roomCode: room, players: game.players.filter(p => !p.disconnected), selectedRoles: game.selectedRoles });
            console.log(`Player ${username} joined ${room}`);
        } catch (err) {
            console.error("Join game error:", err);
            socket.emit('error', { message: err.message || 'Failed to join game' });
        }
    });

    socket.on('reconnect_to_game', async () => {
        const { userId, username } = socketToUser.get(socket.id);
        try {
            const { player, game } = await gameStore.rejoinGameByUserId(userId, socket.id);

            socket.join(game.roomCode);
            console.log(`Player ${username} reconnected to ${game.roomCode}`);

            // Send appropriate state based on game phase
            if (game.state === 'LOBBY') {
                socket.emit('rejoined_game', {
                    roomCode: game.roomCode,
                    players: game.players.filter(p => !p.disconnected),
                    selectedRoles: game.selectedRoles,
                    state: 'LOBBY',
                    isHost: player.isHost
                });
            } else {
                socket.emit('rejoined_game', {
                    roomCode: game.roomCode,
                    players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name })),
                    selectedRoles: game.selectedRoles,
                    state: game.state,
                    myRole: player.originalRole,
                    centerCardsCount: game.centerRoles?.length || 0,
                    isHost: player.isHost
                });
            }

            io.to(game.roomCode).emit('update_players', game.players.filter(p => !p.disconnected));
        } catch (err) {
            console.error('Reconnect error:', err);
            socket.emit('no_active_game');
        }
    });

    if (!global.disconnectTimers) global.disconnectTimers = {};

    socket.on('disconnect', async () => {
        const userInfo = socketToUser.get(socket.id);
        console.log('Client disconnected:', socket.id, userInfo ? `- User: ${userInfo.username}` : '');
        socketToUser.delete(socket.id);

        try {
            const playerRecord = await gameStore.updatePlayerDisconnectStatus(socket.id, true);
            if (!playerRecord) return;

            const player = playerRecord;
            const game = playerRecord.game;
            const code = game.roomCode;

            // Use userId for reconnect timer if available
            const timerId = player.userId ? `user_${player.userId}` : socket.id;
            console.log(`Player ${player.name} disconnected from ${code}, waiting for reconnect...`);

            global.disconnectTimers[timerId] = setTimeout(async () => {
                try {
                    const currentStatus = await gameStore.getPlayerBySocketId(socket.id);
                    if (currentStatus && currentStatus.disconnected) {
                        const result = await gameStore.removePlayer(socket.id);
                        delete global.disconnectTimers[timerId];

                        if (result && result.deleted) {
                            // Clean up night phase processing state for deleted game
                            for (const key of nightPhaseProcessing.keys()) {
                                if (key.startsWith(`${code}:`)) {
                                    nightPhaseProcessing.delete(key);
                                }
                            }
                            console.log(`Game ${code} deleted (empty)`);
                        } else if (result && result.game) {
                            io.to(code).emit('update_players', result.game.players.filter(p => !p.disconnected));
                        }
                    }
                } catch (e) { console.error(e); }
            }, 60000); // 60 second timeout for reconnect

        } catch (err) {
            console.error("Disconnect handler error:", err);
        }
    });

    socket.on('start_game', async ({ roomCode }) => {
        try {
            const dbGame = await gameStore.getGame(roomCode);
            if (!dbGame) return;

            const player = dbGame.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            if (dbGame.players.length < 1) return;

            const startedGame = await gameStore.startGame(roomCode, dbGame.selectedRoles);

            startedGame.players.forEach((p) => {
                io.to(p.id).emit('game_started', {
                    role: p.role,
                    players: startedGame.players.map(pl => ({ id: pl.id, name: pl.name })),
                    centerCardsCount: startedGame.centerRoles.length,
                    roomCode: roomCode
                });
            });

            setTimeout(() => advanceNightPhase(roomCode), 3000);
        } catch (err) {
            console.error("Error starting game", err);
            socket.emit('error', { message: err.message || "Failed to start" });
        }
    });

    socket.on('night_action', async ({ roomCode, action, targetIds }) => {
        try {
            console.log(`[night_action] roomCode=${roomCode}, action=${action}, targetIds=${JSON.stringify(targetIds)}`);
            
            const game = await gameStore.getGame(roomCode);
            if (!game || game.state !== 'NIGHT') {
                console.log(`[night_action] Invalid game state: game=${!!game}, state=${game?.state}`);
                return;
            }

            const player = game.players.find(p => p.id === socket.id);
            if (!player) {
                console.log(`[night_action] Player not found for socket ${socket.id}`);
                return;
            }

            const currentRole = NIGHT_ORDER[game.nightIndex];
            console.log(`[night_action] player.originalRole=${player.originalRole}, currentRole=${currentRole}, nightIndex=${game.nightIndex}`);
            
            if (currentRole === 'Werewolf') {
                if (!WOLF_WAKE_ROLES.includes(player.originalRole)) {
                    console.log(`[night_action] Player role ${player.originalRole} not in WOLF_WAKE_ROLES`);
                    return;
                }
            } else {
                if (player.originalRole !== currentRole) {
                    console.log(`[night_action] Player role ${player.originalRole} !== currentRole ${currentRole}`);
                    return;
                }
            }

            let result = processNightAction(game, player, action, targetIds);
            console.log(`[night_action] processNightAction result:`, result);

            if (player.role !== player.originalRole) {
                await gameStore.updatePlayerRole(player.id, { role: player.role });
            }

            await gameStore.updateGameState(roomCode, {
                nightLog: game.nightLog,
                shielded: game.shielded || [],
                revealed: game.revealed || [],
                centerRoles: game.centerRoles,
                pendingAcks: [player.id]
            });

            socket.emit('action_result', result);
        } catch (e) { console.error("night_action error", e); }
    });

    socket.on('acknowledge_night', async ({ roomCode }) => {
        try {
            const game = await gameStore.getGame(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            let pendingAcks = game.pendingAcks || [];
            if (pendingAcks.includes(socket.id)) {
                pendingAcks = pendingAcks.filter(id => id !== socket.id);

                if (pendingAcks.length === 0) {
                    await gameStore.updateGameState(roomCode, {
                        pendingAcks: [],
                        nightIndex: game.nightIndex + 1
                    });
                    advanceNightPhase(roomCode);
                } else {
                    await gameStore.updateGameState(roomCode, { pendingAcks });
                }
            }
        } catch (e) { console.error("acknowledge_night error", e); }
    });

    socket.on('cast_vote', async ({ roomCode, voteTarget }) => {
        try {
            let game = await gameStore.getGame(roomCode);
            if (!game || game.state !== 'DAY') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            let votes = game.votes || {};
            votes[socket.id] = voteTarget;

            game = await gameStore.updateGameState(roomCode, { votes });

            console.log(`${player.name} voted for ${voteTarget}`);

            io.to(roomCode).emit('vote_update', {
                votedCount: Object.keys(votes).length,
                totalPlayers: game.players.length
            });

            if (Object.keys(votes).length === game.players.length) {
                const tally = {};
                for (const target of Object.values(votes)) {
                    tally[target] = (tally[target] || 0) + 1;
                }

                const maxVotes = Math.max(...Object.values(tally));
                const topTargets = Object.keys(tally).filter(t => tally[t] === maxVotes);

                const eliminated = [];
                let middleVoted = false;

                for (const target of topTargets) {
                    if (target === 'middle') {
                        middleVoted = true;
                    } else {
                        const p = game.players.find(pl => pl.id === target);
                        if (p) {
                            eliminated.push({
                                id: p.id,
                                name: p.name,
                                role: p.role
                            });
                        }
                    }
                }

                const wolfTeamRoles = [...ALL_WOLF_ROLES, 'Minion'];
                const werewolfKilled = eliminated.some(e => ALL_WOLF_ROLES.includes(e.role));
                const werewolvesInPlay = game.players.filter(p => ALL_WOLF_ROLES.includes(p.role));
                const minionInPlay = game.players.filter(p => p.role === 'Minion');
                const tannerKilled = eliminated.some(e => e.role === 'Tanner');

                let winners = [];
                let winReason = '';

                if (tannerKilled) {
                    const tannerPlayer = eliminated.find(e => e.role === 'Tanner');
                    winners = ['Tanner'];
                    winReason = `${tannerPlayer.name} was the Tanner and wanted to die. Tanner wins!`;
                }

                if (werewolvesInPlay.length === 0 && minionInPlay.length === 0) {
                    if (middleVoted && eliminated.length === 0) {
                        winners = [...winners, 'Village'];
                        winReason = (winReason ? winReason + ' ' : '') + 'No werewolves among players and village voted for the middle. Village wins!';
                    } else if (eliminated.length > 0) {
                        if (!winners.includes('Tanner')) {
                            winners = [...winners, 'Werewolf'];
                            winReason = (winReason ? winReason + ' ' : '') + 'There were no werewolves, but the village killed someone. Everyone loses!';
                        }
                    } else {
                        winners = [...winners, 'Village'];
                        winReason = (winReason ? winReason + ' ' : '') + 'No werewolves in play. Village wins!';
                    }
                } else {
                    if (werewolfKilled) {
                        if (!winners.includes('Tanner')) {
                            winners = ['Village'];
                            winReason = (winReason ? winReason + ' ' : '') + 'A werewolf was eliminated! Village wins!';
                        } else {
                            winners = [...winners, 'Village'];
                            winReason = (winReason ? winReason + ' ' : '') + 'A werewolf was also eliminated! Village wins too!';
                        }
                    } else {
                        if (!winners.includes('Tanner')) {
                            winners = ['Werewolf'];
                            winReason = (winReason ? winReason + ' ' : '') + 'No werewolf was eliminated. Werewolf team wins!';
                        }
                    }
                }

                const voteBreakdown = {};
                for (const [voterId, target] of Object.entries(votes)) {
                    const voter = game.players.find(p => p.id === voterId);
                    const targetName = target === 'middle' ? 'The Middle' :
                        game.players.find(p => p.id === target)?.name || 'Unknown';
                    voteBreakdown[voter?.name || 'Unknown'] = targetName;
                }

                const roleReveal = game.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    originalRole: p.originalRole,
                    finalRole: p.role
                }));

                // Mark game as completed with timestamp
                game = await gameStore.updateGameState(roomCode, {
                    state: 'RESULTS',
                    completedAt: new Date()
                });

                const wolfTeamForWin = [...ALL_WOLF_ROLES, 'Minion'];
                const playerResults = game.players.map(p => {
                    const currentRole = p.role;
                    let didWin = false;

                    if (currentRole === 'Tanner') {
                        didWin = winners.includes('Tanner');
                    } else if (wolfTeamForWin.includes(currentRole)) {
                        didWin = winners.includes('Werewolf');
                    } else {
                        didWin = winners.includes('Village');
                    }

                    return { id: p.id, odid: p.userId, didWin };
                });

                io.to(roomCode).emit('vote_results', {
                    eliminated,
                    winners,
                    winReason,
                    voteBreakdown,
                    roleReveal,
                    centerCards: game.centerRoles,
                    nightLog: game.nightLog || [],
                    playerResults
                });

                console.log(`Game ${roomCode} ended. Winners: ${winners.join(', ')}`);

                // Save stats asynchronously
                const eliminatedIds = eliminated.map(e => e.id);
                statsCollector.saveCompletedGame(game, winners, eliminatedIds)
                    .then(() => console.log(`Stats saved for game ${roomCode}`))
                    .catch(err => console.error('Failed to save stats:', err));
            }
        } catch (e) { console.error("Vote error", e); }
    });

    socket.on('update_roles', async ({ roomCode, selectedRoles }) => {
        try {
            const game = await gameStore.getGame(roomCode);
            if (!game || game.state !== 'LOBBY') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            await gameStore.updateGameState(roomCode, { selectedRoles });
            io.to(roomCode).emit('roles_updated', { selectedRoles });
        } catch (e) { console.error(e); }
    });

    socket.on('restart_game', async ({ roomCode }) => {
        try {
            const game = await gameStore.getGame(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            const restartedGame = await gameStore.updateGameState(roomCode, {
                state: 'LOBBY',
                votes: {},
                nightIndex: 0,
                centerRoles: [],
                nightLog: [],
                shielded: [],
                revealed: [],
                pendingAcks: [],
                startedAt: null,
                completedAt: null
            });

            await Promise.all(restartedGame.players.map(p =>
                gameStore.updatePlayerRole(p.id, { role: null, originalRole: null })
            ));

            const finalGame = await gameStore.getGame(roomCode);

            io.to(roomCode).emit('return_to_lobby', {
                players: finalGame.players,
                selectedRoles: finalGame.selectedRoles
            });
            console.log(`Game ${roomCode} restarted by host`);
        } catch (e) { console.error("Error restarting", e); }
    });

    socket.on('leave_game', async () => {
        try {
            const result = await gameStore.removePlayer(socket.id);
            if (result && result.game) {
                const code = result.game.roomCode;
                socket.leave(code);
                io.to(code).emit('update_players', result.game.players.filter(p => !p.disconnected));
            }
        } catch (e) { console.error("Leave game error", e); }
    });
});

server.listen(port, () => {
    console.log(`> Server running on http://localhost:${port}`);
});
