import { useMemo, useState } from 'react';
import { getSignedStakeAmount, TEAM_A, summarizeStats } from '../lib/gameLogic';
import { formatDate, formatDecimal, formatMoney } from '../lib/format';
import type { Game } from '../types';

interface StatisticsPageProps {
  games: Game[];
}

type RecentFilter = 'all' | 'wins' | 'losses';

export function StatisticsPage({ games }: StatisticsPageProps) {
  const stats = useMemo(() => summarizeStats(games), [games]);
  const [recentFilter, setRecentFilter] = useState<RecentFilter>('all');

  const recentGames = useMemo(() => {
    if (recentFilter === 'wins') {
      return stats.recentGames.filter((game) => game.winnerTeam === TEAM_A);
    }

    if (recentFilter === 'losses') {
      return stats.recentGames.filter((game) => game.winnerTeam !== TEAM_A);
    }

    return stats.recentGames;
  }, [recentFilter, stats.recentGames]);

  return (
    <section className="page stack">
      <div className="section-heading">
        <h1>Statistik</h1>
      </div>

      <div className="stat-grid">
        <StatCard label="Spiele" value={String(stats.totalGames)} />
        <StatCard label="Siege" value={String(stats.wins)} />
        <StatCard label="Niederlagen" value={String(stats.losses)} />
        <StatCard label="Siegquote" value={`${Math.round(stats.winRate * 100)}%`} />
        <StatCard label="Punkte gemacht" value={String(stats.totalPointsScored)} />
        <StatCard label="Punkte bekommen" value={String(stats.totalPointsConceded)} />
        <StatCard label="Ø gemacht" value={formatDecimal(stats.averagePointsScored)} />
        <StatCard label="Ø bekommen" value={formatDecimal(stats.averagePointsConceded)} />
        <StatCard
          label="Aktuelle Serie"
          value={
            stats.currentStreak.type === 'none'
              ? '0'
              : `${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? 'Siege' : 'Niederlagen'}`
          }
        />
        <StatCard label="Beste Siegesserie" value={String(stats.bestWinStreak)} />
        <StatCard label="Blind-Runden" value={String(stats.blindRoundsTracked)} />
        <StatCard
          label="Blind-Siegquote"
          value={stats.blindRoundsTracked > 0 ? `${Math.round(stats.blindWinRate * 100)}%` : '—'}
        />
      </div>

      <div className="money-grid">
        <StatCard label="Gesamt" value={formatMoney(stats.money.total)} accent />
        <StatCard label="Ø pro Spiel" value={formatMoney(stats.money.average)} />
        <StatCard label="Bester Gewinn" value={formatMoney(stats.money.biggestWin)} />
        <StatCard label="Groesster Verlust" value={formatMoney(stats.money.biggestLoss)} />
      </div>

      <div className="panel stack">
        <div className="section-heading compact">
          <h2>Letzte Spiele</h2>
          <p>Direkt aus der Statistik gefiltert.</p>
        </div>

        <div className="filter-row">
          <button className={recentFilter === 'all' ? 'filter-button active' : 'filter-button'} type="button" onClick={() => setRecentFilter('all')}>
            Alle
          </button>
          <button className={recentFilter === 'wins' ? 'filter-button active' : 'filter-button'} type="button" onClick={() => setRecentFilter('wins')}>
            Siege
          </button>
          <button className={recentFilter === 'losses' ? 'filter-button active' : 'filter-button'} type="button" onClick={() => setRecentFilter('losses')}>
            Niederlagen
          </button>
        </div>

        {recentGames.length === 0 ? (
          <p className="empty-copy">Noch keine gespeicherten Spiele fuer diese Ansicht.</p>
        ) : (
          <div className="recent-list">
            {recentGames.map((game) => {
              const signedStake = getSignedStakeAmount(game);

              return (
                <div key={game.id} className="recent-row">
                  <div>
                    <strong>{formatDate(game.playedAt)}</strong>
                    <span>
                      {game.teamA.players[0]} &amp; {game.teamA.players[1]} gegen {game.teamB.players[0]} &amp; {game.teamB.players[1]}
                    </span>
                  </div>
                  <div className="recent-score">
                    <strong>
                      {game.finalTotals.A}:{game.finalTotals.B}
                    </strong>
                    <span>{typeof signedStake === 'number' ? formatMoney(signedStake) : 'ohne Einsatz'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <article className={accent ? 'panel stat-card stat-card-accent' : 'panel stat-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
