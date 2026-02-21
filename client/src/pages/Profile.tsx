import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import type { PlayerStats } from '../types';

const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

export function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, username } = useGame();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated, navigate]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4">
        <div className="text-white text-xl">Loading stats...</div>
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/api/user/avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ avatarUrl: base64Str })
        });

        if (!response.ok) {
          throw new Error('Failed to upload avatar');
        }

        const data = await response.json();
        if (stats) {
          setStats({ ...stats, avatarUrl: data.avatarUrl });
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Failed to process image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (error || !stats) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-4">
        <div className="text-red-400 text-xl">{error || 'Failed to load stats'}</div>
        <button
          onClick={() => navigate('/')}
          className="btn-secondary"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] p-4 md:p-8 safe-area-inset">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <label className="relative cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                <div className={`w-16 h-16 rounded-full overflow-hidden bg-indigo-900 border-2 border-indigo-500 flex items-center justify-center ${uploadingAvatar ? 'opacity-50' : 'group-hover:opacity-80'}`}>
                  {stats.avatarUrl ? (
                    <img src={stats.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs text-center leading-tight">Change<br />Photo</span>
                </div>
              </label>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{username}'s Profile</h1>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl text-gray-300 hover:bg-white/10 transition-colors"
            >
              Back
            </button>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide">Games</div>
              <div className="text-white text-2xl font-bold">{stats.gamesPlayed}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide">Win Rate</div>
              <div className="text-white text-2xl font-bold">{stats.winRate}%</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide">Current Streak</div>
              <div className={`text-2xl font-bold ${stats.currentStreak > 0 ? 'text-green-400' :
                  stats.currentStreak < 0 ? 'text-red-400' : 'text-white'
                }`}>
                {stats.currentStreak > 0 ? `+${stats.currentStreak}` : stats.currentStreak}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wide">Best Streak</div>
              <div className="text-green-400 text-2xl font-bold">{stats.bestWinStreak}</div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="bg-slate-700/50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">Survival Rate</div>
              <div className="text-white text-lg">{stats.survivalRate}%</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">Vote Accuracy</div>
              <div className="text-white text-lg">{stats.votingAccuracy}%</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">Avg Game Time</div>
              <div className="text-white text-lg">{formatDuration(stats.avgGameDuration)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">Last Played</div>
              <div className="text-white text-sm">{formatDate(stats.lastPlayedAt)}</div>
            </div>
          </div>

          {/* Best/Worst/Most Played */}
          {(stats.bestRole || stats.mostPlayedRole) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {stats.bestRole && (
                <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3">
                  <div className="text-green-400 text-xs uppercase tracking-wide">Best Role</div>
                  <div className="text-white font-semibold">{stats.bestRole.role}</div>
                  <div className="text-green-400 text-sm">{stats.bestRole.winRate}% win rate</div>
                </div>
              )}
              {stats.worstRole && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3">
                  <div className="text-red-400 text-xs uppercase tracking-wide">Worst Role</div>
                  <div className="text-white font-semibold">{stats.worstRole.role}</div>
                  <div className="text-red-400 text-sm">{stats.worstRole.winRate}% win rate</div>
                </div>
              )}
              {stats.mostPlayedRole && (
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3">
                  <div className="text-amber-400 text-xs uppercase tracking-wide">Most Played</div>
                  <div className="text-white font-semibold">{stats.mostPlayedRole.role}</div>
                  <div className="text-amber-400 text-sm">{stats.mostPlayedRole.gamesPlayed} games</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team Performance */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Team Performance</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(stats.teamStats).map(([team, teamData]) => (
              <div key={team} className="bg-slate-700/50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white capitalize mb-2 flex items-center gap-2">
                  {team === 'villager' && '🏠'}
                  {team === 'werewolf' && '🐺'}
                  {team === 'tanner' && '😵'}
                  {team}
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games:</span>
                    <span className="text-white">{teamData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wins:</span>
                    <span className="text-green-400">{teamData.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses:</span>
                    <span className="text-red-400">{teamData.losses}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-600 pt-1 mt-1">
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="text-white font-bold">{teamData.winRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Performance */}
        {stats.roleStats.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-4">Role Performance</h2>
            <div className="space-y-2">
              {stats.roleStats.map((role) => (
                <div
                  key={role.role}
                  className="bg-slate-700/50 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <span className="text-white font-semibold">{role.role}</span>
                    <span className="text-gray-400 text-sm ml-2">({role.gamesPlayed} games)</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400">{role.wins}W</span>
                    <span className="text-red-400">{role.losses}L</span>
                    <span className={`font-bold w-14 text-right ${role.winRate >= 60 ? 'text-green-400' :
                        role.winRate >= 40 ? 'text-white' : 'text-red-400'
                      }`}>
                      {role.winRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No games yet message */}
        {stats.gamesPlayed === 0 && (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-2">No games played yet!</h3>
            <p className="text-gray-400 mb-6">Play some games to start tracking your stats.</p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              Play Now
            </button>
          </div>
        )}

        {/* Member since */}
        <div className="text-center text-gray-500 text-sm mt-6">
          Member since {formatDate(stats.memberSince)}
        </div>
      </div>
    </div>
  );
}
