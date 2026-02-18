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

        socket.on('start_game', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return;

            // Validation for min players (lowered to 1 for testing)
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
            });

            // Store center cards in game object
            game.centerRoles = rolesToUse.slice(game.players.length);
            game.state = 'NIGHT';

            // Emit to each player in the room
            game.players.forEach((p) => {
                io.to(p.id).emit('game_started', {
                    role: p.role,
                    players: game.players.map(pl => ({ id: pl.id, name: pl.name })),
                    centerCardsCount: 3,
                    roomCode: roomCode
                });
            });
        });

        socket.on('night_action', ({ roomCode, action, targetIds }) => {
            const game = games.get(roomCode);
            if (!game || game.state !== 'NIGHT') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            console.log(`Action from ${player.name} (${player.role}): ${action}`, targetIds);

            let result = null;

            // Simple handling of actions
            // Real logic would manipulate game.rolesInPlay or temp arrays
            // For this version, we will just simulate the result return

            if (player.role === 'Seer') {
                if (targetIds.length === 1 && targetIds[0] !== 'center') {
                    // View another player
                    const target = game.players.find(p => p.id === targetIds[0]);
                    if (target) result = { type: 'view', role: target.role, name: target.name };
                } else if (targetIds.length === 2 && targetIds.every(id => typeof id === 'number')) {
                    // View 2 center cards (indices 0, 1, 2)
                    const cards = targetIds.map(idx => game.centerRoles[idx]);
                    result = { type: 'view_center', cards };
                }
            }
            else if (player.role === 'Robber') {
                const target = game.players.find(p => p.id === targetIds[0]);
                if (target) {
                    const myRole = player.role;
                    player.role = target.role;
                    target.role = myRole;
                    result = { type: 'swap_view', newRole: player.role, name: target.name };
                }
            }
            else if (player.role === 'Troublemaker') {
                const p1 = game.players.find(p => p.id === targetIds[0]);
                const p2 = game.players.find(p => p.id === targetIds[1]);
                if (p1 && p2) {
                    const temp = p1.role;
                    p1.role = p2.role;
                    p2.role = temp;
                    result = { type: 'swap', message: `Swapped ${p1.name} and ${p2.name}.` };
                }
            }
            else if (player.role === 'Drunk') {
                const centerIdx = targetIds[0];
                if (typeof centerIdx === 'number' && centerIdx >= 0 && centerIdx < 3) {
                    const myRole = player.role;
                    player.role = game.centerRoles[centerIdx];
                    game.centerRoles[centerIdx] = myRole;
                    result = { type: 'swap_center', message: 'You swapped with a center card.' };
                    // Drunk does NOT view the new card
                }
            }
            else if (player.role === 'Werewolf') {
                // If specific action needed (e.g. solo werewolf viewing center)
                if (targetIds.length === 1 && typeof targetIds[0] === 'number') {
                    // Solo werewolf viewing center
                    const card = game.centerRoles[targetIds[0]];
                    result = { type: 'view_center_single', card };
                }
            }

            socket.emit('action_result', result);
        });

        socket.on('end_night', ({ roomCode }) => {
            const game = games.get(roomCode);
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            player.ready = true;

            // Check if all players ready
            if (game.players.every(p => p.ready)) {
                game.state = 'DAY';
                io.to(roomCode).emit('phase_change', { phase: 'DAY' });
                console.log(`Game ${roomCode} switching to DAY`);
            }
        });
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
