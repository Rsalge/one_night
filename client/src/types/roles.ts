import type { RoleId, Team, RoleDefinition } from './index';

// Re-export RoleDefinition for convenience
export type { RoleDefinition };

// One Night backend uses these exact role names (with spaces)
export const ROLES: Record<RoleId, RoleDefinition> = {
  // ==================== WEREWOLF TEAM ====================
  'Werewolf': {
    id: 'Werewolf',
    name: 'Werewolf',
    team: 'werewolf',
    wakeOrder: 2,
    maxCount: 2,
    emoji: '🐺',
    description: 'A fearsome creature of the night.',
    ability: 'Wake with other Werewolves and see each other. If you are the only Werewolf, you may look at one center card.',
    strategy: 'Coordinate with your fellow wolves (if any). Claim a safe village role like Villager or Insomniac.',
  },
  'Alpha Wolf': {
    id: 'Alpha Wolf',
    name: 'Alpha Wolf',
    team: 'werewolf',
    wakeOrder: 3,
    maxCount: 1,
    emoji: '🐺',
    description: 'The leader of the pack with the power to turn others.',
    ability: 'Wake with other Werewolves, then choose a player to swap their card with the Center Werewolf card.',
    strategy: 'Use your power to create chaos. Turn a confirmed villager into a Werewolf.',
  },
  'Mystic Wolf': {
    id: 'Mystic Wolf',
    name: 'Mystic Wolf',
    team: 'werewolf',
    wakeOrder: 4,
    maxCount: 1,
    emoji: '🔮',
    description: 'A wolf with supernatural sight.',
    ability: 'Wake with other Werewolves, then look at one other player\'s card.',
    strategy: 'Your extra information is powerful. Know exactly who to defend or accuse.',
  },
  'Dream Wolf': {
    id: 'Dream Wolf',
    name: 'Dream Wolf',
    team: 'werewolf',
    wakeOrder: null,
    maxCount: 1,
    emoji: '💤',
    description: 'A wolf lost in slumber, unaware of the pack.',
    ability: 'You are a Werewolf but you do NOT wake up with the other Werewolves.',
    strategy: 'You have plausible deniability - you truly don\'t know who the other wolves are.',
  },
  'Minion': {
    id: 'Minion',
    name: 'Minion',
    team: 'werewolf',
    wakeOrder: 5,
    maxCount: 1,
    emoji: '😈',
    description: 'A loyal servant of the wolves.',
    ability: 'See who the Werewolves are (but they don\'t see you). You win with them even if you die.',
    strategy: 'Protect your wolves at all costs! Throw suspicion elsewhere.',
  },

  // ==================== VILLAGE TEAM: SEERS ====================
  'Seer': {
    id: 'Seer',
    name: 'Seer',
    team: 'villager',
    wakeOrder: 7,
    maxCount: 1,
    emoji: '👁️',
    description: 'Gifted with supernatural vision.',
    ability: 'Look at one player\'s card OR look at two center cards.',
    strategy: 'Your information is crucial! Speak up early and confidently.',
  },
  'Apprentice Seer': {
    id: 'Apprentice Seer',
    name: 'Apprentice Seer',
    team: 'villager',
    wakeOrder: 8,
    maxCount: 1,
    emoji: '🔍',
    description: 'A student of the mystical arts.',
    ability: 'Look at one center card.',
    strategy: 'Your info helps narrow down possibilities.',
  },
  'Paranormal Investigator': {
    id: 'Paranormal Investigator',
    name: 'Paranormal Investigator',
    team: 'villager',
    wakeOrder: 9,
    maxCount: 1,
    emoji: '🕵️',
    description: 'Investigator of the supernatural... sometimes too close.',
    ability: 'Look at up to 2 players\' cards. If you see a Werewolf or Tanner, you BECOME that role.',
    strategy: 'Risky but rewarding! You might find wolves, or you might become one.',
  },

  // ==================== VILLAGE TEAM: SWAPPERS ====================
  'Robber': {
    id: 'Robber',
    name: 'Robber',
    team: 'villager',
    wakeOrder: 10,
    maxCount: 1,
    emoji: '🦹',
    description: 'A thief who steals identities.',
    ability: 'Swap your card with another player\'s card, then look at your NEW card.',
    strategy: 'You know your final role for certain. Decide whether to reveal it.',
  },
  'Witch': {
    id: 'Witch',
    name: 'Witch',
    team: 'villager',
    wakeOrder: 11,
    maxCount: 1,
    emoji: '🧙‍♀️',
    description: 'A practitioner of dark magic.',
    ability: 'Look at one center card. You may then swap it with any player\'s card.',
    strategy: 'You can plant a Werewolf card on someone, or give yourself a better role.',
  },
  'Troublemaker': {
    id: 'Troublemaker',
    name: 'Troublemaker',
    team: 'villager',
    wakeOrder: 12,
    maxCount: 1,
    emoji: '🃏',
    description: 'Loves causing confusion.',
    ability: 'Swap two OTHER players\' cards without looking at them.',
    strategy: 'Announce your swap! The players involved might now be on different teams.',
  },
  'Drunk': {
    id: 'Drunk',
    name: 'Drunk',
    team: 'villager',
    wakeOrder: 13,
    maxCount: 1,
    emoji: '🍺',
    description: 'Too inebriated to remember anything.',
    ability: 'Swap your card with a center card WITHOUT looking at it.',
    strategy: 'You could be anything! Watch others\' reactions carefully.',
  },

  // ==================== VILLAGE TEAM: SPECIAL ====================
  'Mason': {
    id: 'Mason',
    name: 'Mason',
    team: 'villager',
    wakeOrder: 6,
    maxCount: 2,
    emoji: '🤝',
    description: 'Members of a secret society.',
    ability: 'Wake with the other Mason(s) and see each other.',
    strategy: 'Immediately confirm each other during the day!',
  },
  'Sentinel': {
    id: 'Sentinel',
    name: 'Sentinel',
    team: 'villager',
    wakeOrder: 1,
    maxCount: 1,
    emoji: '🛡️',
    description: 'A protector who shields others.',
    ability: 'Place a shield on another player. Their card cannot be viewed or moved.',
    strategy: 'Protect someone you suspect is important. Or shield yourself!',
  },
  'Revealer': {
    id: 'Revealer',
    name: 'Revealer',
    team: 'villager',
    wakeOrder: 15,
    maxCount: 1,
    emoji: '🔦',
    description: 'Exposes the truth for all to see.',
    ability: 'Look at one player\'s card. If it\'s NOT a Werewolf or Tanner, it stays face-up!',
    strategy: 'If you reveal a villager, they\'re confirmed! If it doesn\'t flip, you found evil.',
  },
  'Insomniac': {
    id: 'Insomniac',
    name: 'Insomniac',
    team: 'villager',
    wakeOrder: 14,
    maxCount: 1,
    emoji: '😵',
    description: 'Can\'t sleep and sees the truth.',
    ability: 'Wake at the END of the night and look at your own card.',
    strategy: 'Powerful confirmation! If your card changed, someone moved it.',
  },
  'Hunter': {
    id: 'Hunter',
    name: 'Hunter',
    team: 'villager',
    wakeOrder: null,
    maxCount: 1,
    emoji: '🏹',
    description: 'Never goes down without a fight.',
    ability: 'No night action. If you are killed, the player YOU voted for also dies!',
    strategy: 'Make sure you vote for a wolf!',
  },
  'Villager': {
    id: 'Villager',
    name: 'Villager',
    team: 'villager',
    wakeOrder: null,
    maxCount: 3,
    emoji: '👤',
    description: 'An ordinary member of the village.',
    ability: 'No special ability. You don\'t wake up at night.',
    strategy: 'Listen carefully and help find the wolves!',
  },

  // ==================== TANNER TEAM ====================
  'Tanner': {
    id: 'Tanner',
    name: 'Tanner',
    team: 'tanner',
    wakeOrder: null,
    maxCount: 1,
    emoji: '💀',
    description: 'Hates life and wants to die.',
    ability: 'No night action. You WIN if you are killed by the village vote!',
    strategy: 'Act suspicious but not TOO suspicious.',
  },
};

// Helper functions
export function getRoleName(roleId: string): string {
  const role = ROLES[roleId as RoleId];
  return role?.name ?? roleId;
}

export function getRoleTeam(roleId: string): Team {
  const role = ROLES[roleId as RoleId];
  return role?.team ?? 'villager';
}

export function getRoleDescription(roleId: string): string {
  const role = ROLES[roleId as RoleId];
  return role?.description ?? '';
}

export function getRoleAbility(roleId: string): string {
  const role = ROLES[roleId as RoleId];
  return role?.ability ?? '';
}

export function getRoleStrategy(roleId: string): string {
  const role = ROLES[roleId as RoleId];
  return role?.strategy ?? '';
}

export function getRoleEmoji(roleId: string): string {
  const role = ROLES[roleId as RoleId];
  return role?.emoji ?? '❓';
}

export function getRolesByWakeOrder(): RoleDefinition[] {
  return Object.values(ROLES)
    .filter((r) => r.wakeOrder !== null)
    .sort((a, b) => (a.wakeOrder ?? 0) - (b.wakeOrder ?? 0));
}

export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLES);
}

export function getRolesByTeam(team: Team): RoleDefinition[] {
  return Object.values(ROLES).filter((r) => r.team === team);
}

// Check if a role is in the werewolf team (for win conditions)
export function isWerewolfTeam(roleId: string): boolean {
  const team = getRoleTeam(roleId);
  return team === 'werewolf';
}

// Check if a role is in the village team
export function isVillagerTeam(roleId: string): boolean {
  const team = getRoleTeam(roleId);
  return team === 'villager';
}
