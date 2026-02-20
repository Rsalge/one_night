import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { RoleCard, RoleInfoModal } from '../components/RoleCard';
import { ROLES, getAllRoles } from '../types/roles';
import type { RoleId, Team } from '../types';

export function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { 
    players, 
    isHost, 
    selectedRoles, 
    selectRoles, 
    startGame, 
    leaveGame, 
    error,
    clearError,
    phase,
    roomCode,
  } = useGame();

  const [roleFilter, setRoleFilter] = useState<'all' | Team>('all');
  const [selectedRoleInfo, setSelectedRoleInfo] = useState<RoleId | null>(null);

  // Navigate to game when game starts
  useEffect(() => {
    if (phase === 'role_reveal' || phase === 'night' || phase === 'day') {
      navigate('/game');
    }
  }, [phase, navigate]);

  // If no room code, go back home
  useEffect(() => {
    if (!roomCode) {
      navigate('/');
    }
  }, [roomCode, navigate]);

  const allRoles = useMemo(() => getAllRoles(), []);

  const filteredRoles = useMemo(() => {
    if (roleFilter === 'all') return allRoles;
    return allRoles.filter((r) => r.team === roleFilter);
  }, [allRoles, roleFilter]);

  const requiredCards = players.length + 3;
  const currentCardCount = selectedRoles.length;
  const canStart = currentCardCount === requiredCards && players.length >= 3;

  const roleCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of selectedRoles) {
      counts[role] = (counts[role] ?? 0) + 1;
    }
    return counts;
  }, [selectedRoles]);

  const toggleRole = (roleId: RoleId) => {
    if (!isHost) return;

    const currentCount = roleCountMap[roleId] ?? 0;
    const roleDefinition = ROLES[roleId];
    if (!roleDefinition) return;
    
    const maxCount = roleDefinition.maxCount;

    if (currentCount < maxCount) {
      selectRoles([...selectedRoles, roleId]);
    } else {
      // Remove one instance of this role
      const newRoles = [...selectedRoles];
      const index = newRoles.indexOf(roleId);
      if (index !== -1) {
        newRoles.splice(index, 1);
      }
      selectRoles(newRoles);
    }
  };

  const handleRoleLongPress = (roleId: RoleId) => {
    setSelectedRoleInfo(roleId);
  };

  const handleLeave = () => {
    leaveGame();
    navigate('/');
  };

  const handleStart = () => {
    startGame();
  };

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleLeave}
              className="text-gray-400 hover:text-white transition-colors p-2 -ml-2"
            >
              ← Leave
            </button>
            <div className="text-center">
              <div className="text-xs text-gray-400">Room Code</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-[0.2em] font-mono">
                {code ?? roomCode}
              </div>
            </div>
            <div className="w-16" />
          </div>

          {/* Players */}
          <div className="mb-4">
            <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
              Players ({players.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`player-chip ${player.isHost ? 'host' : ''} ${player.disconnected ? 'disconnected' : ''}`}
                >
                  {player.isHost && <span className="mr-1">👑</span>}
                  {player.name}
                </div>
              ))}
            </div>
          </div>

          {/* Card count */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/50">
            <span className="text-gray-300 text-sm">Cards selected</span>
            <span className={`font-bold text-lg ${currentCardCount === requiredCards ? 'text-green-400' : 'text-amber-400'}`}>
              {currentCardCount} / {requiredCards}
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-900/50 border border-red-500 text-red-200 text-sm">
              {error}
              <button 
                onClick={clearError}
                className="ml-2 text-red-400 hover:text-white"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Role selection */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {isHost ? 'Select Roles' : 'Roles in Game'}
            </h2>

            {/* Filter */}
            <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
              {(['all', 'villager', 'werewolf', 'tanner'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRoleFilter(filter)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
                    ${roleFilter === filter
                      ? 'bg-amber-600 text-white'
                      : 'bg-indigo-900/50 text-gray-400 hover:text-white'
                    }
                  `}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isHost && (
            <p className="text-gray-400 text-xs mb-4">
              Tap to add/remove roles. Long press for details.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {filteredRoles.map((role) => {
              const count = roleCountMap[role.id] ?? 0;
              return (
                <div
                  key={role.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleRoleLongPress(role.id);
                  }}
                >
                  <RoleCard
                    roleId={role.id}
                    selected={count > 0}
                    count={count > 0 ? count : undefined}
                    onClick={isHost ? () => toggleRole(role.id) : () => handleRoleLongPress(role.id)}
                    showAbility={true}
                    size="sm"
                  />
                </div>
              );
            })}
          </div>

          {/* Start button */}
          {isHost && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="btn-primary w-full text-lg disabled:opacity-50"
              >
                {players.length < 3
                  ? `Need ${3 - players.length} more player${3 - players.length > 1 ? 's' : ''}`
                  : currentCardCount < requiredCards
                    ? `Add ${requiredCards - currentCardCount} more card${requiredCards - currentCardCount > 1 ? 's' : ''}`
                    : currentCardCount > requiredCards
                      ? `Remove ${currentCardCount - requiredCards} card${currentCardCount - requiredCards > 1 ? 's' : ''}`
                      : '🎮 Start Game'
                }
              </button>
            </div>
          )}

          {!isHost && (
            <div className="mt-6 pt-4 border-t border-gray-700 text-center">
              <div className="text-gray-400 text-sm">
                Waiting for host to start the game...
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedRoleInfo && (
        <RoleInfoModal
          roleId={selectedRoleInfo}
          onClose={() => setSelectedRoleInfo(null)}
        />
      )}
    </div>
  );
}
