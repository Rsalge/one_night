const prisma = require('../lib/db');

// Werewolf team roles
const WEREWOLF_ROLES = ['Werewolf', 'Alpha Wolf', 'Mystic Wolf', 'Dream Wolf', 'Minion'];

/**
 * Get team from role name
 */
function getTeamFromRole(roleName) {
    if (WEREWOLF_ROLES.includes(roleName)) return 'werewolf';
    if (roleName === 'Tanner') return 'tanner';
    return 'villager';
}

/**
 * Save completed game and update player stats
 */
async function saveCompletedGame(game, winningTeams, eliminatedIds) {
    const gameDuration = game.completedAt && game.startedAt
        ? Math.floor((new Date(game.completedAt) - new Date(game.startedAt)) / 1000)
        : null;

    return prisma.$transaction(async (tx) => {
        // Create completed game record
        const completedGame = await tx.completedGame.create({
            data: {
                roomCode: game.roomCode,
                playedAt: game.completedAt || new Date(),
                winningTeams: winningTeams,
                gameDuration: gameDuration,
                playerCount: game.players.length
            }
        });

        // Process each player
        for (const player of game.players) {
            if (!player.userId) continue; // Skip if somehow no userId

            const team = getTeamFromRole(player.role);
            const won = winningTeams.includes(team === 'villager' ? 'Village' : team === 'werewolf' ? 'Werewolf' : 'Tanner');
            const wasKilled = eliminatedIds.includes(player.id);

            // Determine if voted correctly
            const votedForId = game.votes?.[player.id];
            const votedForPlayer = game.players.find(p => p.id === votedForId);
            let votedCorrectly = false;

            if (votedForPlayer && eliminatedIds.includes(votedForId)) {
                const votedForTeam = getTeamFromRole(votedForPlayer.role);
                // Correct if voted for werewolf or tanner who died
                if (votedForTeam === 'werewolf' || votedForTeam === 'tanner') {
                    votedCorrectly = true;
                }
            }

            // Create game_player record
            await tx.gamePlayer.create({
                data: {
                    userId: player.userId,
                    gameId: completedGame.id,
                    startingRole: player.originalRole,
                    finalRole: player.role,
                    team: team,
                    won: won,
                    wasKilled: wasKilled,
                    votedFor: votedForPlayer?.name || null,
                    votedCorrectly: votedCorrectly
                }
            });

            // Update user cached stats
            await updateUserStats(tx, player.userId, won);
        }

        return completedGame;
    });
}

/**
 * Update user's cached stats
 */
async function updateUserStats(tx, userId, won) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const newGamesPlayed = user.gamesPlayed + 1;
    const newTotalWins = won ? user.totalWins + 1 : user.totalWins;
    const newTotalLosses = won ? user.totalLosses : user.totalLosses + 1;

    // Calculate streak: positive for wins, negative for losses
    let newCurrentStreak = user.currentStreak;
    if (won) {
        newCurrentStreak = user.currentStreak >= 0 ? user.currentStreak + 1 : 1;
    } else {
        newCurrentStreak = user.currentStreak <= 0 ? user.currentStreak - 1 : -1;
    }

    const newBestWinStreak = Math.max(user.bestWinStreak, newCurrentStreak);

    await tx.user.update({
        where: { id: userId },
        data: {
            gamesPlayed: newGamesPlayed,
            totalWins: newTotalWins,
            totalLosses: newTotalLosses,
            currentStreak: newCurrentStreak,
            bestWinStreak: newBestWinStreak,
            lastPlayedAt: new Date(),
            firstGameAt: user.firstGameAt || new Date()
        }
    });
}

module.exports = { saveCompletedGame };
