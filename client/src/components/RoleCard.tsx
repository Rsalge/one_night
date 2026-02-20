import { useState } from 'react';
import type { Team } from '../types';
import { ROLES } from '../types/roles';

interface RoleCardProps {
  roleId: string;
  selected?: boolean;
  count?: number;
  onClick?: () => void;
  showDescription?: boolean;
  showAbility?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const teamGradients: Record<Team, string> = {
  werewolf: 'from-red-900/50 to-red-800/30',
  villager: 'from-green-900/50 to-green-800/30',
  tanner: 'from-purple-900/50 to-purple-800/30',
};

const teamBadgeColors: Record<Team, string> = {
  werewolf: 'bg-red-600',
  villager: 'bg-green-600',
  tanner: 'bg-purple-600',
};

export function RoleCard({
  roleId,
  selected,
  count,
  onClick,
  showDescription = false,
  showAbility = false,
  size = 'md',
}: RoleCardProps) {
  const role = ROLES[roleId as keyof typeof ROLES];
  if (!role) {
    // Fallback for unknown roles
    return (
      <div className={`role-card ${onClick ? 'clickable' : ''} p-3 bg-gradient-to-br from-gray-900/50 to-gray-800/30`} onClick={onClick}>
        <div className="flex items-center gap-2">
          <span className="text-xl">❓</span>
          <span className="font-bold text-white">{roleId}</span>
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'p-2 sm:p-3',
    md: 'p-3 sm:p-4',
    lg: 'p-4 sm:p-6',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      onClick={onClick}
      className={`
        role-card ${role.team}
        ${selected ? 'selected' : ''}
        ${onClick ? 'clickable' : ''}
        ${sizeClasses[size]}
        bg-gradient-to-br ${teamGradients[role.team]}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">{role.emoji}</span>
          <h3 className={`font-bold text-white ${textSizes[size]}`}>{role.name}</h3>
        </div>
        <span className={`${teamBadgeColors[role.team]} px-2 py-0.5 rounded-full text-xs font-semibold text-white capitalize shrink-0`}>
          {role.team}
        </span>
      </div>

      {count !== undefined && count > 0 && (
        <div className="text-amber-400 text-sm font-medium mb-1">
          {count}x selected
        </div>
      )}

      {showDescription && (
        <p className="text-gray-400 text-sm italic mb-2">{role.description}</p>
      )}

      {showAbility && (
        <p className="text-gray-300 text-sm">{role.ability}</p>
      )}

      {role.wakeOrder !== null && size !== 'sm' && (
        <div className="text-gray-500 text-xs mt-2 flex items-center gap-1">
          <span>⏱️</span>
          <span>Wake #{role.wakeOrder}</span>
        </div>
      )}
    </div>
  );
}

interface RoleCardRevealProps {
  roleId: string;
  showStrategy?: boolean;
}

export function RoleCardReveal({ roleId, showStrategy = true }: RoleCardRevealProps) {
  const role = ROLES[roleId as keyof typeof ROLES];
  if (!role) {
    // Fallback for unknown roles
    return (
      <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4">
        <div className="role-reveal-card villager w-full">
          <span className="text-7xl sm:text-8xl mb-4">❓</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{roleId}</h2>
          <p className="text-white/80 text-sm sm:text-base text-center mb-4 italic">
            Unknown role
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto px-4">
      <div className={`role-reveal-card ${role.team} w-full`}>
        <span className="text-7xl sm:text-8xl mb-4">{role.emoji}</span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{role.name}</h2>
        <p className="text-white/80 text-sm sm:text-base text-center mb-4 italic">
          {role.description}
        </p>
        <div className="bg-black/20 rounded-xl p-3 w-full">
          <p className="text-white/90 text-sm text-center">{role.ability}</p>
        </div>
      </div>

      {showStrategy && (
        <div className="mt-4 p-4 rounded-xl bg-indigo-900/50 w-full">
          <h3 className="text-amber-400 font-semibold mb-2 text-sm">💡 Strategy Tip</h3>
          <p className="text-gray-300 text-sm">{role.strategy}</p>
        </div>
      )}
    </div>
  );
}

interface RoleInfoModalProps {
  roleId: string;
  onClose: () => void;
}

export function RoleInfoModal({ roleId, onClose }: RoleInfoModalProps) {
  const role = ROLES[roleId as keyof typeof ROLES];
  if (!role) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
        <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-white mb-4">❓ {roleId}</h2>
          <p className="text-gray-400">Unknown role</p>
          <button onClick={onClose} className="btn-secondary w-full mt-6">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{role.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{role.name}</h2>
              <span className={`${teamBadgeColors[role.team]} px-2 py-0.5 rounded-full text-xs font-semibold text-white capitalize`}>
                {role.team} team
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-gray-400 italic mb-4">{role.description}</p>

        <div className="space-y-4">
          <div>
            <h3 className="text-amber-400 font-semibold mb-1 flex items-center gap-2">
              <span>⚡</span> Ability
            </h3>
            <p className="text-gray-300 text-sm">{role.ability}</p>
          </div>

          <div>
            <h3 className="text-amber-400 font-semibold mb-1 flex items-center gap-2">
              <span>💡</span> Strategy
            </h3>
            <p className="text-gray-300 text-sm">{role.strategy}</p>
          </div>

          {role.wakeOrder !== null && (
            <div className="text-gray-500 text-sm flex items-center gap-2">
              <span>⏱️</span>
              <span>Wakes up #{role.wakeOrder} during the night</span>
            </div>
          )}

          {role.wakeOrder === null && (
            <div className="text-gray-500 text-sm flex items-center gap-2">
              <span>😴</span>
              <span>Does not wake up at night</span>
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-6">
          Close
        </button>
      </div>
    </div>
  );
}

interface CheatSheetProps {
  onClose: () => void;
  selectedRoles?: string[];
}

export function CheatSheet({ onClose, selectedRoles }: CheatSheetProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Team>('all');

  const rolesToShow = selectedRoles
    ? Object.values(ROLES).filter((r) => selectedRoles.includes(r.id))
    : Object.values(ROLES);

  const filteredRoles = filter === 'all'
    ? rolesToShow
    : rolesToShow.filter((r) => r.team === filter);

  // Sort by wake order (null = end)
  const sortedRoles = [...filteredRoles].sort((a, b) => {
    if (a.wakeOrder === null && b.wakeOrder === null) return 0;
    if (a.wakeOrder === null) return 1;
    if (b.wakeOrder === null) return -1;
    return a.wakeOrder - b.wakeOrder;
  });

  return (
    <div className="cheat-sheet safe-area-inset">
      <div className="max-w-2xl mx-auto p-4 pb-8">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-900/95 backdrop-blur py-4 -mx-4 px-4 z-10">
          <h2 className="text-xl font-bold text-white">Role Reference</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['all', 'villager', 'werewolf', 'tanner'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                ${filter === f
                  ? 'bg-amber-600 text-white'
                  : 'bg-indigo-900/50 text-gray-400 hover:text-white'
                }
              `}
            >
              {f === 'all' ? 'All Roles' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Role list */}
        <div className="space-y-2">
          {sortedRoles.map((role) => (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`
                p-3 rounded-xl cursor-pointer transition-all
                bg-gradient-to-r ${teamGradients[role.team]}
                border-l-4 ${role.team === 'werewolf' ? 'border-red-500' : role.team === 'tanner' ? 'border-purple-500' : 'border-green-500'}
                hover:bg-opacity-80 active:scale-[0.98]
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{role.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{role.name}</span>
                    {role.wakeOrder !== null && (
                      <span className="text-gray-500 text-xs">#{role.wakeOrder}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">{role.ability}</p>
                </div>
                <span className="text-gray-500">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRole && (
        <RoleInfoModal roleId={selectedRole} onClose={() => setSelectedRole(null)} />
      )}
    </div>
  );
}
