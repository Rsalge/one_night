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

// In-memory game state
const games = new Map();

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

    // Store games by room code
    // Key: roomCode, Value: { players: [], state: 'LOBBY', ... }
    const games = new Map();

    function generateRoomCode() {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('create_game', ({ name }) => {
            const roomCode = generateRoomCode();
            const newPlayer = {
                id: socket.id,
                sessionId: null, // will be set by client via set_session
                name: name.substring(0, 15),
                isHost: true,
                role: null,
            };

            const ALL_ROLES = [
                'Werewolf', 'Werewolf', 'Seer', 'Robber', 'Troublemaker',
                'Villager', 'Villager', 'Villager', 'Mason', 'Mason',
                'Minion', 'Drunk', 'Insomniac', 'Hunter', 'Tanner',
                // Daybreak
                'Alpha Wolf', 'Mystic Wolf', 'Dream Wolf',
                'Apprentice Seer', 'Paranormal Investigator',
                'Witch', 'Sentinel', 'Revealer'
            ];

            const newGame = {
                code: roomCode,
                players: [newPlayer],
                state: 'LOBBY',
                selectedRoles: [...ALL_ROLES], // Default: all roles
                disconnectTimers: {},  // sessionId -> timeout
            };

            games.set(roomCode, newGame);
            socket.join(roomCode);

            socket.emit('game_created', { roomCode, players: newGame.players, selectedRoles: newGame.selectedRoles });
            io.to(roomCode).emit('update_players', newGame.players.filter(p => !p.disconnected));
            console.log(`Game created: ${roomCode} by ${name}`);
        });

        socket.on('join_game', ({ name, roomCode }) => {
            const room = roomCode?.toUpperCase();
            const game = games.get(room);

            if (!game) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (game.state !== 'LOBBY') {
                socket.emit('error', { message: 'Game already started' });
                return;
            }

            const newPlayer = {
                id: socket.id,
                sessionId: null,
                name: name.substring(0, 15),
                isHost: false, // Joiners are never host
                role: null,
            };

            game.players.push(newPlayer);
            socket.join(room);

            io.to(room).emit('update_players', game.players.filter(p => !p.disconnected));
            // Emit success to joiner so they know to switch view
            socket.emit('joined_room', { roomCode: room, players: game.players.filter(p => !p.disconnected), selectedRoles: game.selectedRoles });
            console.log(`Player ${name} joined ${room}`);
        });

        // Client sends sessionId after creating/joining so we can track reconnects
        socket.on('set_session', ({ sessionId, roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;
            const player = game.players.find(p => p.id === socket.id);
            if (player) {
                player.sessionId = sessionId;
            }
        });

        // Reconnect after page refresh
        socket.on('rejoin_game', ({ sessionId, roomCode, playerName }) => {
            const room = roomCode?.toUpperCase();
            const game = games.get(room);

            if (!game) {
                socket.emit('error', { message: 'Room not found. Game may have ended.' });
                return;
            }

            const player = game.players.find(p => p.sessionId === sessionId);
            if (!player) {
                socket.emit('error', { message: 'Session not found. Please rejoin.' });
                return;
            }

            // Clear disconnect timer if pending
            if (game.disconnectTimers[sessionId]) {
                clearTimeout(game.disconnectTimers[sessionId]);
                delete game.disconnectTimers[sessionId];
            }

            // Swap socket ID and mark as connected
            const oldId = player.id;
            player.id = socket.id;
            player.disconnected = false;
            socket.join(room);

            console.log(`Player ${player.name} rejoined ${room} (${oldId} -> ${socket.id})`);

            // Send appropriate state based on game phase
            if (game.state === 'LOBBY') {
                socket.emit('joined_room', {
                    roomCode: room,
                    players: game.players.filter(p => !p.disconnected),
                    selectedRoles: game.selectedRoles
                });
                io.to(room).emit('update_players', game.players.filter(p => !p.disconnected));
            } else if (game.state === 'NIGHT') {
                socket.emit('game_started', {
                    role: player.originalRole,
                    players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name })),
                    centerCardsCount: game.centerRoles.length,
                    roomCode: room
                });
            } else if (game.state === 'DAY') {
                socket.emit('game_started', {
                    role: player.originalRole,
                    players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name })),
                    centerCardsCount: game.centerRoles.length,
                    roomCode: room
                });
                socket.emit('phase_change', {
                    phase: 'DAY',
                    players: game.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name }))
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);

            for (const [code, game] of games.entries()) {
                const player = game.players.find(p => p.id === socket.id);
                if (player) {
                    // If player has a sessionId, give them a grace period to reconnect
                    if (player.sessionId) {
                        player.disconnected = true;
                        console.log(`Player ${player.name} disconnected from ${code}, waiting for reconnect...`);

                        game.disconnectTimers[player.sessionId] = setTimeout(() => {
                            // Grace period expired, remove player
                            const idx = game.players.findIndex(p => p.sessionId === player.sessionId);
                            if (idx !== -1 && game.players[idx].disconnected) {
                                const wasHost = game.players[idx].isHost;
                                game.players.splice(idx, 1);
                                delete game.disconnectTimers[player.sessionId];

                                if (game.players.length === 0) {
                                    games.delete(code);
                                    console.log(`Game ${code} deleted (empty)`);
                                } else {
                                    if (wasHost) {
                                        const connected = game.players.find(p => !p.disconnected);
                                        if (connected) connected.isHost = true;
                                    }
                                    io.to(code).emit('update_players', game.players.filter(p => !p.disconnected));
                                }
                            }
                        }, 30000); // 30 second grace period
                    } else {
                        // No session, remove immediately (old behavior)
                        const playerIndex = game.players.indexOf(player);
                        const wasHost = player.isHost;
                        game.players.splice(playerIndex, 1);

                        if (game.players.length === 0) {
                            games.delete(code);
                            console.log(`Game ${code} deleted (empty)`);
                        } else {
                            if (wasHost) {
                                game.players[0].isHost = true;
                            }
                            io.to(code).emit('update_players', game.players.filter(p => !p.disconnected));
                        }
                    }
                    break;
                }
            }
        });

        // ── Night Phase ──
        // autoResolveRole, processNightAction, getNextNightTurn, NIGHT_ORDER, INTERACTIVE_ROLES
        // are imported from gameLogic.js

        function advanceNightPhase(roomCode) {
            const game = games.get(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            const turn = getNextNightTurn(game);

            if (turn.done) {
                // All roles done — transition to DAY
                game.state = 'DAY';
                game.votes = {};
                io.to(roomCode).emit('phase_change', {
                    phase: 'DAY',
                    players: game.players.map(p => ({ id: p.id, name: p.name }))
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
                    game.pendingAcks = new Set(ackIds);
                } else {
                    // No one received results (shouldn't happen), just advance
                    game.nightIndex++;
                    setTimeout(() => advanceNightPhase(roomCode), 1000);
                }
                return;
            }
        }

        socket.on('start_game', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            if (game.players.length < 1) return;

            const rolesToUse = [...game.selectedRoles];
            // Ensure we have exactly players + 3 roles
            const needed = game.players.length + 3;
            if (rolesToUse.length < needed) {
                socket.emit('error', { message: `Need ${needed} roles but only ${rolesToUse.length} selected.` });
                return;
            }
            const shuffled = rolesToUse.slice(0, needed).sort(() => Math.random() - 0.5);

            game.players.forEach((p, i) => {
                p.role = shuffled[i];
                p.originalRole = shuffled[i];
            });

            game.centerRoles = shuffled.slice(game.players.length);

            game.state = 'NIGHT';
            game.nightIndex = 0;
            game.nightLog = [];
            game.shielded = [];
            game.revealed = [];

            // Emit to each player in the room
            game.players.forEach((p) => {
                io.to(p.id).emit('game_started', {
                    role: p.role,
                    players: game.players.map(pl => ({ id: pl.id, name: pl.name })),
                    centerCardsCount: game.centerRoles.length,
                    roomCode: roomCode
                });
            });

            // Start the night sequence after a brief delay for card reveal
            setTimeout(() => advanceNightPhase(roomCode), 3000);
        });

        socket.on('night_action', ({ roomCode, action, targetIds }) => {
            const game = games.get(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            // Verify this player's originalRole matches the current night turn
            const currentRole = NIGHT_ORDER[game.nightIndex];
            // During the 'Werewolf' group phase, any awake wolf variant can act
            if (currentRole === 'Werewolf') {
                if (!WOLF_WAKE_ROLES.includes(player.originalRole)) return;
            } else {
                if (player.originalRole !== currentRole) return;
            }

            let result = processNightAction(game, player, action, targetIds);

            socket.emit('action_result', result);

            // Wait for this player to acknowledge before advancing
            game.pendingAcks = new Set([player.id]);
        });

        socket.on('acknowledge_night', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            if (game.pendingAcks) {
                game.pendingAcks.delete(socket.id);
                if (game.pendingAcks.size === 0) {
                    game.pendingAcks = null;
                    game.nightIndex++;
                    advanceNightPhase(roomCode);
                }
            }
        });

        socket.on('cast_vote', ({ roomCode, voteTarget }) => {
            const game = games.get(roomCode);
            if (!game || game.state !== 'DAY') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            // Record vote (voteTarget is a player id or 'middle')
            if (!game.votes) game.votes = {};
            game.votes[socket.id] = voteTarget;

            console.log(`${player.name} voted for ${voteTarget}`);

            // Notify room of vote count progress
            io.to(roomCode).emit('vote_update', {
                votedCount: Object.keys(game.votes).length,
                totalPlayers: game.players.length
            });

            // Check if all votes are in
            if (Object.keys(game.votes).length === game.players.length) {
                // Tally votes
                const tally = {};
                for (const target of Object.values(game.votes)) {
                    tally[target] = (tally[target] || 0) + 1;
                }

                // Find max vote count
                const maxVotes = Math.max(...Object.values(tally));

                // Find all targets tied at max
                const topTargets = Object.keys(tally).filter(t => tally[t] === maxVotes);

                // Determine who dies
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
                                role: p.role // Current (possibly swapped) role
                            });
                        }
                    }
                }

                // Determine winners
                // Werewolf team: Werewolf(s), Minion
                // Village team: everyone else
                // Wolf team includes all wolf variants + Minion
                const wolfTeamRoles = [...ALL_WOLF_ROLES, 'Minion'];

                // Check if any wolf (by current role) was eliminated
                const werewolfKilled = eliminated.some(e => ALL_WOLF_ROLES.includes(e.role));

                // Check if any wolf exists among players (by current role)
                const werewolvesInPlay = game.players.filter(p => ALL_WOLF_ROLES.includes(p.role));
                const minionInPlay = game.players.filter(p => p.role === 'Minion');

                // Tanner special case: if Tanner dies, Tanner wins
                const tannerKilled = eliminated.some(e => e.role === 'Tanner');

                let winners = [];
                let winReason = '';

                if (tannerKilled) {
                    // Tanner wins! (Tanner is a solo win)
                    const tannerPlayer = eliminated.find(e => e.role === 'Tanner');
                    winners = ['Tanner'];
                    winReason = `${tannerPlayer.name} was the Tanner and wanted to die. Tanner wins!`;
                }

                if (werewolvesInPlay.length === 0 && minionInPlay.length === 0) {
                    // No wolves or minion in play
                    if (middleVoted && eliminated.length === 0) {
                        // Village voted middle and nobody died — village wins!
                        winners = [...winners, 'Village'];
                        winReason = (winReason ? winReason + ' ' : '') + 'No werewolves among players and village voted for the middle. Village wins!';
                    } else if (eliminated.length > 0) {
                        // Village killed someone but there were no wolves — wolves win (well, nobody wins cleanly)
                        // Actually per rules: if no werewolves and someone dies, village loses
                        if (!winners.includes('Tanner')) {
                            winners = [...winners, 'Werewolf'];
                            winReason = (winReason ? winReason + ' ' : '') + 'There were no werewolves, but the village killed someone. Everyone loses!';
                        }
                    } else {
                        // Middle wasn't top vote, and no one died? Shouldn't happen normally with tie logic
                        winners = [...winners, 'Village'];
                        winReason = (winReason ? winReason + ' ' : '') + 'No werewolves in play. Village wins!';
                    }
                } else {
                    // Werewolves exist among players
                    if (werewolfKilled) {
                        if (!winners.includes('Tanner')) {
                            winners = ['Village'];
                            winReason = (winReason ? winReason + ' ' : '') + 'A werewolf was eliminated! Village wins!';
                        } else {
                            winners = [...winners, 'Village'];
                            winReason = (winReason ? winReason + ' ' : '') + 'A werewolf was also eliminated! Village wins too!';
                        }
                    } else {
                        // No werewolf killed
                        // Minion win condition: if minion is killed but no wolf is killed, werewolf team wins
                        if (!winners.includes('Tanner')) {
                            winners = ['Werewolf'];
                            winReason = (winReason ? winReason + ' ' : '') + 'No werewolf was eliminated. Werewolf team wins!';
                        }
                    }
                }

                // Build vote breakdown for display
                const voteBreakdown = {};
                for (const [voterId, target] of Object.entries(game.votes)) {
                    const voter = game.players.find(p => p.id === voterId);
                    const targetName = target === 'middle' ? 'The Middle' :
                        game.players.find(p => p.id === target)?.name || 'Unknown';
                    voteBreakdown[voter?.name || 'Unknown'] = targetName;
                }

                // Reveal all roles
                const roleReveal = game.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    originalRole: p.originalRole,
                    finalRole: p.role
                }));

                game.state = 'RESULTS';

                // Determine per-player win/loss
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
        });

        socket.on('update_roles', ({ roomCode, selectedRoles }) => {
            const game = games.get(roomCode);
            if (!game || game.state !== 'LOBBY') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            game.selectedRoles = selectedRoles;
            io.to(roomCode).emit('roles_updated', { selectedRoles });
            console.log(`Roles updated for ${roomCode}: ${selectedRoles.length} roles`);
        });

        socket.on('restart_game', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            // Reset game state
            game.state = 'LOBBY';
            game.votes = {};
            game.nightIndex = 0;
            game.centerRoles = [];
            game.players.forEach(p => {
                p.role = null;
                p.originalRole = null;
                p.ready = false;
            });

            io.to(roomCode).emit('return_to_lobby', {
                players: game.players,
                selectedRoles: game.selectedRoles
            });
            console.log(`Game ${roomCode} restarted by host`);
        });
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
