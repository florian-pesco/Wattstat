import { useMemo, useState } from 'react';
import { buildGameName, getSignedStakeAmount, TEAM_A } from '../lib/gameLogic';
import { formatDate, formatMoney } from '../lib/format';
import type { Game } from '../types';

interface SavedGamesPageProps {
  games: Game[];
  onEditGame: (game: Game) => void;
  onDeleteGame: (gameId: string) => Promise<void>;
}

type Filter = 'all' | 'wins' | 'losses';

export function SavedGamesPage({ games, onEditGame, onDeleteGame }: SavedGamesPageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    if (filter === 'wins') {
      return games.filter((game) => game.winnerTeam === TEAM_A);
    }

    if (filter === 'losses') {
      return games.filter((game) => game.winnerTeam !== TEAM_A);
    }

    return games;
  }, [filter, games]);

  async function handleDelete(gameId: string) {
    setDeletingId(gameId);
    try {
      await onDeleteGame(gameId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="page stack">
      <div className="section-heading">
        <h1>Gespeicherte Spiele</h1>
        <p>Hier kannst du gespeicherte Matches nachtraeglich bearbeiten oder loeschen.</p>
      </div>

      <div className="filter-row">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          Alle
        </FilterButton>
        <FilterButton active={filter === 'wins'} onClick={() => setFilter('wins')}>
          Siege
        </FilterButton>
        <FilterButton active={filter === 'losses'} onClick={() => setFilter('losses')}>
          Niederlagen
        </FilterButton>
      </div>

      {filteredGames.length === 0 ? (
        <div className="panel empty-state">
          <h2>Noch keine Spiele</h2>
          <p>Sobald du dein erstes Match speicherst, erscheint es hier automatisch.</p>
        </div>
      ) : (
        <div className="stack">
          {filteredGames.map((game) => {
            const signedStake = getSignedStakeAmount(game);

            return (
              <article className="panel saved-game-card" key={game.id}>
                <div className="saved-game-header">
                  <div>
                    <p className="eyebrow">{formatDate(game.playedAt)}</p>
                    <h2>
                      {buildGameName(game, 'A')} gegen {buildGameName(game, 'B')}
                    </h2>
                  </div>
                  <div className={`result-pill ${game.winnerTeam === TEAM_A ? 'result-win' : 'result-loss'}`}>
                    {game.winnerTeam === TEAM_A ? 'Sieg' : 'Niederlage'}
                  </div>
                </div>

                <div className="saved-game-meta">
                  <span>
                    Endstand {game.finalTotals.A}:{game.finalTotals.B}
                  </span>
                  <span>Ziel {game.targetScore}</span>
                  <span>{typeof signedStake === 'number' ? formatMoney(signedStake) : 'Kein Einsatz notiert'}</span>
                </div>

                {game.firstRoundSchlagSeat && game.firstRoundTrumpfSeat ? (
                  <p className="saved-game-note">
                    Runde 1: Schlag {game.firstRoundSchlagSeat}, Trumpf {game.firstRoundTrumpfSeat}
                  </p>
                ) : null}

                {game.note ? <p className="saved-game-note">{game.note}</p> : null}

                <div className="saved-game-actions">
                  <button className="secondary-button" type="button" onClick={() => onEditGame(game)}>
                    Bearbeiten
                  </button>
                  <button
                    className="ghost-button destructive-button"
                    type="button"
                    onClick={() => handleDelete(game.id)}
                    disabled={deletingId === game.id}
                  >
                    {deletingId === game.id ? 'Loescht...' : 'Loeschen'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface FilterButtonProps {
  active: boolean;
  children: string;
  onClick: () => void;
}

function FilterButton({ active, children, onClick }: FilterButtonProps) {
  return (
    <button className={active ? 'filter-button active' : 'filter-button'} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
