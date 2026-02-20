import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

type Mode = 'menu' | 'login' | 'register' | 'create' | 'join';

export function Home() {
  const navigate = useNavigate();
  const {
    isConnected,
    isAuthenticated,
    username,
    roomCode,
    phase,
    createGame,
    joinGame,
    login,
    register,
    logout,
    error,
    clearError,
    authConnected,
  } = useGame();

  const [mode, setMode] = useState<Mode>(() => isAuthenticated ? 'menu' : 'login');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoomCode, setFormRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // If we're already in a room, navigate there
  useEffect(() => {
    if (roomCode && phase !== 'lobby') {
      navigate('/game');
    } else if (roomCode) {
      navigate(`/lobby/${roomCode}`);
    }
  }, [roomCode, phase, navigate]);

  // Update mode when auth state changes
  useEffect(() => {
    if (isAuthenticated && (mode === 'login' || mode === 'register')) {
      setMode('menu');
    }
  }, [isAuthenticated, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (formUsername.length < 2 || formUsername.length > 20) {
      setAuthError('Username must be 2-20 characters');
      return;
    }
    if (formPassword.length < 8) {
      setAuthError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const result = await login(formUsername, formPassword);
    setLoading(false);

    if (!result.success) {
      setAuthError(result.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (formUsername.length < 2 || formUsername.length > 20) {
      setAuthError('Username must be 2-20 characters');
      return;
    }
    if (formPassword.length < 8) {
      setAuthError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const result = await register(formUsername, formPassword);
    setLoading(false);

    if (!result.success) {
      setAuthError(result.error || 'Registration failed');
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    createGame();
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRoomCode.length !== 4) return;

    setLoading(true);
    clearError();
    joinGame(formRoomCode.toUpperCase());
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
          <div className={`w-2 h-2 rounded-full ${
            isAuthenticated && isConnected 
              ? 'bg-green-500' 
              : authConnected 
                ? 'bg-yellow-500' 
                : 'bg-red-500 animate-pulse'
          }`} />
          <span className="text-sm text-gray-400">
            {isAuthenticated && isConnected 
              ? `Connected as ${username}` 
              : authConnected 
                ? 'Ready to login' 
                : 'Connecting...'}
          </span>
        </div>

        {/* Auth error message */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-red-900/50 border border-red-500 text-red-200 text-sm">
            {authError}
            <button
              onClick={() => setAuthError('')}
              className="ml-2 text-red-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Game error message */}
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

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Username</label>
              <input
                type="text"
                placeholder="Enter your username"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.slice(0, 20))}
                className="input"
                maxLength={20}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !authConnected}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <p className="text-center text-gray-400 text-sm">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setAuthError(''); }}
                className="text-amber-400 hover:text-amber-300"
              >
                Register
              </button>
            </p>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Username</label>
              <input
                type="text"
                placeholder="Choose a username (2-20 chars)"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.slice(0, 20))}
                className="input"
                maxLength={20}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Password</label>
              <input
                type="password"
                placeholder="Choose a password (8+ chars)"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !authConnected}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <p className="text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setAuthError(''); }}
                className="text-amber-400 hover:text-amber-300"
              >
                Login
              </button>
            </p>
          </form>
        )}

        {/* Main menu (authenticated) */}
        {mode === 'menu' && isAuthenticated && (
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

            <button
              onClick={() => navigate('/profile')}
              className="w-full px-4 py-3 rounded-xl text-gray-300 hover:bg-white/10 transition-colors"
            >
              📊 My Profile
            </button>

            <button
              onClick={logout}
              className="w-full px-4 py-3 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        )}

        {/* Create game confirmation */}
        {mode === 'create' && (
          <form onSubmit={handleCreateGame} className="space-y-4">
            <p className="text-center text-gray-300">
              Create a new game as <span className="text-amber-400 font-semibold">{username}</span>?
            </p>
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
                disabled={loading || !isConnected}
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
            <p className="text-center text-gray-300 text-sm">
              Joining as <span className="text-amber-400 font-semibold">{username}</span>
            </p>
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
                autoFocus
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
                disabled={loading || formRoomCode.length !== 4 || !isConnected}
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
