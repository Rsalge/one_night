/**
 * Night Phase Tests — gameLogic.test.js
 *
 * Tests the night phase sequencing, role actions, and state mutations.
 * Covers base game + Daybreak expansion roles.
 */

const {
    NIGHT_ORDER,
    INTERACTIVE_ROLES,
    WOLF_WAKE_ROLES,
    ALL_WOLF_ROLES,
    isShielded,
    autoResolveRole,
    processNightAction,
    getNextNightTurn
} = require('./gameLogic');

// ─── Helpers ──────────────────────────────────────────────

function makePlayer(id, name, role) {
    return { id, name, role, originalRole: role };
}

function makeGame(players, centerRoles = ['Villager', 'Villager', 'Villager']) {
    return {
        players,
        centerRoles: [...centerRoles],
        state: 'NIGHT',
        nightIndex: 0,
        nightLog: [],
        shielded: [],
        revealed: []
    };
}

// ─── Constants ────────────────────────────────────────────

describe('Night Order & Constants', () => {
    test('NIGHT_ORDER has correct expanded sequence', () => {
        expect(NIGHT_ORDER).toEqual([
            'Sentinel',
            'Werewolf', 'Alpha Wolf', 'Mystic Wolf',
            'Minion', 'Mason',
            'Seer', 'Apprentice Seer', 'Paranormal Investigator',
            'Robber', 'Witch', 'Troublemaker', 'Drunk',
            'Insomniac', 'Revealer'
        ]);
    });

    test('WOLF_WAKE_ROLES includes Werewolf, Alpha Wolf, Mystic Wolf', () => {
        expect(WOLF_WAKE_ROLES).toContain('Werewolf');
        expect(WOLF_WAKE_ROLES).toContain('Alpha Wolf');
        expect(WOLF_WAKE_ROLES).toContain('Mystic Wolf');
        expect(WOLF_WAKE_ROLES).not.toContain('Dream Wolf');
    });

    test('ALL_WOLF_ROLES includes Dream Wolf', () => {
        expect(ALL_WOLF_ROLES).toContain('Dream Wolf');
        expect(ALL_WOLF_ROLES).toContain('Werewolf');
    });

    test('all Daybreak interactive roles are listed', () => {
        expect(INTERACTIVE_ROLES).toContain('Sentinel');
        expect(INTERACTIVE_ROLES).toContain('Alpha Wolf');
        expect(INTERACTIVE_ROLES).toContain('Mystic Wolf');
        expect(INTERACTIVE_ROLES).toContain('Apprentice Seer');
        expect(INTERACTIVE_ROLES).toContain('Paranormal Investigator');
        expect(INTERACTIVE_ROLES).toContain('Witch');
        expect(INTERACTIVE_ROLES).toContain('Revealer');
    });
});

// ─── getNextNightTurn ─────────────────────────────────────

describe('getNextNightTurn', () => {
    test('skips roles not in play', () => {
        const game = makeGame([makePlayer('p1', 'A', 'Seer')]);
        const turn = getNextNightTurn(game);
        expect(turn.role).toBe('Seer');
        expect(turn.isInteractive).toBe(true);
    });

    test('returns done when no roles remain', () => {
        const game = makeGame([makePlayer('p1', 'A', 'Villager')]);
        expect(getNextNightTurn(game).done).toBe(true);
    });

    test('Werewolf phase finds all awake wolf variants', () => {
        const game = makeGame([
            makePlayer('w1', 'A', 'Werewolf'),
            makePlayer('w2', 'B', 'Alpha Wolf'),
            makePlayer('w3', 'C', 'Mystic Wolf'),
        ]);
        const turn = getNextNightTurn(game);
        expect(turn.role).toBe('Werewolf');
        expect(turn.players).toHaveLength(3);
        expect(turn.isInteractive).toBe(false); // Multiple wolves
    });

    test('lone awake wolf is interactive', () => {
        const game = makeGame([makePlayer('w1', 'A', 'Alpha Wolf')]);
        const turn = getNextNightTurn(game);
        expect(turn.role).toBe('Werewolf');
        expect(turn.isInteractive).toBe(true);
        expect(turn.players).toHaveLength(1);
    });

    test('Dream Wolf does NOT wake during Werewolf phase', () => {
        const game = makeGame([makePlayer('d1', 'A', 'Dream Wolf')]);
        // Dream Wolf is not in WOLF_WAKE_ROLES, so Werewolf phase is skipped
        const turn = getNextNightTurn(game);
        // Dream Wolf has no night order entry, should skip all
        expect(turn.done).toBe(true);
    });

    test('Alpha Wolf gets individual turn after group wolf wake', () => {
        const game = makeGame([
            makePlayer('w1', 'A', 'Werewolf'),
            makePlayer('aw', 'B', 'Alpha Wolf'),
            makePlayer('v1', 'C', 'Villager'),
        ]);
        // Werewolf group phase
        let turn = getNextNightTurn(game);
        expect(turn.role).toBe('Werewolf');
        game.nightIndex++;

        // Alpha Wolf individual turn
        turn = getNextNightTurn(game);
        expect(turn.role).toBe('Alpha Wolf');
        expect(turn.isInteractive).toBe(true);
    });
});

// ─── autoResolveRole (base) ──────────────────────────────

describe('autoResolveRole', () => {
    test('multi-wolf: all awake wolves see each other (incl. variants)', () => {
        const game = makeGame([
            makePlayer('w1', 'Alice', 'Werewolf'),
            makePlayer('aw', 'Bob', 'Alpha Wolf'),
        ]);
        const results = autoResolveRole(game, 'Werewolf');
        expect(results['w1'].message).toContain('Bob');
        expect(results['aw'].message).toContain('Alice');
    });

    test('lone awake wolf returns no auto-resolve results', () => {
        const game = makeGame([makePlayer('w1', 'A', 'Werewolf')]);
        const results = autoResolveRole(game, 'Werewolf');
        expect(Object.keys(results)).toHaveLength(0);
    });

    test('Minion sees ALL wolves including Dream Wolf', () => {
        const game = makeGame([
            makePlayer('m1', 'Eve', 'Minion'),
            makePlayer('w1', 'Alice', 'Werewolf'),
            makePlayer('dw', 'Bob', 'Dream Wolf'),
        ]);
        const results = autoResolveRole(game, 'Minion');
        expect(results['m1'].message).toContain('Alice');
        expect(results['m1'].message).toContain('Bob');
    });

    test('Mason pair sees each other', () => {
        const game = makeGame([
            makePlayer('ma1', 'Dan', 'Mason'),
            makePlayer('ma2', 'Fay', 'Mason'),
        ]);
        const results = autoResolveRole(game, 'Mason');
        expect(results['ma1'].message).toContain('Fay');
        expect(results['ma2'].message).toContain('Dan');
    });

    test('Insomniac sees swapped role', () => {
        const players = [makePlayer('i1', 'Gina', 'Insomniac')];
        const game = makeGame(players);
        game.players[0].role = 'Robber'; // was swapped
        const results = autoResolveRole(game, 'Insomniac');
        expect(results['i1'].message).toBe('Your card is now: Robber');
    });
});

// ─── processNightAction (base roles) ─────────────────────

describe('processNightAction — Base Roles', () => {
    test('Seer views player', () => {
        const game = makeGame([
            makePlayer('s1', 'A', 'Seer'),
            makePlayer('p1', 'B', 'Werewolf'),
        ]);
        const result = processNightAction(game, game.players[0], 'act', ['p1']);
        expect(result.type).toBe('view');
        expect(result.role).toBe('Werewolf');
    });

    test('Seer views 2 center cards', () => {
        const game = makeGame([makePlayer('s1', 'A', 'Seer')], ['Tanner', 'Drunk', 'Mason']);
        const result = processNightAction(game, game.players[0], 'act', [0, 2]);
        expect(result.cards).toEqual(['Tanner', 'Mason']);
    });

    test('Robber swaps roles', () => {
        const game = makeGame([
            makePlayer('r1', 'A', 'Robber'),
            makePlayer('p1', 'B', 'Werewolf'),
        ]);
        processNightAction(game, game.players[0], 'act', ['p1']);
        expect(game.players[0].role).toBe('Werewolf');
        expect(game.players[1].role).toBe('Robber');
    });

    test('Troublemaker swaps two others', () => {
        const game = makeGame([
            makePlayer('t1', 'A', 'Troublemaker'),
            makePlayer('p1', 'B', 'Seer'),
            makePlayer('p2', 'C', 'Werewolf'),
        ]);
        processNightAction(game, game.players[0], 'act', ['p1', 'p2']);
        expect(game.players[1].role).toBe('Werewolf');
        expect(game.players[2].role).toBe('Seer');
    });

    test('Drunk swaps with center', () => {
        const game = makeGame([makePlayer('d1', 'A', 'Drunk')], ['Werewolf', 'Seer', 'Villager']);
        processNightAction(game, game.players[0], 'act', [0]);
        expect(game.players[0].role).toBe('Werewolf');
        expect(game.centerRoles[0]).toBe('Drunk');
    });
});

// ─── processNightAction (Daybreak roles) ─────────────────

describe('processNightAction — Daybreak Roles', () => {
    describe('Sentinel', () => {
        test('shields a player', () => {
            const game = makeGame([
                makePlayer('s1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['p1']);
            expect(result.type).toBe('info');
            expect(result.message).toContain('shield');
            expect(game.shielded).toContain('p1');
        });

        test('cannot shield self', () => {
            const game = makeGame([makePlayer('s1', 'Alice', 'Sentinel')]);
            const result = processNightAction(game, game.players[0], 'act', ['s1']);
            expect(result).toBeNull();
            expect(game.shielded).not.toContain('s1');
        });
    });

    describe('Alpha Wolf', () => {
        test('directly transforms non-wolf player into Werewolf', () => {
            const game = makeGame(
                [
                    makePlayer('aw', 'Alpha', 'Alpha Wolf'),
                    makePlayer('v1', 'Villager1', 'Villager'),
                ],
                ['Seer', 'Robber', 'Drunk']
            );
            const result = processNightAction(game, game.players[0], 'act', ['v1']);
            expect(result.message).toContain('turned');
            expect(game.players[1].role).toBe('Werewolf');
        });

        test('cannot target a wolf player', () => {
            const game = makeGame([
                makePlayer('aw', 'Alpha', 'Alpha Wolf'),
                makePlayer('w1', 'Wolf', 'Werewolf'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['w1']);
            expect(result).toBeNull();
            expect(game.players[1].role).toBe('Werewolf');
        });

        test('blocked by Sentinel shield', () => {
            const game = makeGame([
                makePlayer('aw', 'Alpha', 'Alpha Wolf'),
                makePlayer('v1', 'Bob', 'Villager'),
            ]);
            game.shielded = ['v1'];
            const result = processNightAction(game, game.players[0], 'act', ['v1']);
            expect(result.message).toContain('shielded');
            expect(game.players[1].role).toBe('Villager');
        });
    });

    describe('Mystic Wolf', () => {
        test('views another player card', () => {
            const game = makeGame([
                makePlayer('mw', 'Mystic', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['p1']);
            expect(result.type).toBe('view');
            expect(result.role).toBe('Seer');
        });

        test('blocked by shield', () => {
            const game = makeGame([
                makePlayer('mw', 'Mystic', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            game.shielded = ['p1'];
            const result = processNightAction(game, game.players[0], 'act', ['p1']);
            expect(result.message).toContain('shielded');
        });
    });

    describe('Apprentice Seer', () => {
        test('peeks at one center card', () => {
            const game = makeGame([makePlayer('as', 'A', 'Apprentice Seer')], ['Tanner', 'Mason', 'Drunk']);
            const result = processNightAction(game, game.players[0], 'act', [1]);
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Mason']);
        });
    });

    describe('Paranormal Investigator', () => {
        test('investigates 2 clean players', () => {
            const game = makeGame([
                makePlayer('pi', 'PI', 'Paranormal Investigator'),
                makePlayer('p1', 'A', 'Seer'),
                makePlayer('p2', 'B', 'Villager'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);
            expect(result.type).toBe('pi_result');
            expect(result.viewed).toHaveLength(2);
            expect(result.becameRole).toBeNull();
        });

        test('becomes Werewolf when seeing a wolf on first card', () => {
            const game = makeGame([
                makePlayer('pi', 'PI', 'Paranormal Investigator'),
                makePlayer('w1', 'W', 'Werewolf'),
                makePlayer('p2', 'B', 'Seer'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['w1', 'p2']);
            expect(result.becameRole).toBe('Werewolf');
            expect(result.viewed).toHaveLength(1); // Stopped after first
            expect(game.players[0].role).toBe('Werewolf');
        });

        test('becomes Tanner on second investigation', () => {
            const game = makeGame([
                makePlayer('pi', 'PI', 'Paranormal Investigator'),
                makePlayer('p1', 'A', 'Seer'),
                makePlayer('p2', 'B', 'Tanner'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);
            expect(result.becameRole).toBe('Tanner');
            expect(result.viewed).toHaveLength(2);
            expect(game.players[0].role).toBe('Tanner');
        });

        test('shielded targets show as shielded', () => {
            const game = makeGame([
                makePlayer('pi', 'PI', 'Paranormal Investigator'),
                makePlayer('p1', 'A', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            const result = processNightAction(game, game.players[0], 'act', ['p1']);
            expect(result.viewed[0].role).toContain('Shielded');
            expect(result.becameRole).toBeNull();
        });
    });

    describe('Witch', () => {
        test('view center card only (no swap)', () => {
            const game = makeGame([makePlayer('wi', 'W', 'Witch')], ['Tanner', 'Seer', 'Drunk']);
            const result = processNightAction(game, game.players[0], 'act', [0]);
            expect(result.type).toBe('witch_result');
            expect(result.viewedCard).toBe('Tanner');
            expect(result.swapped).toBe(false);
        });

        test('view and swap center card with player', () => {
            const game = makeGame([
                makePlayer('wi', 'W', 'Witch'),
                makePlayer('p1', 'Bob', 'Villager'),
            ], ['Tanner', 'Seer', 'Drunk']);
            const result = processNightAction(game, game.players[0], 'act', [0, 'p1']);
            expect(result.viewedCard).toBe('Tanner');
            expect(result.swapped).toBe(true);
            expect(game.players[1].role).toBe('Tanner'); // Got the Tanner
            expect(game.centerRoles[0]).toBe('Villager'); // Villager went to center
        });

        test('swap blocked by shield', () => {
            const game = makeGame([
                makePlayer('wi', 'W', 'Witch'),
                makePlayer('p1', 'Bob', 'Villager'),
            ], ['Tanner', 'Seer', 'Drunk']);
            game.shielded = ['p1'];
            const result = processNightAction(game, game.players[0], 'act', [0, 'p1']);
            expect(result.swapped).toBe(false);
            expect(result.shielded).toBe(true);
            expect(game.players[1].role).toBe('Villager'); // unchanged
        });
    });

    describe('Revealer', () => {
        test('reveals a Werewolf (stays face-up)', () => {
            const game = makeGame([
                makePlayer('rv', 'R', 'Revealer'),
                makePlayer('w1', 'Wolf', 'Werewolf'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['w1']);
            expect(result.type).toBe('reveal');
            expect(result.staysRevealed).toBe(true);
            expect(result.role).toBe('Werewolf');
            expect(game.revealed).toHaveLength(1);
        });

        test('reveals a non-wolf (flips back)', () => {
            const game = makeGame([
                makePlayer('rv', 'R', 'Revealer'),
                makePlayer('p1', 'V', 'Villager'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['p1']);
            expect(result.staysRevealed).toBe(false);
            expect(result.role).toBe('Villager');
            expect(game.revealed).toHaveLength(0);
        });

        test('reveals a Tanner (stays face-up)', () => {
            const game = makeGame([
                makePlayer('rv', 'R', 'Revealer'),
                makePlayer('t1', 'T', 'Tanner'),
            ]);
            const result = processNightAction(game, game.players[0], 'act', ['t1']);
            expect(result.staysRevealed).toBe(true);
        });

        test('blocked by shield', () => {
            const game = makeGame([
                makePlayer('rv', 'R', 'Revealer'),
                makePlayer('w1', 'W', 'Werewolf'),
            ]);
            game.shielded = ['w1'];
            const result = processNightAction(game, game.players[0], 'act', ['w1']);
            expect(result.message).toContain('shielded');
        });
    });
});

// ─── Shielding interactions ──────────────────────────────

describe('Sentinel Shielding', () => {
    test('Seer cannot view shielded player', () => {
        const game = makeGame([
            makePlayer('s1', 'Seer', 'Seer'),
            makePlayer('p1', 'Bob', 'Werewolf'),
        ]);
        game.shielded = ['p1'];
        const result = processNightAction(game, game.players[0], 'act', ['p1']);
        expect(result.message).toContain('shielded');
    });

    test('Robber cannot swap with shielded player', () => {
        const game = makeGame([
            makePlayer('r1', 'Rob', 'Robber'),
            makePlayer('p1', 'Bob', 'Werewolf'),
        ]);
        game.shielded = ['p1'];
        const result = processNightAction(game, game.players[0], 'act', ['p1']);
        expect(result.message).toContain('shielded');
        expect(game.players[0].role).toBe('Robber'); // unchanged
    });

    test('Troublemaker blocked when either target is shielded', () => {
        const game = makeGame([
            makePlayer('t1', 'Trouble', 'Troublemaker'),
            makePlayer('p1', 'A', 'Seer'),
            makePlayer('p2', 'B', 'Werewolf'),
        ]);
        game.shielded = ['p2'];
        const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);
        expect(result.message).toContain('shielded');
        expect(game.players[1].role).toBe('Seer'); // unchanged
        expect(game.players[2].role).toBe('Werewolf'); // unchanged
    });
});

// ─── Full Night Sequence ─────────────────────────────────

describe('Full Night with Daybreak Roles', () => {
    test('Sentinel → Werewolves → Alpha Wolf → Seer → Robber sequence', () => {
        const game = makeGame([
            makePlayer('se', 'Sentinel', 'Sentinel'),
            makePlayer('w1', 'Wolf1', 'Werewolf'),
            makePlayer('aw', 'AlphaW', 'Alpha Wolf'),
            makePlayer('s1', 'Seer1', 'Seer'),
            makePlayer('r1', 'Robber1', 'Robber'),
            makePlayer('v1', 'Villager1', 'Villager'),
        ], ['Drunk', 'Mason', 'Tanner']); // Always 3 center cards

        const sequence = [];

        // Sentinel turn
        let turn = getNextNightTurn(game);
        expect(turn.role).toBe('Sentinel');
        sequence.push(turn.role);
        processNightAction(game, game.players[0], 'act', ['v1']); // Shield villager
        game.nightIndex++;

        // Wolf group phase
        turn = getNextNightTurn(game);
        expect(turn.role).toBe('Werewolf');
        expect(turn.players).toHaveLength(2); // Wolf1 + AlphaW
        sequence.push(turn.role);
        autoResolveRole(game, 'Werewolf');
        game.nightIndex++;

        // Alpha Wolf individual turn
        turn = getNextNightTurn(game);
        expect(turn.role).toBe('Alpha Wolf');
        sequence.push(turn.role);
        processNightAction(game, game.players[2], 'act', ['s1']); // Turn Seer into Werewolf
        game.nightIndex++;

        // Seer turn
        turn = getNextNightTurn(game);
        expect(turn.role).toBe('Seer');
        sequence.push(turn.role);
        processNightAction(game, game.players[3], 'act', ['r1']); // View Robber
        game.nightIndex++;

        // Robber turn
        turn = getNextNightTurn(game);
        expect(turn.role).toBe('Robber');
        sequence.push(turn.role);
        processNightAction(game, game.players[4], 'act', ['v1']); // Try to swap with shielded Villager
        game.nightIndex++;

        // Done
        turn = getNextNightTurn(game);
        expect(turn.done).toBe(true);

        expect(sequence).toEqual(['Sentinel', 'Werewolf', 'Alpha Wolf', 'Seer', 'Robber']);

        // Verify: Seer's card was swapped to Werewolf by Alpha Wolf
        expect(game.players[3].role).toBe('Werewolf');
        // Robber was blocked by shield on Villager
        expect(game.players[4].role).toBe('Robber'); // unchanged
    });

    test('nightLog is chronological across all roles', () => {
        const game = makeGame([
            makePlayer('se', 'S', 'Sentinel'),
            makePlayer('w1', 'W', 'Werewolf'),
            makePlayer('as', 'AS', 'Apprentice Seer'),
        ], ['Tanner', 'Seer', 'Drunk']);

        processNightAction(game, game.players[0], 'act', ['w1']); // Sentinel shields wolf
        game.nightIndex++;
        let turn = getNextNightTurn(game); // Werewolf (lone wolf)
        processNightAction(game, game.players[1], 'act', [0]); // Peek center
        game.nightIndex++;
        turn = getNextNightTurn(game); // Apprentice Seer
        processNightAction(game, game.players[2], 'act', [1]); // Peek center

        expect(game.nightLog[0].role).toBe('Sentinel');
        expect(game.nightLog[1].role).toBe('Werewolf');
        expect(game.nightLog[2].role).toBe('Apprentice Seer');
    });
});
