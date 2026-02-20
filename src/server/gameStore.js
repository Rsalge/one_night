const prisma = require('../lib/db');

/**
 * Encapsulates all game state manipulation logic using Prisma.
 */

async function createGame(roomCode, playerName, socketId) {
    const ALL_ROLES = [
        'Werewolf', 'Werewolf', 'Seer', 'Robber', 'Troublemaker',
        'Villager', 'Villager', 'Villager', 'Mason', 'Mason',
        'Minion', 'Drunk', 'Insomniac', 'Hunter', 'Tanner',
        'Alpha Wolf', 'Mystic Wolf', 'Dream Wolf',
        'Apprentice Seer', 'Paranormal Investigator',
        'Witch', 'Sentinel', 'Revealer'
    ];

    // Clean up any orphaned player with this socket ID before creating
    await prisma.player.deleteMany({
        where: { id: socketId }
    });

    return prisma.game.create({
        data: {
            roomCode,
            state: 'LOBBY',
            selectedRoles: ALL_ROLES,
            players: {
                create: {
                    id: socketId,
                    name: playerName.substring(0, 15),
                    isHost: true,
                }
            }
        },
        include: { players: true }
    });
}

async function getGame(roomCode) {
    if (!roomCode) return null;
    return prisma.game.findUnique({
        where: { roomCode: roomCode.toUpperCase() },
        include: { players: true }
    });
}

async function joinGame(roomCode, playerName, socketId) {
    return prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({
            where: { roomCode: roomCode.toUpperCase() },
            include: { players: true }
        });

        if (!game) throw new Error('Room not found');
        if (game.state !== 'LOBBY') throw new Error('Game already started');

        // Clean up any orphaned player with this socket ID before joining
        await tx.player.deleteMany({
            where: { id: socketId }
        });

        const newPlayer = await tx.player.create({
            data: {
                id: socketId,
                name: playerName.substring(0, 15),
                isHost: false,
                gameId: game.roomCode
            }
        });

        // Re-fetch to get updated players list
        return tx.game.findUnique({
            where: { roomCode: game.roomCode },
            include: { players: true }
        });
    });
}

async function setSession(socketId, sessionId, roomCode) {
    return prisma.player.updateMany({
        where: { id: socketId, gameId: roomCode.toUpperCase() },
        data: { sessionId }
    });
}

async function getPlayerBySession(sessionId) {
    return prisma.player.findFirst({
        where: { sessionId },
        include: { game: { include: { players: true } } }
    });
}

async function rejoinGame(sessionId, socketId) {
    return prisma.$transaction(async (tx) => {
        const player = await tx.player.findFirst({
            where: { sessionId },
            include: { game: true }
        });

        if (!player || !player.game) {
            throw new Error('Session or room not found');
        }

        const updatedPlayer = await tx.player.update({
            where: { id: player.id },
            data: {
                id: socketId, // Update their socket id to the new one
                disconnected: false
            }
        });

        const game = await tx.game.findUnique({
            where: { roomCode: player.game.roomCode },
            include: { players: true }
        });

        return { player: updatedPlayer, game };
    });
}

async function updatePlayerDisconnectStatus(socketId, disconnected) {
    const player = await prisma.player.findUnique({ where: { id: socketId } });
    if (!player) return null;

    return prisma.player.update({
        where: { id: socketId },
        data: { disconnected },
        include: { game: { include: { players: true } } }
    });
}

async function removePlayer(socketId) {
    return prisma.$transaction(async (tx) => {
        const player = await tx.player.findUnique({
            where: { id: socketId }
        });

        if (!player) return null;

        await tx.player.delete({ where: { id: socketId } });

        const game = await tx.game.findUnique({
            where: { roomCode: player.gameId },
            include: { players: true }
        });

        if (!game) return null;

        if (game.players.length === 0) {
            await tx.game.delete({ where: { roomCode: game.roomCode } });
            return { deleted: true, roomCode: game.roomCode };
        } else if (player.isHost) {
            const connectedPlayer = game.players.find(p => !p.disconnected);
            if (connectedPlayer) {
                await tx.player.update({
                    where: { id: connectedPlayer.id },
                    data: { isHost: true }
                });
            }
            // re-fetch game after host logic
            const updatedGame = await tx.game.findUnique({
                where: { roomCode: game.roomCode },
                include: { players: true }
            });
            return { deleted: false, game: updatedGame };
        }

        return { deleted: false, game };
    });
}

async function startGame(roomCode, rolesToUse) {
    // Return updated game with roles assigned
    return prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({
            where: { roomCode },
            include: { players: true }
        });

        if (!game) throw new Error('Game not found');
        if (game.players.length < 1) throw new Error('Not enough players');

        const needed = game.players.length + 3;
        if (rolesToUse.length < needed) {
            throw new Error(`Need ${needed} roles but only ${rolesToUse.length} selected.`);
        }

        const shuffled = rolesToUse.slice(0, needed).sort(() => Math.random() - 0.5);
        const centerRoles = shuffled.slice(game.players.length);

        // Update each player individually in parallel
        await Promise.all(game.players.map((p, i) =>
            tx.player.update({
                where: { id: p.id },
                data: { role: shuffled[i], originalRole: shuffled[i], disconnected: false }
            })
        ));

        // Update game state
        return tx.game.update({
            where: { roomCode },
            data: {
                state: 'NIGHT',
                nightIndex: 0,
                centerRoles,
                nightLog: [],
                shielded: [],
                revealed: [],
                votes: {},
                pendingAcks: []
            },
            include: { players: true }
        });
    });
}

async function updateGameState(roomCode, data) {
    return prisma.game.update({
        where: { roomCode },
        data,
        include: { players: true }
    });
}

async function updatePlayerRole(playerId, roleData) {
    return prisma.player.update({
        where: { id: playerId },
        data: roleData
    });
}

module.exports = {
    createGame,
    getGame,
    joinGame,
    setSession,
    getPlayerBySession,
    rejoinGame,
    updatePlayerDisconnectStatus,
    removePlayer,
    startGame,
    updateGameState,
    updatePlayerRole
};
