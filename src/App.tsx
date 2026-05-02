import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { NewGamePage } from './pages/NewGamePage';
import { SavedGamesPage } from './pages/SavedGamesPage';
import { StatisticsPage } from './pages/StatisticsPage';
import {
  deleteRemoteGame,
  loadLocalGames,
  loadOrCreateRemoteProfile,
  loadRemoteGames,
  saveLocalGames,
  saveRemoteGame,
} from './lib/gameRepository';
import { getSupabaseRedirectUrl, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Game, UserProfile } from './types';

type AuthMode = 'sign-in' | 'sign-up';

function App() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>(() => loadLocalGames());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setAuthError(null);
      setAuthNotice(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      saveLocalGames(games);
      return;
    }

    if (!session) {
      setProfile(null);
      setGames(loadLocalGames());
      return;
    }

    let cancelled = false;
    const currentSession = session;

    async function fetchRemoteState() {
      setGamesLoading(true);
      setAuthError(null);

      try {
        const [remoteProfile, remoteGames] = await Promise.all([
          loadOrCreateRemoteProfile(currentSession),
          loadRemoteGames(currentSession),
        ]);

        if (!cancelled) {
          setProfile(remoteProfile);
          setGames(remoteGames);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setGamesLoading(false);
        }
      }
    }

    fetchRemoteState();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSaveGame(game: Game) {
    if (!isSupabaseConfigured || !session) {
      setGames((current) => {
        const nextGames = [game, ...current.filter((currentGame) => currentGame.id !== game.id)].sort(
          (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
        );
        saveLocalGames(nextGames);
        return nextGames;
      });
      setEditingGame(null);
      return;
    }

    const savedGame = await saveRemoteGame(session, game);
    setGames((current) =>
      [savedGame, ...current.filter((currentGame) => currentGame.id !== savedGame.id)].sort(
        (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
      ),
    );
    setEditingGame(null);
  }

  async function handleDeleteGame(gameId: string) {
    const confirmed = window.confirm('Dieses Spiel wirklich loeschen?');
    if (!confirmed) {
      return;
    }

    if (!isSupabaseConfigured || !session) {
      const nextGames = games.filter((game) => game.id !== gameId);
      setGames(nextGames);
      saveLocalGames(nextGames);
    } else {
      await deleteRemoteGame(gameId);
      setGames((current) => current.filter((game) => game.id !== gameId));
    }

    if (editingGame?.id === gameId) {
      setEditingGame(null);
    }
  }

  function handleEditGame(game: Game) {
    setEditingGame(game);
    navigate('/');
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setAuthError(null);
    setAuthNotice(null);

    if (authMode === 'sign-up') {
      if (authUsername.trim().length < 3) {
        setAuthError('Der Benutzername muss mindestens 3 Zeichen lang sein.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          emailRedirectTo: getSupabaseRedirectUrl(),
          data: {
            username: authUsername.trim(),
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.session) {
        setAuthNotice('Konto erstellt. Du bist jetzt angemeldet.');
      } else {
        setAuthNotice('Konto erstellt. Bitte bestaetige zuerst deine E-Mail und melde dich dann an.');
        setAuthMode('sign-in');
      }

      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthNotice('Erfolgreich angemeldet.');
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }

    setProfile(null);
    setEditingGame(null);
    setGames(loadLocalGames());
  }

  function handleCancelEdit() {
    setEditingGame(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Wattstat</p>
          <h1>Watten fuer den Tisch, die Liste und die Kasse.</h1>
        </div>
        <p className="header-copy">
          {session
            ? 'Deine Spiele werden mit deinem Konto synchronisiert und bleiben auf allen Geraeten verfuegbar.'
            : 'Du kannst auch ohne Login lokal spielen. Mit Konto werden Spiele und Statistiken synchronisiert.'}
        </p>
      </header>

      {isSupabaseConfigured ? (
        <section className="panel auth-panel">
          <div className="auth-panel-copy">
            <p className="eyebrow">Konto</p>
            {session && profile ? (
              <>
                <h2>Angemeldet als {profile.username}</h2>
                <p>{profile.email}</p>
              </>
            ) : (
              <>
                <h2>{authMode === 'sign-in' ? 'Einloggen' : 'Konto erstellen'}</h2>
              </>
            )}
          </div>

          {session ? (
            <div className="auth-actions">
              <button className="secondary-button" type="button" onClick={handleSignOut}>
                Abmelden
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <div className="auth-mode-switch">
                <button
                  className={authMode === 'sign-in' ? 'filter-button active' : 'filter-button'}
                  type="button"
                  onClick={() => setAuthMode('sign-in')}
                >
                  Login
                </button>
                <button
                  className={authMode === 'sign-up' ? 'filter-button active' : 'filter-button'}
                  type="button"
                  onClick={() => setAuthMode('sign-up')}
                >
                  Sign up
                </button>
              </div>

              {authMode === 'sign-up' ? (
                <label className="field">
                  <span>Benutzername</span>
                  <input
                    type="text"
                    placeholder="dein Name im Spiel"
                    value={authUsername}
                    onChange={(event) => setAuthUsername(event.target.value)}
                    required
                  />
                </label>
              ) : null}

              <label className="field">
                <span>E-Mail</span>
                <input
                  type="email"
                  placeholder="du@example.com"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Passwort</span>
                <input
                  type="password"
                  placeholder="Mindestens 6 Zeichen"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  required
                />
              </label>

              <button className="primary-button" type="submit" disabled={authLoading}>
                {authLoading ? 'Prueft Session...' : authMode === 'sign-in' ? 'Einloggen' : 'Konto erstellen'}
              </button>
            </form>
          )}

          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          {authError ? <p className="error-text">{authError}</p> : null}
        </section>
      ) : null}

      {gamesLoading ? (
        <section className="panel">
          <p>Spiele werden geladen...</p>
        </section>
      ) : null}

      <nav className="tab-nav" aria-label="Hauptnavigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'tab-link active' : 'tab-link')}>
          Neuer Block
        </NavLink>
        <NavLink to="/spiele" className={({ isActive }) => (isActive ? 'tab-link active' : 'tab-link')}>
          Gespeicherte Spiele
        </NavLink>
        <NavLink to="/statistik" className={({ isActive }) => (isActive ? 'tab-link active' : 'tab-link')}>
          Statistik
        </NavLink>
      </nav>

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <NewGamePage
                onSaveGame={handleSaveGame}
                initialGame={editingGame}
                currentUsername={profile?.username ?? null}
                currentUserId={profile?.userId ?? null}
                onCancelEdit={handleCancelEdit}
              />
            }
          />
          <Route
            path="/spiele"
            element={<SavedGamesPage games={games} onEditGame={handleEditGame} onDeleteGame={handleDeleteGame} />}
          />
          <Route path="/statistik" element={<StatisticsPage games={games} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
