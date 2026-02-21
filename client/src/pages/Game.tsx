import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { CheatSheet, SwipeableRoleCard } from '../components/RoleCard';
import { ROLES, getRoleName, getRoleEmoji, getRoleTeam } from '../types/roles';

export function Game() {
  const navigate = useNavigate();
  const {
    phase,
    players,
    myRole,
    originalRole,
    nightTurn,
    nightAction,
    actionResult,
    gameResult,
    isHost,
    selectedRoles,
    roomCode,
    socketId,
    voteCount,
    hasVoted,
    roleReadyCount,
    confirmRoleReady,
    submitNightAction,
    acknowledgeNightResult,
    castVote,
    restartGame,
    leaveGame,
    forceStartNight,
  } = useGame();

  const [selectedTargets, setSelectedTargets] = useState<(string | number)[]>([]);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [myVoteTarget, setMyVoteTarget] = useState<string | null>(null);
  const [hasRevealedRole, setHasRevealedRole] = useState(false);
  const [hasConfirmedReady, setHasConfirmedReady] = useState(false);

  // Navigate back to home if no room
  useEffect(() => {
    if (!roomCode) {
      navigate('/');
    }
  }, [roomCode, navigate]);

  // Reset selected targets when night action changes
  useEffect(() => {
    setSelectedTargets([]);
  }, [nightAction]);

  // Reset role reveal states when phase changes (new game)
  useEffect(() => {
    if (phase === 'role_reveal') {
      setHasRevealedRole(false);
      setHasConfirmedReady(false);
    }
  }, [phase]);

  const handleLeave = () => {
    leaveGame();
    navigate('/');
  };

  // Role Reveal Phase
  if (phase === 'role_reveal' && myRole) {
    const handleRoleReveal = () => {
      setHasRevealedRole(true);
    };

    const handleRoleHide = () => {
      setHasRevealedRole(false);
    };

    const handleConfirmReady = () => {
      setHasConfirmedReady(true);
      confirmRoleReady();
    };

    // Waiting state - after confirming ready
    if (hasConfirmedReady) {
      return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 safe-area-inset">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🌙</div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Waiting for Others...</h1>
            <p className="text-gray-400 text-sm">The night will begin when everyone is ready</p>
          </div>

          {/* Ready count display */}
          <div className="card w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-amber-400">
                {roleReadyCount.ready} / {roleReadyCount.total}
              </div>
              <p className="text-gray-400 text-sm mt-1">players ready</p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-indigo-900 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${roleReadyCount.total > 0 ? (roleReadyCount.ready / roleReadyCount.total) * 100 : 0}%` }}
              />
            </div>

            {/* Player indicators */}
            <div className="flex flex-wrap justify-center gap-2">
              {players.map((player) => {
                const isReady = roleReadyCount.confirmedPlayerIds.includes(player.id);
                const isDisconnected = player.disconnected || false;
                
                let colorClass = 'bg-gray-600'; // Default: not ready
                if (isDisconnected) {
                  colorClass = 'bg-red-500 animate-pulse'; // Disconnected
                } else if (isReady) {
                  colorClass = 'bg-green-500'; // Ready
                }
                
                return (
                  <div
                    key={player.id}
                    className={`w-3 h-3 rounded-full transition-colors duration-300 ${colorClass}`}
                    title={`${player.name}${isDisconnected ? ' (Disconnected)' : isReady ? ' (Ready)' : ' (Waiting...)'}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Your role reminder */}
          <div className="mt-6 p-4 rounded-xl bg-indigo-900/30 max-w-sm w-full">
            <div className="text-xs text-gray-400 mb-1 text-center">Your role</div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">{ROLES[myRole as keyof typeof ROLES]?.emoji ?? '❓'}</span>
              <span className="text-white font-semibold text-lg">{ROLES[myRole as keyof typeof ROLES]?.name ?? myRole}</span>
            </div>
          </div>
        </div>
      );
    }

    // Swipeable card with ready button (shown once user has revealed at least once)
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 safe-area-inset">
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Your Role</h1>
        </div>

        <SwipeableRoleCard
          roleId={myRole}
          onReveal={handleRoleReveal}
          onHide={handleRoleHide}
          revealed={hasRevealedRole}
        />

        <button
          onClick={handleConfirmReady}
          className="btn-primary w-full max-w-sm mt-6 text-lg py-4"
        >
          I'm Ready for Night
        </button>

        {/* Host-only force start button */}
        {isHost && roleReadyCount.ready < roleReadyCount.total && (
          <button
            onClick={forceStartNight}
            className="btn-danger w-full max-w-sm mt-2 text-sm py-2"
          >
            Force Start Night (Host Only)
          </button>
        )}

        <p className="text-gray-500 text-xs text-center mt-3 max-w-sm">
          {roleReadyCount.ready} of {roleReadyCount.total} players ready
        </p>
      </div>
    );
  }

  // Night Phase - Waiting / Non-interactive turn
  if (phase === 'night' && nightTurn && !nightAction) {
    const isMyTurn = nightTurn.activePlayerIds.includes(socketId ?? '');

    return (
      <div className="night-cover safe-area-inset">
        <div className="text-8xl sm:text-9xl moon-glow mb-8">🌕</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Night has fallen...</h1>
        <div className="max-w-sm text-center space-y-3">
          {isMyTurn && !nightTurn.isInteractive ? (
            <>
              <p className="text-indigo-300 font-medium">
                {nightTurn.flavor}
              </p>
              {actionResult && (
                <div className="mt-4 p-4 rounded-xl bg-indigo-900/50 border border-indigo-500 text-left">
                  {actionResult.type === 'info' && (
                    <p className="text-white">{actionResult.message}</p>
                  )}
                  {actionResult.type === 'view' && (
                    <p className="text-white">
                      {actionResult.name}'s card is: <span className="text-amber-400 font-semibold">{getRoleEmoji(actionResult.role ?? '')} {actionResult.role}</span>
                    </p>
                  )}
                </div>
              )}
              {actionResult && (
                <button onClick={acknowledgeNightResult} className="btn-primary mt-4">
                  Continue
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-400">
                Focus on your screen.
              </p>
              <p className="text-gray-400">
                Hide the contents from others.
              </p>
              <p className="text-indigo-400 text-sm mt-6">
                Tap occasionally. Pretend to scroll.
              </p>
            </>
          )}
        </div>
        <div className="mt-8 text-gray-500 text-sm animate-pulse">
          {nightTurn.activeRole ? `${nightTurn.activeRole} is acting...` : 'Players are performing their night actions...'}
        </div>
      </div>
    );
  }

  // Night Phase - Interactive Action Screen
  if (phase === 'night' && nightAction) {
    const role = ROLES[nightAction.role as keyof typeof ROLES];
    const emoji = role?.emoji ?? '🌙';
    const roleName = role?.name ?? nightAction.role;

    const handleTargetSelect = (targetId: string | number) => {
      // Special handling for center cards with Seer (need 2 center OR 1 player)
      const isCenterCard = typeof targetId === 'number';
      const hasPlayerSelected = selectedTargets.some(t => typeof t === 'string');

      if (nightAction.role === 'Seer') {
        // Seer: 1 player OR 2 center cards
        if (isCenterCard) {
          if (hasPlayerSelected) {
            setSelectedTargets([targetId]);
          } else if (selectedTargets.includes(targetId)) {
            setSelectedTargets(selectedTargets.filter(t => t !== targetId));
          } else if (selectedTargets.length < 2) {
            setSelectedTargets([...selectedTargets, targetId]);
          } else {
            setSelectedTargets([selectedTargets[1], targetId]);
          }
        } else {
          // Player selected - only allow 1
          if (selectedTargets.includes(targetId)) {
            setSelectedTargets([]);
          } else {
            setSelectedTargets([targetId]);
          }
        }
        return;
      }

      // Default toggle behavior
      if (selectedTargets.includes(targetId)) {
        setSelectedTargets(selectedTargets.filter(t => t !== targetId));
      } else if (selectedTargets.length < nightAction.maxSelections) {
        setSelectedTargets([...selectedTargets, targetId]);
      } else if (nightAction.maxSelections === 1) {
        setSelectedTargets([targetId]);
      } else {
        setSelectedTargets([...selectedTargets.slice(1), targetId]);
      }
    };

    const canSubmit = () => {
      if (selectedTargets.length === 0) return false;

      // Seer: 1 player OR 2 center cards
      if (nightAction.role === 'Seer') {
        const centerCount = selectedTargets.filter(t => typeof t === 'number').length;
        const playerCount = selectedTargets.filter(t => typeof t === 'string').length;
        return centerCount === 2 || playerCount === 1;
      }

      // Troublemaker: exactly 2 players
      if (nightAction.role === 'Troublemaker') {
        return selectedTargets.length === 2;
      }

      return selectedTargets.length >= 1;
    };

    const handleSubmitAction = () => {
      submitNightAction(selectedTargets);
    };

    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 safe-area-inset">
        <div className="card w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl sm:text-6xl mb-3">{emoji}</div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{roleName}</h1>
            <p className="text-gray-300 mt-2 text-sm sm:text-base">{nightAction.prompt}</p>
          </div>

          {/* Action result */}
          {actionResult && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-900/50 border border-indigo-500 space-y-2">
              {actionResult.type === 'info' && (
                <p className="text-white">{actionResult.message}</p>
              )}
              {actionResult.type === 'view' && (
                <p className="text-white">
                  <span className="text-gray-300">{actionResult.name}'s card:</span>{' '}
                  <span className="text-amber-400 font-semibold">{getRoleEmoji(actionResult.role ?? '')} {actionResult.role}</span>
                </p>
              )}
              {actionResult.type === 'view_center' && actionResult.cards && (
                <div className="space-y-1">
                  <p className="text-gray-300 mb-2">Center cards:</p>
                  {actionResult.cards.map((card, i) => (
                    <p key={i} className="text-amber-400 font-semibold">
                      {getRoleEmoji(card)} {card}
                    </p>
                  ))}
                </div>
              )}
              {actionResult.type === 'swap_view' && (
                <p className="text-white">
                  You swapped with {actionResult.name} and are now:{' '}
                  <span className="text-amber-400 font-semibold">{getRoleEmoji(actionResult.newRole ?? '')} {actionResult.newRole}</span>
                </p>
              )}
              {actionResult.type === 'swap' && (
                <p className="text-green-400 font-medium">{actionResult.message}</p>
              )}
              {actionResult.type === 'swap_center' && (
                <p className="text-green-400 font-medium">{actionResult.message}</p>
              )}
              {actionResult.type === 'pi_result' && (
                <div className="space-y-2">
                  {actionResult.viewed?.map((v, i) => (
                    <p key={i} className="text-white">
                      {v.name}: <span className="text-amber-400 font-semibold">{getRoleEmoji(v.role)} {v.role}</span>
                    </p>
                  ))}
                  {actionResult.becameRole && (
                    <p className="text-red-400 font-semibold mt-2">
                      You have become a {actionResult.becameRole}!
                    </p>
                  )}
                </div>
              )}
              {actionResult.type === 'witch_result' && (
                <div className="space-y-2">
                  <p className="text-white">
                    Center card: <span className="text-amber-400 font-semibold">{getRoleEmoji(actionResult.viewedCard ?? '')} {actionResult.viewedCard}</span>
                  </p>
                  {actionResult.swapped && (
                    <p className="text-green-400">Swapped with {actionResult.targetName}!</p>
                  )}
                  {actionResult.shielded && (
                    <p className="text-yellow-400">Target was shielded - no swap!</p>
                  )}
                </div>
              )}
              {actionResult.type === 'reveal' && (
                <div className="space-y-2">
                  <p className="text-white">
                    {actionResult.name}'s card: <span className="text-amber-400 font-semibold">{getRoleEmoji(actionResult.role ?? '')} {actionResult.role}</span>
                  </p>
                  {actionResult.staysRevealed && (
                    <p className="text-red-400">Card stays face-up for everyone!</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          {nightAction.options.length > 0 && !actionResult && (
            <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto">
              {nightAction.options.map((option) => (
                <button
                  key={`${option.type}-${option.id}`}
                  onClick={() => handleTargetSelect(option.id)}
                  className={`action-option w-full ${selectedTargets.includes(option.id) ? 'selected' : ''}`}
                >
                  <span className="text-white font-medium">{option.label}</span>
                  {option.type === 'center' && (
                    <span className="text-indigo-400 text-sm ml-2">(Center)</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Submit button */}
          {!actionResult && nightAction.options.length > 0 && (
            <button
              onClick={handleSubmitAction}
              disabled={!canSubmit()}
              className="btn-primary w-full disabled:opacity-50"
            >
              Confirm
            </button>
          )}

          {/* Continue button after result */}
          {actionResult && (
            <button
              onClick={acknowledgeNightResult}
              className="btn-primary w-full"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  // Day Phase - Discussion and Voting combined
  if (phase === 'day') {
    const handleVote = (targetId: string) => {
      castVote(targetId);
      setMyVoteTarget(targetId);
    };

    // Show voted confirmation
    if (hasVoted) {
      return (
        <div className="page-container">
          <div className="max-w-md mx-auto">
            <div className="card">
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✓</div>
                <p className="text-green-400 font-semibold text-lg">Vote submitted!</p>
                <p className="text-gray-400 mt-2">
                  You voted for {players.find((p) => p.id === myVoteTarget)?.name ?? 'the middle'}
                </p>
                <div className="mt-6 p-4 rounded-xl bg-indigo-900/30">
                  <p className="text-gray-300 text-sm">
                    Waiting for others... ({voteCount.voted}/{voteCount.total})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show voting UI
    return (
      <div className="page-container">
        <div className="max-w-md mx-auto">
          <div className="card mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Day Phase - Vote!
                </h1>
                <p className="text-gray-400 text-sm mt-1">Choose someone to eliminate</p>
              </div>
            </div>

            {/* Your role reminder */}
            {originalRole && (
              <div className="p-3 rounded-xl bg-indigo-900/30 mb-4">
                <div className="text-xs text-gray-400 mb-1">Your starting role</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getRoleEmoji(originalRole)}</span>
                  <span className="text-white font-semibold">{getRoleName(originalRole)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowCheatSheet(true)}
              className="btn-secondary w-full text-sm mb-4"
            >
              View Role Reference
            </button>

            <div className="space-y-2">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleVote(player.id)}
                  className="vote-btn"
                >
                  <span className="text-white">{player.name}</span>
                </button>
              ))}
              <button
                onClick={() => handleVote('middle')}
                className="vote-btn bg-indigo-900/50"
              >
                <span className="text-indigo-300">Vote for The Middle (No Kill)</span>
              </button>
            </div>
          </div>
        </div>

        {showCheatSheet && (
          <CheatSheet
            onClose={() => setShowCheatSheet(false)}
            selectedRoles={selectedRoles}
          />
        )}
      </div>
    );
  }

  // Results Phase
  if (phase === 'results' && gameResult) {
    const myPlayerResult = gameResult.playerResults?.find(r => r.id === socketId);
    const didWin = myPlayerResult?.didWin ?? false;

    // Get my final role from roleReveal
    const myRoleInfo = gameResult.roleReveal?.find(r => r.id === socketId);
    const myFinalRole = myRoleInfo?.finalRole;

    return (
      <div className="page-container">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Win/Loss Banner */}
          <div className={`result-banner ${didWin ? 'win' : 'lose'}`}>
            <div className="text-5xl sm:text-6xl mb-3">{didWin ? '🎉' : '💀'}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {didWin ? 'Victory!' : 'Defeat!'}
            </h1>
            <p className="text-gray-300 text-sm px-4">
              {gameResult.winReason}
            </p>
            {myFinalRole && (
              <div className="mt-4 p-3 rounded-xl bg-black/20 inline-block">
                <span className="text-gray-400 text-sm">Your final role: </span>
                <span className="text-amber-400 font-semibold">
                  {getRoleEmoji(myFinalRole)} {myFinalRole}
                </span>
              </div>
            )}
          </div>

          {/* Deaths */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              Eliminated
            </h2>
            {gameResult.eliminated.length > 0 ? (
              <div className="space-y-2">
                {gameResult.eliminated.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-red-900/30 border border-red-900"
                  >
                    <span className="text-white font-medium">{player.name}</span>
                    <span className="text-amber-400">
                      {getRoleEmoji(player.role)} {player.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">No one was eliminated!</p>
            )}
          </div>

          {/* Vote Breakdown */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3">
              Votes
            </h2>
            <div className="space-y-1 text-sm">
              {Object.entries(gameResult.voteBreakdown).map(([voter, target]) => (
                <div key={voter} className="flex justify-between text-gray-300">
                  <span>{voter}</span>
                  <span className="text-amber-400">→ {target}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Roles */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              Final Roles
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {gameResult.roleReveal?.map((player) => {
                const team = getRoleTeam(player.finalRole);
                const isDead = gameResult.eliminated.some(e => e.id === player.id);
                const changed = player.originalRole !== player.finalRole;
                return (
                  <div
                    key={player.id}
                    className={`p-3 rounded-xl ${isDead ? 'bg-red-900/20 border border-red-900/50' : 'bg-indigo-900/30'}`}
                  >
                    <div className={`font-medium ${isDead ? 'text-red-300 line-through' : 'text-white'}`}>
                      {player.name}
                    </div>
                    <div className={`text-sm ${team === 'werewolf' ? 'text-red-400' : team === 'tanner' ? 'text-purple-400' : 'text-green-400'}`}>
                      {getRoleEmoji(player.finalRole)} {player.finalRole}
                      {changed && (
                        <span className="text-gray-500 text-xs ml-1">(was {player.originalRole})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Cards */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              Center Cards
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {gameResult.centerCards?.map((role, i) => (
                <div key={i} className="p-3 rounded-xl bg-indigo-900/30 text-center">
                  <div className="text-2xl mb-1">{getRoleEmoji(role)}</div>
                  <div className="text-amber-400 text-sm font-medium">{role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Night Log */}
          {gameResult.nightLog && gameResult.nightLog.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-white mb-3">
                Night Actions
              </h2>
              <div className="space-y-2 text-sm">
                {gameResult.nightLog.map((log, i) => (
                  <div key={i} className="text-gray-300">
                    <span className="text-amber-400">{getRoleEmoji(log.role)} {log.role}:</span>{' '}
                    {log.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {isHost && (
              <button onClick={restartGame} className="btn-secondary flex-1">
                Play Again
              </button>
            )}
            <button onClick={handleLeave} className="btn-primary flex-1">
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">🐺</div>
        <div className="text-white">Loading game...</div>
        <button onClick={handleLeave} className="btn-secondary mt-4">
          Back to Home
        </button>
      </div>
    </div>
  );
}
