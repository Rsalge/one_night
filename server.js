const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
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
                name: name.substring(0, 15),
                isHost: true,
                role: null,
            };

            const newGame = {
                code: roomCode,
                players: [newPlayer],
                state: 'LOBBY',
            };

            games.set(roomCode, newGame);
            socket.join(roomCode);

            socket.emit('game_created', { roomCode, players: newGame.players });
            io.to(roomCode).emit('update_players', newGame.players);
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
                name: name.substring(0, 15),
                isHost: false, // Joiners are never host
                role: null,
            };

            game.players.push(newPlayer);
            socket.join(room);

            io.to(room).emit('update_players', game.players);
            // Emit success to joiner so they know to switch view
            socket.emit('joined_room', { roomCode: room, players: game.players });
            console.log(`Player ${name} joined ${room}`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);

            // Find which game the player was in
            for (const [code, game] of games.entries()) {
                const playerIndex = game.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    const wasHost = game.players[playerIndex].isHost;
                    game.players.splice(playerIndex, 1);

                    if (game.players.length === 0) {
                        games.delete(code);
                        console.log(`Game ${code} deleted (empty)`);
                    } else {
                        if (wasHost) {
                            game.players[0].isHost = true;
                        }
                        io.to(code).emit('update_players', game.players);
                    }
                    break; // Player can only be in one game
                }
            }
        });

        // ── Night Phase Order ──
        const NIGHT_ORDER = [
            'Werewolf', 'Minion', 'Mason', 'Seer',
            'Robber', 'Troublemaker', 'Drunk', 'Insomniac'
        ];

        // Roles that require player input (interactive)
        const INTERACTIVE_ROLES = ['Seer', 'Robber', 'Troublemaker', 'Drunk'];

        // Auto-resolve passive roles and return info
        function autoResolveRole(game, role) {
            const results = {};

            if (role === 'Werewolf') {
                const wolves = game.players.filter(p => p.originalRole === 'Werewolf');
                wolves.forEach(w => {
                    const otherWolves = wolves.filter(o => o.id !== w.id).map(o => o.name);
                    if (otherWolves.length > 0) {
                        results[w.id] = { type: 'info', message: `Fellow werewolf: ${otherWolves.join(', ')}` };
                    } else {
                        // Lone wolf — could view center, but we auto-skip for simplicity
                        results[w.id] = { type: 'info', message: 'You are the lone wolf.' };
                    }
                });
            }
            else if (role === 'Minion') {
                const minions = game.players.filter(p => p.originalRole === 'Minion');
                const wolfNames = game.players.filter(p => p.originalRole === 'Werewolf').map(p => p.name);
                minions.forEach(m => {
                    if (wolfNames.length > 0) {
                        results[m.id] = { type: 'info', message: `Werewolves: ${wolfNames.join(', ')}` };
                    } else {
                        results[m.id] = { type: 'info', message: 'No werewolves among players.' };
                    }
                });
            }
            else if (role === 'Mason') {
                const masons = game.players.filter(p => p.originalRole === 'Mason');
                masons.forEach(m => {
                    const otherMasons = masons.filter(o => o.id !== m.id).map(o => o.name);
                    if (otherMasons.length > 0) {
                        results[m.id] = { type: 'info', message: `Fellow mason: ${otherMasons.join(', ')}` };
                    } else {
                        results[m.id] = { type: 'info', message: 'You are the only mason.' };
                    }
                });
            }
            else if (role === 'Insomniac') {
                const insomniacs = game.players.filter(p => p.originalRole === 'Insomniac');
                insomniacs.forEach(ins => {
                    results[ins.id] = { type: 'info', message: `Your card is now: ${ins.role}` };
                });
            }

            return results;
        }

        function advanceNightPhase(roomCode) {
            const game = games.get(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            // Find next role in order that has a player
            while (game.nightIndex < NIGHT_ORDER.length) {
                const currentRole = NIGHT_ORDER[game.nightIndex];
                const playersWithRole = game.players.filter(p => p.originalRole === currentRole);

                if (playersWithRole.length === 0) {
                    game.nightIndex++;
                    continue;
                }

                // Found a role that's in play
                const isInteractive = INTERACTIVE_ROLES.includes(currentRole);

                // Flavor text for narrator feel
                const flavorText = {
                    'Werewolf': 'Werewolves, wake up and look for other werewolves.',
                    'Minion': 'Minion, wake up. Werewolves, stick out your thumb.',
                    'Mason': 'Masons, wake up and look for other masons.',
                    'Seer': 'Seer, wake up. You may look at another player\'s card or two center cards.',
                    'Robber': 'Robber, wake up. You may exchange your card with another player\'s card.',
                    'Troublemaker': 'Troublemaker, wake up. You may exchange cards between two other players.',
                    'Drunk': 'Drunk, wake up and exchange your card with a card from the center.',
                    'Insomniac': 'Insomniac, wake up and look at your card.'
                };

                console.log(`Night turn: ${currentRole} (interactive: ${isInteractive})`);

                if (isInteractive) {
                    // Wait for player input
                    io.to(roomCode).emit('night_turn', {
                        activeRole: currentRole,
                        activePlayerIds: playersWithRole.map(p => p.id),
                        flavor: flavorText[currentRole] || `${currentRole}, wake up.`,
                        isInteractive: true
                    });
                    return; // Wait for night_action from the active player
                } else {
                    // Auto-resolve and show briefly, then advance
                    const results = autoResolveRole(game, currentRole);

                    io.to(roomCode).emit('night_turn', {
                        activeRole: currentRole,
                        activePlayerIds: playersWithRole.map(p => p.id),
                        flavor: flavorText[currentRole] || `${currentRole}, wake up.`,
                        isInteractive: false
                    });

                    // Send results to each affected player
                    for (const [playerId, result] of Object.entries(results)) {
                        io.to(playerId).emit('action_result', result);
                    }

                    game.nightIndex++;

                    // Wait 4 seconds before advancing to next role
                    setTimeout(() => advanceNightPhase(roomCode), 4000);
                    return;
                }
            }

            // All roles done — transition to DAY
            game.state = 'DAY';
            game.votes = {};
            io.to(roomCode).emit('phase_change', {
                phase: 'DAY',
                players: game.players.map(p => ({ id: p.id, name: p.name }))
            });
            console.log(`Game ${roomCode} switching to DAY`);
        }

        socket.on('start_game', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            if (game.players.length < 1) return;

            const availableRoles = [
                'Werewolf', 'Werewolf', 'Seer', 'Robber', 'Troublemaker',
                'Villager', 'Villager', 'Villager', 'Mason', 'Mason',
                'Minion', 'Drunk', 'Insomniac', 'Hunter', 'Tanner'
            ];

            let rolesToUse = availableRoles.slice(0, game.players.length + 3);
            rolesToUse = rolesToUse.sort(() => Math.random() - 0.5);

            game.players.forEach((p, i) => {
                p.role = rolesToUse[i];
                p.originalRole = rolesToUse[i]; // Track original role for night logic
            });

            game.centerRoles = rolesToUse.slice(game.players.length);
            game.state = 'NIGHT';
            game.nightIndex = 0;

            // Emit to each player in the room
            game.players.forEach((p) => {
                io.to(p.id).emit('game_started', {
                    role: p.role,
                    players: game.players.map(pl => ({ id: pl.id, name: pl.name })),
                    centerCardsCount: 3,
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
            if (player.originalRole !== currentRole) return;

            console.log(`Action from ${player.name} (${player.originalRole}): ${action}`, targetIds);

            let result = null;

            if (player.originalRole === 'Seer') {
                if (targetIds.length === 1 && typeof targetIds[0] === 'string') {
                    const target = game.players.find(p => p.id === targetIds[0]);
                    if (target) result = { type: 'view', role: target.role, name: target.name };
                } else if (targetIds.length === 2 && targetIds.every(id => typeof id === 'number')) {
                    const cards = targetIds.map(idx => game.centerRoles[idx]);
                    result = { type: 'view_center', cards };
                }
            }
            else if (player.originalRole === 'Robber') {
                const target = game.players.find(p => p.id === targetIds[0]);
                if (target) {
                    const myRole = player.role;
                    player.role = target.role;
                    target.role = myRole;
                    result = { type: 'swap_view', newRole: player.role, name: target.name };
                }
            }
            else if (player.originalRole === 'Troublemaker') {
                const p1 = game.players.find(p => p.id === targetIds[0]);
                const p2 = game.players.find(p => p.id === targetIds[1]);
                if (p1 && p2) {
                    const temp = p1.role;
                    p1.role = p2.role;
                    p2.role = temp;
                    result = { type: 'swap', message: `Swapped ${p1.name} and ${p2.name}.` };
                }
            }
            else if (player.originalRole === 'Drunk') {
                const centerIdx = targetIds[0];
                if (typeof centerIdx === 'number' && centerIdx >= 0 && centerIdx < 3) {
                    const myRole = player.role;
                    player.role = game.centerRoles[centerIdx];
                    game.centerRoles[centerIdx] = myRole;
                    result = { type: 'swap_center', message: 'You swapped with a center card.' };
                }
            }

            socket.emit('action_result', result);

            // Advance to next role after a brief pause
            game.nightIndex++;
            setTimeout(() => advanceNightPhase(roomCode), 2000);
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
                const werewolfRoles = ['Werewolf', 'Minion'];

                // Check if any werewolf (by current role) was eliminated
                const werewolfKilled = eliminated.some(e => e.role === 'Werewolf');

                // Check if any werewolf exists among players (by current role)
                const werewolvesInPlay = game.players.filter(p => p.role === 'Werewolf');
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

                io.to(roomCode).emit('vote_results', {
                    eliminated,
                    winners,
                    winReason,
                    voteBreakdown,
                    roleReveal,
                    centerCards: game.centerRoles
                });

                console.log(`Game ${roomCode} ended. Winners: ${winners.join(', ')}`);
            }
        });
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
