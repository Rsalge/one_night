const { createServer } = require('http');
const Client = require('socket.io-client');
const { server, io } = require('../../server');
const prisma = require('../lib/db');
const auth = require('./auth');
const gameStore = require('./gameStore');

describe('Game Flow Integration', () => {
    let port;
    let clients = [];
    let users = [];
    let roomCode;
    let playerStates = [];

    function waitForEvent(socket, eventName, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventName} on socket ${socket.id}`)), timeout);
            socket.once(eventName, (data) => {
                clearTimeout(timer);
                resolve(data);
            });
        });
    }

    beforeAll((done) => {
        server.listen(0, async () => {
            port = server.address().port;
            for (let i = 1; i <= 3; i++) {
                const username = `tu_${Date.now().toString().slice(-6)}_${i}`;
                try {
                    const { token, user } = await auth.register(username, 'password123');
                    users.push({ ...user, token });
                } catch (e) {
                    console.error("Setup error creating user:", e);
                }
            }
            done();
        });
    });

    afterAll(async () => {
        clients.forEach(c => c.disconnect());
        if (roomCode) {
            await prisma.game.deleteMany({ where: { roomCode } }).catch(() => { });
        }
        for (const u of users) {
            await prisma.user.delete({ where: { id: u.id } }).catch(() => { });
        }
        server.close();
    });

    test('Full End-to-End Game Flow', async () => {
        // 1. Connect clients
        users.forEach((u, i) => {
            const client = Client(`http://localhost:${port}`, { auth: { token: u.token } });
            clients.push(client);
            playerStates[i] = { user: u };

            // Auto listener for night turn
            client.on('night_turn', (data) => {
                playerStates[i].nightTurn = data;
                if (data.isInteractive) {
                    // Automatically perform dummy action and ack
                    setTimeout(() => {
                        // Dummy action: target the next player's socket ID (so Robber swaps, Seer looks, etc)
                        const targetIds = [clients[(i + 1) % 3].id];
                        client.emit('night_action', { roomCode, action: 'act', targetIds });
                    }, 100);
                } else if (data.activeRole === playerStates[i].role) {
                    setTimeout(() => {
                        client.emit('acknowledge_night', { roomCode });
                    }, 100);
                }
            });
            client.on('action_result', (data) => {
                client.emit('acknowledge_night', { roomCode });
            });
        });

        // Wait for all to connect
        await Promise.all(clients.map(c => waitForEvent(c, 'connect')));

        // 2. Create and Join Lobby
        const host = clients[0];
        host.emit('create_game');
        const createData = await waitForEvent(host, 'game_created');
        roomCode = createData.roomCode;

        clients[1].emit('join_game', { roomCode });
        await waitForEvent(clients[1], 'joined_room');
        clients[2].emit('join_game', { roomCode });
        await waitForEvent(clients[2], 'joined_room');

        // 3. Update Roles 
        // Force specific roles so we have predictable night actions
        // (1 Werewolf, 1 Seer, 1 Robber, 3 Center = 6 roles total)
        const selectedRoles = ['Werewolf', 'Seer', 'Robber', 'Villager', 'Villager', 'Villager'];
        host.emit('update_roles', { roomCode, selectedRoles });
        await waitForEvent(clients[2], 'roles_updated');

        // 4. Start Game
        const startedPromises = clients.map(c => waitForEvent(c, 'game_started'));
        host.emit('start_game', { roomCode });
        const startedDataList = await Promise.all(startedPromises);

        startedDataList.forEach((data, index) => {
            playerStates[index].role = data.role;
        });

        // 5. Wait for Day Phase (all night actions auto-resolve via the listeners above)
        // Set a long timeout since night turns take ~3s each
        const dayPromises = clients.map(c => waitForEvent(c, 'phase_change', 15000));
        const dayPhaseDatas = await Promise.all(dayPromises);
        expect(dayPhaseDatas[0].phase).toBe('DAY');

        // 6. Voting
        const targetId = clients[0].id;
        clients[0].on('vote_update', (data) => console.log('VOTE UPDATE HOST:', data));

        clients.forEach(c => {
            c.emit('cast_vote', { roomCode, voteTarget: targetId });
        });

        // 7. Results
        const resultsData = await waitForEvent(host, 'vote_results', 15000);
        expect(resultsData.eliminated.length).toBeGreaterThan(0);
        expect(resultsData.eliminated[0].id).toBe(targetId);
        expect(resultsData.winners).toBeDefined();
    }, 60000); // 60s timeout for full game E2E
});
