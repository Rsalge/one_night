const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { NIGHT_ORDER, INTERACTIVE_ROLES, WOLF_WAKE_ROLES, ALL_WOLF_ROLES, autoResolveRole, processNightAction, getNextNightTurn } = require('./gameLogic');

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const gameStore = require('./src/server/gameStore');

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            // Be sure to pass `true` as the second argument to `url.parse`.
            // This tells it to parse the query portion of the URL.
            const parsedUrl = parse(req.url, true);
            const { pathname, query } = parsedUrl;

            if (pathname === '/a') {
                await app.render(req, res, '/a', query);
            } else if (pathname === '/b') {
                await app.render(req, res, '/b', query);
            } else {
                await handle(req, res, parsedUrl);
            }
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(server);

    function generateRoomCode() {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('create_game', async ({ name }) => {
            try {
                const roomCode = generateRoomCode();
                const newGame = await gameStore.createGame(roomCode, name, socket.id);

                socket.join(roomCode);

                socket.emit('game_created', { roomCode, players: newGame.players, selectedRoles: newGame.selectedRoles });
                io.to(roomCode).emit('update_players', newGame.players.filter(p => !p.disconnected));
                console.log(`Game created: ${roomCode} by ${name}`);
            } catch (err) {
                console.error("Create game error:", err);
                socket.emit('error', { message: 'Failed to create game' });
            }
        });

        socket.on('join_game', async ({ name, roomCode }) => {
            try {
                const room = roomCode?.toUpperCase();
                const game = await gameStore.joinGame(room, name, socket.id);

                socket.join(room);

                io.to(room).emit('update_players', game.players.filter(p => !p.disconnected));
                // Emit success to joiner so they know to switch view
                socket.emit('joined_room', { roomCode: room, players: game.players.filter(p => !p.disconnected), selectedRoles: game.selectedRoles });
                console.log(`Player ${name} joined ${room}`);
            } catch (err) {
                console.error("Join game error:", err);
                socket.emit('error', { message: err.message || 'Failed to join game' });
            }
        });

        // Client sends sessionId after creating/joining so we can track reconnects
        socket.on('set_session', async ({ sessionId, roomCode }) => {
            try {
                await gameStore.setSession(socket.id, sessionId, roomCode);
            } catch (err) {
                console.error("Set session error:", err);
            }
        });

        // Reconnect after page refresh
        socket.on('rejoin_game', async ({ sessionId, roomCode, playerName }) => {
            try {
                const room = roomCode?.toUpperCase();

                const { player, game } = await gameStore.rejoinGame(sessionId, socket.id);

                // Setup disconnect timer grace period clear here. 
                // We'll manage a much simpler in-memory timeout map just for this server instance
                // since standard WebSockets are tied to the local instance anyway.
                if (global.disconnectTimers && global.disconnectTimers[sessionId]) {
                    clearTimeout(global.disconnectTimers[sessionId]);
                    delete global.disconnectTimers[sessionId];
                }

                socket.join(room);
                console.log(`Player ${player.name} rejoined ${room} (${socket.id})`);

                // Send appropriate state based on game phase
                if (game.state === 'LOBBY') {
                    socket.emit('joined_room', {
                        roomCode: room,
                        players: game.players.filter(p => !p.disconnected),
                        selectedRoles: game.selectedRoles
                    });
                    io.to(room).emit('update_players', game.players.filter(p => !p.disconnected));
                } else if (game.state === 'NIGHT' || game.state === 'DAY') {
                    socket.emit('game_started', {
                        role: player.originalRole,
                        players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name })),
                        centerCardsCount: game.centerRoles.length,
                        roomCode: room
                    });

                    if (game.state === 'DAY') {
                        socket.emit('phase_change', {
                            phase: 'DAY',
                            players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name }))
                        });
                    }
                }
            } catch (err) {
                console.error("Rejoin error:", err);
                socket.emit('error', { message: 'Session not found or room ended.' });
            }
        });

        if (!global.disconnectTimers) global.disconnectTimers = {};

        socket.on('disconnect', async () => {
            console.log('Client disconnected:', socket.id);

            try {
                // Find what player/game this socket belongs to
                const playerRecord = await gameStore.updatePlayerDisconnectStatus(socket.id, true);
                if (!playerRecord) return; // Unregistered socket

                const player = playerRecord;
                const game = playerRecord.game;
                const code = game.roomCode;

                if (player.sessionId) {
                    console.log(`Player ${player.name} disconnected from ${code}, waiting for reconnect...`);

                    global.disconnectTimers[player.sessionId] = setTimeout(async () => {
                        try {
                            // Check if they are still disconnected before removing
                            const currentStatus = await gameStore.updatePlayerDisconnectStatus(socket.id, true);
                            if (currentStatus && currentStatus.disconnected) {
                                const result = await gameStore.removePlayer(socket.id);
                                delete global.disconnectTimers[player.sessionId];

                                if (result && result.deleted) {
                                    console.log(`Game ${code} deleted (empty)`);
                                } else if (result && result.game) {
                                    io.to(code).emit('update_players', result.game.players.filter(p => !p.disconnected));
                                }
                            }
                        } catch (e) { console.error(e); }
                    }, 30000);
                } else {
                    // No session ID, remove immediately
                    const result = await gameStore.removePlayer(socket.id);
                    if (result && result.deleted) {
                        console.log(`Game ${code} deleted (empty)`);
                    } else if (result && result.game) {
                        io.to(code).emit('update_players', result.game.players.filter(p => !p.disconnected));
                    }
                }

            } catch (err) {
                console.error("Disconnect handler error:", err);
            }
        });

        // ── Night Phase ──
        // autoResolveRole, processNightAction, getNextNightTurn, NIGHT_ORDER, INTERACTIVE_ROLES
        // are imported from gameLogic.js

        async function advanceNightPhase(roomCode) {
            try {
                const game = await gameStore.getGame(roomCode);
                if (!game || game.state !== 'NIGHT') return;

                const turn = getNextNightTurn(game);

                if (turn.done) {
                    // All roles done — transition to DAY
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
                    // Lone wolf gets a private flavor
                    if (currentRole === 'Werewolf' && playersWithRole.length === 1) {
                        flavor = 'You are the lone wolf — you may look at one center card.';
                    }

                    // Send full info only to active players
                    activeIds.forEach(pid => {
                        io.to(pid).emit('night_turn', {
                            activeRole: currentRole,
                            activePlayerIds: activeIds,
                            flavor,
                            isInteractive: true
                        });
                    });

                    // Send generic "close your eyes" to everyone else
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

                    // Send full info only to active players
                    activeIds.forEach(pid => {
                        io.to(pid).emit('night_turn', {
                            activeRole: currentRole,
                            activePlayerIds: activeIds,
                            flavor: flavorText[currentRole] || `${currentRole}, wake up.`,
                            isInteractive: false
                        });
                    });

                    // Send generic message to non-active players
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

                    // Wait for all players who received results to acknowledge
                    const ackIds = Object.keys(results);
                    if (ackIds.length > 0) {
                        await gameStore.updateGameState(roomCode, {
                            pendingAcks: ackIds,
                            nightLog: game.nightLog
                        });
                    } else {
                        // No one received results, just advance
                        await gameStore.updateGameState(roomCode, {
                            nightIndex: game.nightIndex + 1,
                            nightLog: game.nightLog
                        });
                        setTimeout(() => advanceNightPhase(roomCode), 1000);
                    }
                    return;
                }
            } catch (e) { console.error("Error advancing night:", e); }
        }

        socket.on('start_game', async ({ roomCode }) => {
            try {
                // Let's get the game from DB first
                const dbGame = await gameStore.getGame(roomCode);
                if (!dbGame) return;

                const player = dbGame.players.find(p => p.id === socket.id);
                if (!player || !player.isHost) return;

                if (dbGame.players.length < 1) return;

                const startedGame = await gameStore.startGame(roomCode, dbGame.selectedRoles);

                // Emit to each player in the room
                startedGame.players.forEach((p) => {
                    io.to(p.id).emit('game_started', {
                        role: p.role,
                        players: startedGame.players.map(pl => ({ id: pl.id, name: pl.name })),
                        centerCardsCount: startedGame.centerRoles.length,
                        roomCode: roomCode
                    });
                });

                // Start the night sequence after a brief delay for card reveal
                setTimeout(() => advanceNightPhase(roomCode), 3000);
            } catch (err) {
                console.error("Error starting game", err);
                socket.emit('error', { message: err.message || "Failed to start" });
            }
        });

        socket.on('night_action', async ({ roomCode, action, targetIds }) => {
            try {
                const game = await gameStore.getGame(roomCode);
                if (!game || game.state !== 'NIGHT') return;

                const player = game.players.find(p => p.id === socket.id);
                if (!player) return;

                // Verify this player's originalRole matches the current night turn
                const currentRole = NIGHT_ORDER[game.nightIndex];
                if (currentRole === 'Werewolf') {
                    if (!WOLF_WAKE_ROLES.includes(player.originalRole)) return;
                } else {
                    if (player.originalRole !== currentRole) return;
                }

                let result = processNightAction(game, player, action, targetIds);

                // Update the player role if processNightAction changed it
                if (player.role !== player.originalRole) {
                    await gameStore.updatePlayerRole(player.id, { role: player.role });
                }

                // Push new mutations like log/shield/revealed to db
                await gameStore.updateGameState(roomCode, {
                    nightLog: game.nightLog,
                    shielded: game.shielded || [],
                    revealed: game.revealed || [],
                    centerRoles: game.centerRoles, // Drunk/Witch mutates this
                    pendingAcks: [player.id]       // Wait for this player to acknowledge
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

                // Record vote
                let votes = game.votes || {};
                votes[socket.id] = voteTarget;

                game = await gameStore.updateGameState(roomCode, { votes });

                console.log(`${player.name} voted for ${voteTarget}`);

                // Notify room of vote count progress
                io.to(roomCode).emit('vote_update', {
                    votedCount: Object.keys(votes).length,
                    totalPlayers: game.players.length
                });

                // Check if all votes are in
                if (Object.keys(votes).length === game.players.length) {
                    // All votes in -- evaluate the game logic exactly as before 

                    // Tally votes
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

                    // Win evaluation logic
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

                    // Build vote breakdown for display
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

                    // End game state in DB
                    game = await gameStore.updateGameState(roomCode, { state: 'RESULTS' });

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

                        return { id: p.id, didWin };
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
                    pendingAcks: []
                });

                // Clear roles for players
                await Promise.all(restartedGame.players.map(p =>
                    gameStore.updatePlayerRole(p.id, { role: null, originalRole: null })
                ));

                // refetch players list
                const finalGame = await gameStore.getGame(roomCode);

                io.to(roomCode).emit('return_to_lobby', {
                    players: finalGame.players,
                    selectedRoles: finalGame.selectedRoles
                });
                console.log(`Game ${roomCode} restarted by host`);
            } catch (e) { console.error("Error restarting", e); }
        });
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
