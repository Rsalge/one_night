/**
 * gameLogic.js - Pure game logic extracted for testability.
 * Supports base game + Daybreak expansion roles.
 */

// Wolves that wake together during the Werewolf phase
const WOLF_WAKE_ROLES = ['Werewolf', 'Alpha Wolf', 'Mystic Wolf'];
// All wolf-team roles (for Minion visibility + win conditions)
const ALL_WOLF_ROLES = [...WOLF_WAKE_ROLES, 'Dream Wolf'];

const NIGHT_ORDER = [
    'Sentinel',
    'Werewolf',         // Group wolf wake (Werewolf + Alpha Wolf + Mystic Wolf)
    'Alpha Wolf',       // Individual: swap center Werewolf card onto a non-wolf player
    'Mystic Wolf',      // Individual: view one player's card
    'Minion', 'Mason',
    'Seer', 'Apprentice Seer', 'Paranormal Investigator',
    'Robber', 'Witch', 'Troublemaker', 'Drunk',
    'Insomniac', 'Revealer'
];

const INTERACTIVE_ROLES = [
    'Sentinel', 'Alpha Wolf', 'Mystic Wolf',
    'Seer', 'Apprentice Seer', 'Paranormal Investigator',
    'Robber', 'Witch', 'Troublemaker', 'Drunk', 'Revealer'
];

/**
 * Check if a player is shielded by the Sentinel.
 */
function isShielded(game, playerId) {
    return game.shielded && game.shielded.includes(playerId);
}

/**
 * Auto-resolve a passive role's night action.
 * The 'Werewolf' entry handles the GROUP wolf wake for all awake wolf variants.
 */
function autoResolveRole(game, role) {
    const results = {};

    if (role === 'Werewolf') {
        // All awake wolves see each other
        const wolves = game.players.filter(p => WOLF_WAKE_ROLES.includes(p.originalRole));
        if (wolves.length > 1) {
            const wolfNames = wolves.map(w => `${w.name} (${w.originalRole})`).join(' & ');
            game.nightLog.push({ role: 'Werewolf', description: `${wolfNames} see each other as wolves` });
            wolves.forEach(w => {
                const otherWolves = wolves.filter(o => o.id !== w.id).map(o => o.name);
                results[w.id] = { type: 'info', message: `Fellow wolves: ${otherWolves.join(', ')}` };
            });
        }
        // Lone wolf (only 1 awake wolf) is handled as interactive
    }
    else if (role === 'Minion') {
        const minions = game.players.filter(p => p.originalRole === 'Minion');
        // Minion sees ALL wolves, including Dream Wolf
        const wolfPlayers = game.players.filter(p => ALL_WOLF_ROLES.includes(p.originalRole));
        const wolfNames = wolfPlayers.map(p => p.name);
        minions.forEach(m => {
            if (wolfNames.length > 0) {
                game.nightLog.push({ role: 'Minion', description: `${m.name} (Minion) sees ${wolfNames.join(' & ')} as Werewolves` });
                results[m.id] = { type: 'info', message: `Werewolves: ${wolfNames.join(', ')}` };
            } else {
                game.nightLog.push({ role: 'Minion', description: `${m.name} (Minion) sees no Werewolves` });
                results[m.id] = { type: 'info', message: 'No werewolves among players.' };
            }
        });
    }
    else if (role === 'Mason') {
        const masons = game.players.filter(p => p.originalRole === 'Mason');
        if (masons.length > 1) {
            game.nightLog.push({ role: 'Mason', description: `${masons.map(m => m.name).join(' & ')} see each other as Masons` });
        } else if (masons.length === 1) {
            game.nightLog.push({ role: 'Mason', description: `${masons[0].name} is the only Mason` });
        }
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
            game.nightLog.push({ role: 'Insomniac', description: `${ins.name} (Insomniac) looks at their card and sees ${ins.role}` });
            results[ins.id] = { type: 'info', message: `Your card is now: ${ins.role}` };
        });
    }

    return results;
}

/**
 * Process an interactive night action.
 * Mutates game state and appends to game.nightLog.
 * Returns the result to send to the player, or null.
 */
function processNightAction(game, player, action, targetIds) {
    let result = null;

    // ── Sentinel ──
    if (player.originalRole === 'Sentinel') {
        const targetId = targetIds[0];
        if (typeof targetId === 'string' && targetId !== player.id) {
            if (!game.shielded) game.shielded = [];
            game.shielded.push(targetId);
            const target = game.players.find(p => p.id === targetId);
            result = { type: 'info', message: `You placed a shield on ${target?.name || 'a player'}.` };
            game.nightLog.push({ role: 'Sentinel', description: `${player.name} (Sentinel) shields ${target?.name || 'a player'}'s card` });
        }
    }
    // ── Lone Werewolf (center peek) ──
    else if (player.originalRole === 'Werewolf') {
        if (targetIds.length === 1 && typeof targetIds[0] === 'number') {
            const centerIdx = targetIds[0];
            if (centerIdx >= 0 && centerIdx < game.centerRoles.length) {
                const card = game.centerRoles[centerIdx];
                result = { type: 'view_center', cards: [card] };
                game.nightLog.push({ role: 'Werewolf', description: `${player.name} (lone Werewolf) peeks at center card ${centerIdx + 1} and sees ${card}` });
            }
        }
    }
    // ── Alpha Wolf ──
    else if (player.originalRole === 'Alpha Wolf') {
        const targetId = targetIds[0];
        if (typeof targetId === 'string') {
            const target = game.players.find(p => p.id === targetId);
            if (target && ALL_WOLF_ROLES.includes(target.originalRole)) {
                result = { type: 'info', message: `${target.name} is already a Wolf!` };
                game.nightLog.push({ role: 'Alpha Wolf', description: `${player.name} (Alpha Wolf) tried to turn ${target.name} into a Werewolf, but they were already a wolf` });
            } else if (target && !isShielded(game, targetId)) {
                const oldRole = target.role;
                target.role = 'Werewolf';
                result = { type: 'info', message: `You turned ${target.name} into a Werewolf.` };
                game.nightLog.push({ role: 'Alpha Wolf', description: `${player.name} (Alpha Wolf) turns ${target.name} into a Werewolf (was ${oldRole})` });
            } else if (target && isShielded(game, targetId)) {
                result = { type: 'info', message: `${target.name} is shielded — no effect.` };
                game.nightLog.push({ role: 'Alpha Wolf', description: `${player.name} (Alpha Wolf) tried to target ${target.name} but they were shielded` });
            }
        }
    }
    // ── Mystic Wolf ──
    else if (player.originalRole === 'Mystic Wolf') {
        const targetId = targetIds[0];
        if (typeof targetId === 'string') {
            const target = game.players.find(p => p.id === targetId);
            if (target && !isShielded(game, targetId)) {
                result = { type: 'view', role: target.role, name: target.name };
                game.nightLog.push({ role: 'Mystic Wolf', description: `${player.name} (Mystic Wolf) looks at ${target.name}'s card and sees ${target.role}` });
            } else if (target && isShielded(game, targetId)) {
                result = { type: 'info', message: `${target.name} is shielded — cannot view.` };
                game.nightLog.push({ role: 'Mystic Wolf', description: `${player.name} (Mystic Wolf) tried to view ${target.name} but they were shielded` });
            }
        }
    }
    // ── Seer ──
    else if (player.originalRole === 'Seer') {
        if (targetIds.length === 1 && typeof targetIds[0] === 'string') {
            const target = game.players.find(p => p.id === targetIds[0]);
            if (target && !isShielded(game, targetIds[0])) {
                result = { type: 'view', role: target.role, name: target.name };
                game.nightLog.push({ role: 'Seer', description: `${player.name} (Seer) looks at ${target.name}'s card and sees ${target.role}` });
            } else if (target && isShielded(game, targetIds[0])) {
                result = { type: 'info', message: `${target.name} is shielded — cannot view.` };
                game.nightLog.push({ role: 'Seer', description: `${player.name} (Seer) tried to view ${target.name} but they were shielded` });
            }
        } else if (targetIds.length === 2 && targetIds.every(id => typeof id === 'number')) {
            const cards = targetIds.map(idx => game.centerRoles[idx]);
            result = { type: 'view_center', cards };
            game.nightLog.push({ role: 'Seer', description: `${player.name} (Seer) looks at 2 center cards and sees ${cards.join(' & ')}` });
        }
    }
    // ── Apprentice Seer ──
    else if (player.originalRole === 'Apprentice Seer') {
        if (targetIds.length === 1 && typeof targetIds[0] === 'number') {
            const centerIdx = targetIds[0];
            if (centerIdx >= 0 && centerIdx < game.centerRoles.length) {
                const card = game.centerRoles[centerIdx];
                result = { type: 'view_center', cards: [card] };
                game.nightLog.push({ role: 'Apprentice Seer', description: `${player.name} (Apprentice Seer) peeks at center card ${centerIdx + 1} and sees ${card}` });
            }
        }
    }
    // ── Paranormal Investigator ──
    else if (player.originalRole === 'Paranormal Investigator') {
        const viewed = [];
        let becameRole = null;
        for (let i = 0; i < Math.min(targetIds.length, 2); i++) {
            const tid = targetIds[i];
            if (typeof tid !== 'string') continue;
            const target = game.players.find(p => p.id === tid);
            if (!target) continue;
            if (isShielded(game, tid)) {
                viewed.push({ name: target.name, role: '🛡️ Shielded' });
                continue;
            }
            viewed.push({ name: target.name, role: target.role });
            // If PI sees a Werewolf or Tanner, they become that role and stop
            if (ALL_WOLF_ROLES.includes(target.role) || target.role === 'Tanner') {
                becameRole = target.role === 'Tanner' ? 'Tanner' : 'Werewolf';
                player.role = becameRole;
                game.nightLog.push({ role: 'Paranormal Investigator', description: `${player.name} (PI) looks at ${target.name} and sees ${target.role} — becomes ${becameRole}!` });
                break;
            }
        }
        if (!becameRole && viewed.length > 0) {
            game.nightLog.push({ role: 'Paranormal Investigator', description: `${player.name} (PI) investigates ${viewed.map(v => `${v.name} (${v.role})`).join(' & ')}` });
        }
        result = { type: 'pi_result', viewed, becameRole };
    }
    // ── Robber ──
    else if (player.originalRole === 'Robber') {
        const target = game.players.find(p => p.id === targetIds[0]);
        if (target && !isShielded(game, targetIds[0])) {
            const myRole = player.role;
            player.role = target.role;
            target.role = myRole;
            result = { type: 'swap_view', newRole: player.role, name: target.name };
            game.nightLog.push({ role: 'Robber', description: `${player.name} (Robber) swaps with ${target.name} and is now ${player.role}` });
        } else if (target && isShielded(game, targetIds[0])) {
            result = { type: 'info', message: `${target.name} is shielded — no swap.` };
            game.nightLog.push({ role: 'Robber', description: `${player.name} (Robber) tried to swap with ${target.name} but they were shielded` });
        }
    }
    // ── Witch ──
    else if (player.originalRole === 'Witch') {
        // targetIds: [centerIdx] = view only, [centerIdx, playerId] = view + swap
        const centerIdx = targetIds[0];
        if (typeof centerIdx === 'number' && centerIdx >= 0 && centerIdx < game.centerRoles.length) {
            const viewedCard = game.centerRoles[centerIdx];
            if (targetIds.length >= 2 && typeof targetIds[1] === 'string') {
                const target = game.players.find(p => p.id === targetIds[1]);
                if (target && !isShielded(game, targetIds[1])) {
                    const oldRole = target.role;
                    target.role = game.centerRoles[centerIdx];
                    game.centerRoles[centerIdx] = oldRole;
                    result = { type: 'witch_result', viewedCard, swapped: true, targetName: target.name };
                    game.nightLog.push({ role: 'Witch', description: `${player.name} (Witch) sees ${viewedCard} in center and swaps it with ${target.name}'s card` });
                } else if (target && isShielded(game, targetIds[1])) {
                    result = { type: 'witch_result', viewedCard, swapped: false, shielded: true };
                    game.nightLog.push({ role: 'Witch', description: `${player.name} (Witch) sees ${viewedCard} in center but ${target.name} was shielded` });
                }
            } else {
                result = { type: 'witch_result', viewedCard, swapped: false };
                game.nightLog.push({ role: 'Witch', description: `${player.name} (Witch) peeks at center card ${centerIdx + 1} and sees ${viewedCard}` });
            }
        }
    }
    // ── Troublemaker ──
    else if (player.originalRole === 'Troublemaker') {
        const p1 = game.players.find(p => p.id === targetIds[0]);
        const p2 = game.players.find(p => p.id === targetIds[1]);
        if (p1 && p2) {
            const s1 = isShielded(game, p1.id);
            const s2 = isShielded(game, p2.id);
            if (!s1 && !s2) {
                const temp = p1.role;
                p1.role = p2.role;
                p2.role = temp;
                result = { type: 'swap', message: `Swapped ${p1.name} and ${p2.name}.` };
                game.nightLog.push({ role: 'Troublemaker', description: `${player.name} (Troublemaker) swaps ${p1.name}'s and ${p2.name}'s cards` });
            } else {
                const shielded = [s1 && p1.name, s2 && p2.name].filter(Boolean).join(' & ');
                result = { type: 'info', message: `${shielded} is shielded — no swap.` };
                game.nightLog.push({ role: 'Troublemaker', description: `${player.name} (Troublemaker) tried to swap but ${shielded} was shielded` });
            }
        }
    }
    // ── Drunk ──
    else if (player.originalRole === 'Drunk') {
        const centerIdx = targetIds[0];
        if (typeof centerIdx === 'number' && centerIdx >= 0 && centerIdx < game.centerRoles.length) {
            const myRole = player.role;
            player.role = game.centerRoles[centerIdx];
            game.centerRoles[centerIdx] = myRole;
            result = { type: 'swap_center', message: 'You swapped with a center card.' };
            game.nightLog.push({ role: 'Drunk', description: `${player.name} (Drunk) blindly swaps their card with center card ${centerIdx + 1}` });
        }
    }
    // ── Revealer ──
    else if (player.originalRole === 'Revealer') {
        const targetId = targetIds[0];
        if (typeof targetId === 'string') {
            const target = game.players.find(p => p.id === targetId);
            if (target && !isShielded(game, targetId)) {
                const isWolf = ALL_WOLF_ROLES.includes(target.role);
                const isTanner = target.role === 'Tanner';
                if (isWolf || isTanner) {
                    // Card stays revealed — visible to all during the day
                    if (!game.revealed) game.revealed = [];
                    game.revealed.push({ id: target.id, name: target.name, role: target.role });
                    result = { type: 'reveal', name: target.name, role: target.role, staysRevealed: true };
                    game.nightLog.push({ role: 'Revealer', description: `${player.name} (Revealer) flips ${target.name}'s card — it's ${target.role}! Card stays face-up.` });
                } else {
                    result = { type: 'reveal', name: target.name, role: target.role, staysRevealed: false };
                    game.nightLog.push({ role: 'Revealer', description: `${player.name} (Revealer) peeks at ${target.name}'s card (${target.role}) and flips it back` });
                }
            } else if (target && isShielded(game, targetId)) {
                result = { type: 'info', message: `${target.name} is shielded — cannot reveal.` };
                game.nightLog.push({ role: 'Revealer', description: `${player.name} (Revealer) tried to reveal ${target.name} but they were shielded` });
            }
        }
    }

    return result;
}

/**
 * Determine the next night turn.
 */
function getNextNightTurn(game) {
    while (game.nightIndex < NIGHT_ORDER.length) {
        const currentRole = NIGHT_ORDER[game.nightIndex];

        // The 'Werewolf' slot handles the GROUP wolf wake
        if (currentRole === 'Werewolf') {
            const awakeWolves = game.players.filter(p => WOLF_WAKE_ROLES.includes(p.originalRole));
            if (awakeWolves.length === 0) {
                game.nightIndex++;
                continue;
            }
            // Lone awake wolf is interactive (peek center), multiple auto-resolve
            const isInteractive = awakeWolves.length === 1;
            return {
                done: false,
                role: 'Werewolf',
                players: awakeWolves,
                isInteractive
            };
        }

        // Alpha Wolf and Mystic Wolf get their own individual interactive turns
        const playersWithRole = game.players.filter(p => p.originalRole === currentRole);

        if (playersWithRole.length === 0) {
            game.nightIndex++;
            continue;
        }

        const isInteractive = INTERACTIVE_ROLES.includes(currentRole);

        return {
            done: false,
            role: currentRole,
            players: playersWithRole,
            isInteractive
        };
    }

    return { done: true };
}

module.exports = {
    NIGHT_ORDER,
    INTERACTIVE_ROLES,
    WOLF_WAKE_ROLES,
    ALL_WOLF_ROLES,
    isShielded,
    autoResolveRole,
    processNightAction,
    getNextNightTurn
};
