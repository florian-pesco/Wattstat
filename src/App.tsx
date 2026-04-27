import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { NewGamePage } from './pages/NewGamePage';
import { SavedGamesPage } from './pages/SavedGamesPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { loadLocalGames, loadRemoteGames, saveLocalGames, saveRemoteGame } from './lib/gameRepository';
import { isSupabaseConfigured, supabase, supabaseRedirectUrl } from './lib/supabase';
import type { Game } from './types';

function App() {
  const [games, setGames] = useState<Game[]>(() => (isSupabaseConfigured ? [] : loadLocalGames()));
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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
      if (!nextSession) {
        setGames([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      saveLocalGames(games);
    }
  }, [games]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session) {
      return;
    }

    const currentSession = session;
    let cancelled = false;

    async function fetchGames() {
      setGamesLoading(true);
      setAuthError(null);

      try {
        const remoteGames = await loadRemoteGames(currentSession);
        if (!cancelled) {
          setGames(remoteGames);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Spiele konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setGamesLoading(false);
        }
      }
    }

    fetchGames();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSaveGame(game: Game) {
    if (!isSupabaseConfigured) {
      setGames((current) =>
        [game, ...current].sort(
          (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
        ),
      );
      return;
    }

    if (!session) {
      throw new Error('Bitte zuerst anmelden.');
    }

    const savedGame = await saveRemoteGame(session, game);
    setGames((current) =>
      [savedGame, ...current.filter((currentGame) => currentGame.id !== savedGame.id)].sort(
        (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
      ),
    );
  }

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setAuthError(null);
    setAuthNotice(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: supabaseRedirectUrl,
      },
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthNotice('Magic Link verschickt. Bitte in deinem Postfach oeffnen.');
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Wattstat</p>
          <h1>Watten fuer den Tisch, die Liste und die Kasse.</h1>
        </div>
        <p className="header-copy">
          {isSupabaseConfigured
            ? 'Mit Supabase Login und Sync vorbereitet, damit deine Spiele auch auf Vercel bestehen bleiben.'
            : 'Lokal gespeichert, schnell mitschreibbar und auf Suedtiroler Wattblock-Logik aufgebaut.'}
        </p>
      </header>

      {isSupabaseConfigured ? (
        <section className="panel auth-panel">
          <div className="auth-panel-copy">
            <p className="eyebrow">Supabase Login</p>
            {session ? (
              <>
                <h2>Angemeldet als {session.user.email}</h2>
                <p>Neue Spiele werden jetzt direkt in Supabase gespeichert und auf Vercel synchron geladen.</p>
              </>
            ) : (
              <>
                <h2>Mit Magic Link anmelden</h2>
                <p>
                  Jeder Benutzer bekommt seine eigenen Spiele. Fuer den ersten Rollout reicht ein einfacher Link per
                  E-Mail.
                </p>
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
            <form className="auth-form" onSubmit={handleMagicLink}>
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
              <button className="primary-button" type="submit" disabled={authLoading}>
                {authLoading ? 'Prueft Session...' : 'Magic Link senden'}
              </button>
            </form>
          )}

          {authNotice ? <p className="success-text">{authNotice}</p> : null}
          {authError ? <p className="error-text">{authError}</p> : null}
        </section>
      ) : null}

      {gamesLoading ? (
        <section className="panel">
          <p>Spiele werden aus Supabase geladen...</p>
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
          <Route path="/" element={<NewGamePage onSaveGame={handleSaveGame} saveDisabled={isSupabaseConfigured && !session} />} />
          <Route path="/spiele" element={<SavedGamesPage games={games} />} />
          <Route path="/statistik" element={<StatisticsPage games={games} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
