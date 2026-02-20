const prisma = require('../lib/db');

/**
 * Get comprehensive player statistics
 */
async function getPlayerStats(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            gamePlayers: {
                include: {
                    game: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Basic stats (from cached fields)
    const basicStats = {
        userId: user.id,
        username: user.username,
        gamesPlayed: user.gamesPlayed,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
        winRate: user.gamesPlayed > 0 ? parseFloat((user.totalWins / user.gamesPlayed * 100).toFixed(1)) : 0,
        currentStreak: user.currentStreak,
        bestWinStreak: user.bestWinStreak,
        firstGameAt: user.firstGameAt,
        lastPlayedAt: user.lastPlayedAt,
        memberSince: user.createdAt
    };

    // Team performance
    const teamStats = calculateTeamStats(user.gamePlayers);

    // Role performance
    const roleStats = calculateRoleStats(user.gamePlayers);

    // Additional metrics
    const killCount = user.gamePlayers.filter(gp => gp.wasKilled).length;
    const survivalCount = user.gamePlayers.length - killCount;
    const correctVotes = user.gamePlayers.filter(gp => gp.votedCorrectly).length;
    const votingAccuracy = user.gamePlayers.length > 0
        ? parseFloat((correctVotes / user.gamePlayers.length * 100).toFixed(1))
        : 0;

    // Game duration stats
    const durations = user.gamePlayers
        .map(gp => gp.game.gameDuration)
        .filter(d => d != null);
    const avgGameDuration = durations.length > 0
        ? Math.floor(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    // Find best and worst roles
    const sortedByWinRate = roleStats.filter(r => r.gamesPlayed >= 2).sort((a, b) => b.winRate - a.winRate);
    const bestRole = sortedByWinRate[0] || null;
    const worstRole = sortedByWinRate[sortedByWinRate.length - 1] || null;

    // Most played role
    const mostPlayedRole = roleStats[0] || null;

    return {
        ...basicStats,
        teamStats,
        roleStats,
        killCount,
        survivalCount,
        survivalRate: user.gamesPlayed > 0 ? parseFloat((survivalCount / user.gamesPlayed * 100).toFixed(1)) : 0,
        correctVotes,
        votingAccuracy,
        avgGameDuration,
        bestRole: bestRole ? { role: bestRole.role, winRate: bestRole.winRate } : null,
        worstRole: worstRole && worstRole !== bestRole ? { role: worstRole.role, winRate: worstRole.winRate } : null,
        mostPlayedRole: mostPlayedRole ? { role: mostPlayedRole.role, gamesPlayed: mostPlayedRole.gamesPlayed } : null
    };
}

function calculateTeamStats(gamePlayers) {
    const teams = ['villager', 'werewolf', 'tanner'];
    const stats = {};

    for (const team of teams) {
        const teamGames = gamePlayers.filter(gp => gp.team === team);
        const wins = teamGames.filter(gp => gp.won).length;
        const losses = teamGames.length - wins;
        const winRate = teamGames.length > 0 ? parseFloat((wins / teamGames.length * 100).toFixed(1)) : 0;

        stats[team] = {
            gamesPlayed: teamGames.length,
            wins,
            losses,
            winRate
        };
    }

    return stats;
}

function calculateRoleStats(gamePlayers) {
    const roleMap = {};

    for (const gp of gamePlayers) {
        const role = gp.finalRole;
        if (!roleMap[role]) {
            roleMap[role] = { gamesPlayed: 0, wins: 0, losses: 0 };
        }
        roleMap[role].gamesPlayed++;
        if (gp.won) {
            roleMap[role].wins++;
        } else {
            roleMap[role].losses++;
        }
    }

    // Convert to array and add win rates
    const roleStats = Object.entries(roleMap).map(([role, stats]) => ({
        role,
        ...stats,
        winRate: parseFloat((stats.wins / stats.gamesPlayed * 100).toFixed(1))
    }));

    // Sort by games played (most played first)
    roleStats.sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    return roleStats;
}

module.exports = { getPlayerStats };
