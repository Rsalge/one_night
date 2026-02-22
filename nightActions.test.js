/**
 * Night Actions Tests — nightActions.test.js
 *
 * Comprehensive tests for processNightAction validating:
 * - Each role can perform valid actions
 * - Edge cases and behavior documentation
 * - nightLog entries are created correctly
 */

const {
    NIGHT_ORDER,
    WOLF_WAKE_ROLES,
    ALL_WOLF_ROLES,
    processNightAction
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

// Helper to set nightIndex to a specific role's turn
function setNightIndexForRole(game, role) {
    const index = NIGHT_ORDER.indexOf(role);
    if (index !== -1) {
        game.nightIndex = index;
    }
}

// ─── Seer Night Action ────────────────────────────────────

describe('Seer Night Action', () => {
    describe('valid inputs', () => {
        test('views 1 player and returns view result with role', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view');
            expect(result.role).toBe('Werewolf');
            expect(result.name).toBe('Bob');
        });

        test('views 2 center cards and returns view_center with cards array', () => {
            const game = makeGame(
                [makePlayer('seer1', 'Alice', 'Seer')],
                ['Tanner', 'Drunk', 'Mason']
            );
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', [0, 2]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Tanner', 'Mason']);
        });

        test('creates nightLog entry for player view', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Seer');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Seer');
            expect(game.nightLog[0].description).toContain('Alice');
            expect(game.nightLog[0].description).toContain('Bob');
            expect(game.nightLog[0].description).toContain('Werewolf');
        });

        test('creates nightLog entry for center view', () => {
            const game = makeGame(
                [makePlayer('seer1', 'Alice', 'Seer')],
                ['Tanner', 'Drunk', 'Mason']
            );
            setNightIndexForRole(game, 'Seer');

            processNightAction(game, game.players[0], 'act', [0, 1]);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Seer');
            expect(game.nightLog[0].description).toContain('center');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
            expect(game.nightLog).toHaveLength(0);
        });

        test('1 center card only returns null', () => {
            const game = makeGame([makePlayer('seer1', 'Alice', 'Seer')]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
            expect(game.nightLog).toHaveLength(0);
        });

        test('3 center cards returns null', () => {
            const game = makeGame([makePlayer('seer1', 'Alice', 'Seer')]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', [0, 1, 2]);

            expect(result).toBeNull();
        });

        test('1 player + 1 center returns null', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 0]);

            expect(result).toBeNull();
        });

        test('2 players returns null', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
                makePlayer('p2', 'Carol', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).toBeNull();
        });

        test('invalid player ID returns null', () => {
            const game = makeGame([makePlayer('seer1', 'Alice', 'Seer')]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', ['nonexistent']);

            expect(result).toBeNull();
        });

        test('out-of-bounds center index returns null', () => {
            const game = makeGame([makePlayer('seer1', 'Alice', 'Seer')]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', [0, 5]);

            expect(result).toBeNull();
            expect(game.nightLog).toHaveLength(0);
        });

        test('negative center index returns null', () => {
            const game = makeGame([makePlayer('seer1', 'Alice', 'Seer')]);
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', [-1, 0]);

            expect(result).toBeNull();
            expect(game.nightLog).toHaveLength(0);
        });
    });

    describe('shielded', () => {
        test('shielded player returns info message', () => {
            const game = makeGame([
                makePlayer('seer1', 'Alice', 'Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Seer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
        });
    });
});

// ─── Robber Night Action ──────────────────────────────────

describe('Robber Night Action', () => {
    describe('valid inputs', () => {
        test('swaps with player and receives their role', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('swap_view');
            expect(result.newRole).toBe('Werewolf');
            expect(result.name).toBe('Bob');
        });

        test('target player now has Robber role', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Robber');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.players[0].role).toBe('Werewolf');
            expect(game.players[1].role).toBe('Robber');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Robber');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Robber');
            expect(game.nightLog[0].description).toContain('Alice');
            expect(game.nightLog[0].description).toContain('Bob');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('invalid player ID returns null', () => {
            const game = makeGame([makePlayer('robber1', 'Alice', 'Robber')]);
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', ['nonexistent']);

            expect(result).toBeNull();
        });

        test('center card target returns null', () => {
            const game = makeGame([makePlayer('robber1', 'Alice', 'Robber')]);
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });

        test('targeting self returns null', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', ['robber1']);

            expect(result).toBeNull();
            expect(game.nightLog).toHaveLength(0);
        });
    });

    describe('shielded', () => {
        test('shielded target blocks swap and returns info', () => {
            const game = makeGame([
                makePlayer('robber1', 'Alice', 'Robber'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Robber');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
            // Roles should NOT be swapped
            expect(game.players[0].role).toBe('Robber');
            expect(game.players[1].role).toBe('Werewolf');
        });
    });
});

// ─── Troublemaker Night Action ────────────────────────────

describe('Troublemaker Night Action', () => {
    describe('valid inputs', () => {
        test('swaps 2 players roles', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
                makePlayer('p2', 'Carol', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('swap');
            expect(result.message).toContain('Bob');
            expect(result.message).toContain('Carol');
            expect(game.players[1].role).toBe('Werewolf');
            expect(game.players[2].role).toBe('Seer');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
                makePlayer('p2', 'Carol', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Troublemaker');
            expect(game.nightLog[0].description).toContain('Bob');
            expect(game.nightLog[0].description).toContain('Carol');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('1 target returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).toBeNull();
        });

        test('invalid player ID returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'nonexistent']);

            expect(result).toBeNull();
        });

        test('center card targets returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', [0, 1]);

            expect(result).toBeNull();
        });

        test('3 targets returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
                makePlayer('p2', 'Carol', 'Werewolf'),
                makePlayer('p3', 'Dan', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2', 'p3']);

            expect(result).toBeNull();
            // Roles should be unchanged
            expect(game.players[1].role).toBe('Seer');
            expect(game.players[2].role).toBe('Werewolf');
            expect(game.players[3].role).toBe('Villager');
        });

        test('including self returns null', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['tm1', 'p1']);

            expect(result).toBeNull();
            // Roles should be unchanged
            expect(game.players[0].role).toBe('Troublemaker');
            expect(game.players[1].role).toBe('Seer');
        });
    });

    describe('shielded', () => {
        test('first target shielded blocks swap', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
                makePlayer('p2', 'Carol', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
            // Roles should NOT be swapped
            expect(game.players[1].role).toBe('Seer');
            expect(game.players[2].role).toBe('Werewolf');
        });

        test('second target shielded blocks swap', () => {
            const game = makeGame([
                makePlayer('tm1', 'Alice', 'Troublemaker'),
                makePlayer('p1', 'Bob', 'Seer'),
                makePlayer('p2', 'Carol', 'Werewolf'),
            ]);
            game.shielded = ['p2'];
            setNightIndexForRole(game, 'Troublemaker');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
        });
    });
});

// ─── Drunk Night Action ───────────────────────────────────

describe('Drunk Night Action', () => {
    describe('valid inputs', () => {
        test('swaps with center card (no reveal)', () => {
            const game = makeGame(
                [makePlayer('drunk1', 'Alice', 'Drunk')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Drunk');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('swap_center');
            // Drunk does NOT see what they swapped with
            expect(result.message).toContain('swapped');
            expect(game.players[0].role).toBe('Werewolf');
            expect(game.centerRoles[0]).toBe('Drunk');
        });

        test('creates nightLog entry', () => {
            const game = makeGame(
                [makePlayer('drunk1', 'Alice', 'Drunk')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Drunk');

            processNightAction(game, game.players[0], 'act', [1]);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Drunk');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([makePlayer('drunk1', 'Alice', 'Drunk')]);
            setNightIndexForRole(game, 'Drunk');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('player target returns null', () => {
            const game = makeGame([
                makePlayer('drunk1', 'Alice', 'Drunk'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Drunk');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).toBeNull();
        });

        test('out-of-bounds center index returns null', () => {
            const game = makeGame([makePlayer('drunk1', 'Alice', 'Drunk')]);
            setNightIndexForRole(game, 'Drunk');

            const result = processNightAction(game, game.players[0], 'act', [5]);

            expect(result).toBeNull();
        });

        test('2 center cards returns null', () => {
            const game = makeGame(
                [makePlayer('drunk1', 'Alice', 'Drunk')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Drunk');

            const result = processNightAction(game, game.players[0], 'act', [0, 1]);

            expect(result).toBeNull();
            // Role should be unchanged
            expect(game.players[0].role).toBe('Drunk');
            expect(game.centerRoles[0]).toBe('Werewolf');
            expect(game.centerRoles[1]).toBe('Seer');
        });
    });
});

// ─── Witch Night Action ───────────────────────────────────

describe('Witch Night Action', () => {
    describe('valid inputs', () => {
        test('views 1 center card only (no swap)', () => {
            const game = makeGame(
                [makePlayer('witch1', 'Alice', 'Witch')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('witch_result');
            expect(result.viewedCard).toBe('Werewolf');
            expect(result.swapped).toBe(false);
        });

        test('views center and swaps with player', () => {
            const game = makeGame(
                [
                    makePlayer('witch1', 'Alice', 'Witch'),
                    makePlayer('p1', 'Bob', 'Villager'),
                ],
                ['Werewolf', 'Seer', 'Tanner']
            );
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', [0, 'p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('witch_result');
            expect(result.viewedCard).toBe('Werewolf');
            expect(result.swapped).toBe(true);
            // Swap should have happened
            expect(game.players[1].role).toBe('Werewolf');
            expect(game.centerRoles[0]).toBe('Villager');
        });

        test('creates nightLog entry for view only', () => {
            const game = makeGame(
                [makePlayer('witch1', 'Alice', 'Witch')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Witch');

            processNightAction(game, game.players[0], 'act', [1]);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Witch');
        });

        test('creates nightLog entry for view and swap', () => {
            const game = makeGame(
                [
                    makePlayer('witch1', 'Alice', 'Witch'),
                    makePlayer('p1', 'Bob', 'Villager'),
                ],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Witch');

            processNightAction(game, game.players[0], 'act', [0, 'p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].description).toContain('swap');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([makePlayer('witch1', 'Alice', 'Witch')]);
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('only player target returns null', () => {
            const game = makeGame([
                makePlayer('witch1', 'Alice', 'Witch'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).toBeNull();
        });

        test('two center cards returns null', () => {
            const game = makeGame(
                [makePlayer('witch1', 'Alice', 'Witch')],
                ['Werewolf', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', [0, 1]);

            // Second arg must be player ID if present, not another center card
            expect(result).toBeNull();
        });
    });

    describe('shielded', () => {
        test('swap target shielded blocks swap but still views', () => {
            const game = makeGame(
                [
                    makePlayer('witch1', 'Alice', 'Witch'),
                    makePlayer('p1', 'Bob', 'Villager'),
                ],
                ['Werewolf', 'Seer', 'Villager']
            );
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Witch');

            const result = processNightAction(game, game.players[0], 'act', [0, 'p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('witch_result');
            // Should still see the center card
            expect(result.viewedCard).toBe('Werewolf');
            // But swap should be blocked
            expect(result.swapped).toBe(false);
            expect(result.shielded).toBe(true);
            expect(game.players[1].role).toBe('Villager');
            expect(game.centerRoles[0]).toBe('Werewolf');
        });
    });
});

// ─── Lone Wolf Night Action ───────────────────────────────

describe('Lone Wolf Night Action', () => {
    describe('valid inputs', () => {
        test('lone Werewolf peeks at center card', () => {
            const game = makeGame(
                [makePlayer('w1', 'Alice', 'Werewolf')],
                ['Tanner', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Werewolf');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Tanner']);
        });

        test('lone Alpha Wolf peeks at center card', () => {
            const game = makeGame(
                [makePlayer('aw1', 'Alice', 'Alpha Wolf')],
                ['Tanner', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Werewolf');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Tanner']);
        });

        test('lone Mystic Wolf peeks at center card', () => {
            const game = makeGame(
                [makePlayer('mw1', 'Alice', 'Mystic Wolf')],
                ['Tanner', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Werewolf');

            const result = processNightAction(game, game.players[0], 'act', [1]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Seer']);
        });

        test('creates nightLog entry', () => {
            const game = makeGame(
                [makePlayer('w1', 'Alice', 'Werewolf')],
                ['Tanner', 'Seer', 'Villager']
            );
            setNightIndexForRole(game, 'Werewolf');

            processNightAction(game, game.players[0], 'act', [2]);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Werewolf');
            expect(game.nightLog[0].description).toContain('lone');
        });
    });

    describe('invalid inputs', () => {
        test('player target returns null', () => {
            const game = makeGame([
                makePlayer('w1', 'Alice', 'Werewolf'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Werewolf');

            // Lone wolf should only peek center, not view players
            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).toBeNull();
        });

        test('out-of-bounds center index returns null', () => {
            const game = makeGame([makePlayer('w1', 'Alice', 'Werewolf')]);
            setNightIndexForRole(game, 'Werewolf');

            const result = processNightAction(game, game.players[0], 'act', [5]);

            expect(result).toBeNull();
        });

        test('negative center index returns null', () => {
            const game = makeGame([makePlayer('w1', 'Alice', 'Werewolf')]);
            setNightIndexForRole(game, 'Werewolf');

            const result = processNightAction(game, game.players[0], 'act', [-1]);

            expect(result).toBeNull();
        });
    });
});

// ─── Paranormal Investigator Night Action ─────────────────

describe('Paranormal Investigator Night Action', () => {
    describe('valid inputs', () => {
        test('investigates 1 player', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('pi_result');
            expect(result.viewed).toHaveLength(1);
            expect(result.viewed[0].role).toBe('Villager');
        });

        test('investigates 2 players', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
                makePlayer('p2', 'Carol', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('pi_result');
            expect(result.viewed).toHaveLength(2);
        });

        test('becomes Werewolf on first wolf sighting', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Werewolf'),
                makePlayer('p2', 'Carol', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.becameRole).toBe('Werewolf');
            expect(game.players[0].role).toBe('Werewolf');
            // Should only see first result (wolf) before stopping
            expect(result.viewed).toHaveLength(1);
        });

        test('becomes Tanner on tanner sighting', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
                makePlayer('p2', 'Carol', 'Tanner'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2']);

            expect(result).not.toBeNull();
            expect(result.becameRole).toBe('Tanner');
            expect(game.players[0].role).toBe('Tanner');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog.length).toBeGreaterThanOrEqual(1);
            expect(game.nightLog[0].role).toBe('Paranormal Investigator');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('center card target returns null', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });

        test('3 players returns null', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
                makePlayer('p2', 'Carol', 'Seer'),
                makePlayer('p3', 'Dan', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1', 'p2', 'p3']);

            expect(result).toBeNull();
        });

        test('invalid player ID returns null', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['nonexistent']);

            expect(result).toBeNull();
        });
    });

    describe('shielded', () => {
        test('shielded target shows shielded in result', () => {
            const game = makeGame([
                makePlayer('pi1', 'Alice', 'Paranormal Investigator'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Paranormal Investigator');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.viewed[0].role).toContain('Shielded');
            // PI should NOT become wolf since they couldn't see the role
            expect(game.players[0].role).toBe('Paranormal Investigator');
        });
    });
});

// ─── Sentinel Night Action ────────────────────────────────

describe('Sentinel Night Action', () => {
    describe('valid inputs', () => {
        test('shields a player', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shield');
        });

        test('player is in shielded array', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.shielded).toContain('p1');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Sentinel');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('self-shield returns null', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            const result = processNightAction(game, game.players[0], 'act', ['sent1']);

            expect(result).toBeNull();
            expect(game.shielded).not.toContain('sent1');
        });

        test('center card target returns null', () => {
            const game = makeGame([
                makePlayer('sent1', 'Alice', 'Sentinel'),
            ]);
            setNightIndexForRole(game, 'Sentinel');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });
    });
});

// ─── Alpha Wolf Night Action ──────────────────────────────

describe('Alpha Wolf Night Action', () => {
    describe('valid inputs', () => {
        test('transforms non-wolf into Werewolf', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Alpha Wolf');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('Werewolf');
            expect(game.players[1].role).toBe('Werewolf');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Alpha Wolf');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Alpha Wolf');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Alpha Wolf');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('center card target returns null', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
            ]);
            setNightIndexForRole(game, 'Alpha Wolf');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });
    });

    describe('edge cases', () => {
        test('targeting wolf returns info message', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
                makePlayer('w1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Alpha Wolf');

            const result = processNightAction(game, game.players[0], 'act', ['w1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('already a Wolf');
        });

        test('targeting shielded player blocked', () => {
            const game = makeGame([
                makePlayer('aw1', 'Alice', 'Alpha Wolf'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Alpha Wolf');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
            // Role should NOT change
            expect(game.players[1].role).toBe('Villager');
        });
    });
});

// ─── Mystic Wolf Night Action ─────────────────────────────

describe('Mystic Wolf Night Action', () => {
    describe('valid inputs', () => {
        test('views player role', () => {
            const game = makeGame([
                makePlayer('mw1', 'Alice', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Mystic Wolf');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view');
            expect(result.role).toBe('Seer');
            expect(result.name).toBe('Bob');
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('mw1', 'Alice', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Mystic Wolf');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Mystic Wolf');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('mw1', 'Alice', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            setNightIndexForRole(game, 'Mystic Wolf');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('center card target returns null', () => {
            const game = makeGame([
                makePlayer('mw1', 'Alice', 'Mystic Wolf'),
            ]);
            setNightIndexForRole(game, 'Mystic Wolf');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });
    });

    describe('shielded', () => {
        test('shielded target shows blocked message', () => {
            const game = makeGame([
                makePlayer('mw1', 'Alice', 'Mystic Wolf'),
                makePlayer('p1', 'Bob', 'Seer'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Mystic Wolf');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
        });
    });
});

// ─── Apprentice Seer Night Action ─────────────────────────

describe('Apprentice Seer Night Action', () => {
    describe('valid inputs', () => {
        test('views 1 center card', () => {
            const game = makeGame(
                [makePlayer('as1', 'Alice', 'Apprentice Seer')],
                ['Werewolf', 'Tanner', 'Villager']
            );
            setNightIndexForRole(game, 'Apprentice Seer');

            const result = processNightAction(game, game.players[0], 'act', [1]);

            expect(result).not.toBeNull();
            expect(result.type).toBe('view_center');
            expect(result.cards).toEqual(['Tanner']);
        });

        test('creates nightLog entry', () => {
            const game = makeGame(
                [makePlayer('as1', 'Alice', 'Apprentice Seer')],
                ['Werewolf', 'Tanner', 'Villager']
            );
            setNightIndexForRole(game, 'Apprentice Seer');

            processNightAction(game, game.players[0], 'act', [0]);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Apprentice Seer');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([makePlayer('as1', 'Alice', 'Apprentice Seer')]);
            setNightIndexForRole(game, 'Apprentice Seer');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('2 center cards returns null', () => {
            const game = makeGame([makePlayer('as1', 'Alice', 'Apprentice Seer')]);
            setNightIndexForRole(game, 'Apprentice Seer');

            const result = processNightAction(game, game.players[0], 'act', [0, 1]);

            expect(result).toBeNull();
        });

        test('player target returns null', () => {
            const game = makeGame([
                makePlayer('as1', 'Alice', 'Apprentice Seer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Apprentice Seer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).toBeNull();
        });

        test('out-of-bounds returns null', () => {
            const game = makeGame([makePlayer('as1', 'Alice', 'Apprentice Seer')]);
            setNightIndexForRole(game, 'Apprentice Seer');

            const result = processNightAction(game, game.players[0], 'act', [5]);

            expect(result).toBeNull();
        });
    });
});

// ─── Revealer Night Action ────────────────────────────────

describe('Revealer Night Action', () => {
    describe('valid inputs', () => {
        test('reveals wolf - stays face up', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('reveal');
            expect(result.role).toBe('Werewolf');
            expect(result.staysRevealed).toBe(true);
            expect(game.revealed).toContainEqual(expect.objectContaining({ id: 'p1' }));
        });

        test('reveals non-wolf - flips back', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('reveal');
            expect(result.role).toBe('Villager');
            expect(result.staysRevealed).toBe(false);
            // Should NOT be in revealed array since it flipped back
            expect(game.revealed.find(r => r.id === 'p1')).toBeUndefined();
        });

        test('reveals tanner - stays face up', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Tanner'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('reveal');
            expect(result.role).toBe('Tanner');
            expect(result.staysRevealed).toBe(true);
            expect(game.revealed).toContainEqual(expect.objectContaining({ id: 'p1' }));
        });

        test('creates nightLog entry', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Villager'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            processNightAction(game, game.players[0], 'act', ['p1']);

            expect(game.nightLog).toHaveLength(1);
            expect(game.nightLog[0].role).toBe('Revealer');
        });
    });

    describe('invalid inputs', () => {
        test('0 targets returns null', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', []);

            expect(result).toBeNull();
        });

        test('center card target returns null', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
            ]);
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', [0]);

            expect(result).toBeNull();
        });
    });

    describe('shielded', () => {
        test('shielded target blocked', () => {
            const game = makeGame([
                makePlayer('rev1', 'Alice', 'Revealer'),
                makePlayer('p1', 'Bob', 'Werewolf'),
            ]);
            game.shielded = ['p1'];
            setNightIndexForRole(game, 'Revealer');

            const result = processNightAction(game, game.players[0], 'act', ['p1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('info');
            expect(result.message).toContain('shielded');
            expect(game.revealed).toHaveLength(0);
        });
    });
});
