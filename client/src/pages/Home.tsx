import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

type Mode = 'menu' | 'create' | 'join';

export function Home() {
  const navigate = useNavigate();
  const { 
    isConnected, 
    playerName, 
    roomCode, 
    phase,
    createGame, 
    joinGame,
    error,
    clearError,
  } = useGame();

  const [mode, setMode] = useState<Mode>('menu');
  const [formName, setFormName] = useState(playerName ?? '');
  const [formRoomCode, setFormRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  // If we're already in a room, navigate there
  useEffect(() => {
    if (roomCode && phase !== 'lobby') {
      navigate('/game');
    } else if (roomCode) {
      navigate(`/lobby/${roomCode}`);
    }
  }, [roomCode, phase, navigate]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setLoading(true);
    clearError();
    createGame(formName.trim());
    // Navigation handled by useEffect when roomCode is set
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formRoomCode.length !== 4) return;
    
    setLoading(true);
    clearError();
    joinGame(formName.trim(), formRoomCode.toUpperCase());
    // Navigation handled by useEffect when roomCode is set
  };

  // Reset loading when error occurs
  useEffect(() => {
    if (error) {
      setLoading(false);
    }
  }, [error]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 safe-area-inset">
      <div className="card w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">
            One Night
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-amber-400">
            Ultimate Werewolf
          </h2>
          <div className="text-5xl sm:text-6xl mt-4 float-animation">🐺</div>
        </div>

        {/* Connection status */}
        <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-900/50 border border-red-500 text-red-200 text-sm">
            {error}
            <button 
              onClick={clearError}
              className="ml-2 text-red-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Main menu */}
        {mode === 'menu' && (
          <div className="space-y-3 sm:space-y-4">
            <button
              onClick={() => setMode('create')}
              disabled={!isConnected}
              className="btn-primary w-full text-base sm:text-lg disabled:opacity-50"
            >
              🎮 Create Game
            </button>

            <button
              onClick={() => setMode('join')}
              disabled={!isConnected}
              className="btn-secondary w-full text-base sm:text-lg disabled:opacity-50"
            >
              🚪 Join Game
            </button>
          </div>
        )}

        {/* Create game form */}
        {mode === 'create' && (
          <form onSubmit={handleCreateGame} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={formName}
                onChange={(e) => setFormName(e.target.value.slice(0, 15))}
                className="input"
                maxLength={15}
                autoFocus
                autoCapitalize="words"
                autoCorrect="off"
              />
              <p className="text-xs text-gray-500 mt-1">{formName.length}/15 characters</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setMode('menu'); clearError(); }}
                className="flex-1 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !formName.trim() || !isConnected}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {/* Join game form */}
        {mode === 'join' && (
          <form onSubmit={handleJoinGame} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={formName}
                onChange={(e) => setFormName(e.target.value.slice(0, 15))}
                className="input"
                maxLength={15}
                autoFocus
                autoCapitalize="words"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block text-center">Room Code</label>
              <input
                type="text"
                placeholder="XXXX"
                value={formRoomCode}
                onChange={(e) => setFormRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                className="input text-center text-3xl tracking-[0.3em] font-mono uppercase"
                maxLength={4}
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setMode('menu'); clearError(); setFormRoomCode(''); }}
                className="flex-1 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !formName.trim() || formRoomCode.length !== 4 || !isConnected}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-gray-500 text-xs">
        <p>Play with 3-10 players in the same room</p>
      </div>
    </div>
  );
}
