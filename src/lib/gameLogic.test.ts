import { describe, expect, it } from 'vitest';
import { calculateTotals, getGestrichenState, getWinner, summarizeStats } from './gameLogic';
import type { Game, RoundEntry } from '../types';

function round(team: 'A' | 'B', pointsAwarded: number): RoundEntry {
  return {
    id: `${team}-${pointsAwarded}-${Math.random()}`,
    team,
    pointsAwarded,
    type: 'normal',
    createdAt: new Date().toISOString(),
    orderIndex: 1,
  };
}

function game(overrides: Partial<Game>): Game {
  return {
    id: crypto.randomUUID(),
    playedAt: '2026-04-20T19:00:00.000Z',
    targetScore: 15,
    teamA: { id: 'A', name: 'Dein Team', players: ['Anna', 'Lukas'] },
    teamB: { id: 'B', name: 'Gegner', players: ['Eva', 'Paul'] },
    rounds: [round('A', 3), round('A', 2), round('A', 4), round('A', 6)].map((entry, index) => ({
      ...entry,
      orderIndex: index + 1,
    })),
    finalTotals: { A: 15, B: 10 },
    winnerTeam: 'A',
    ...overrides,
  };
}

describe('gameLogic', () => {
  it('calculates cumulative totals from round history', () => {
    expect(calculateTotals([round('A', 2), round('B', 3), round('A', 5)])).toEqual({ A: 7, B: 3 });
  });

  it('derives a winner for different target scores', () => {
    expect(getWinner([round('A', 3), round('A', 5), round('A', 3)], 11)).toBe('A');
    expect(getWinner([round('B', 5), round('B', 5), round('B', 5)], 15)).toBe('B');
    expect(getWinner([round('A', 5), round('A', 5), round('A', 5), round('A', 3)], 18)).toBe('A');
  });

  it('detects 3- and 4-gestrichen only while the trailing team cannot overtake', () => {
    expect(getGestrichenState([round('A', 5), round('A', 5), round('A', 3), round('B', 4)], 15)).toEqual({
      leader: 'A',
      trailing: 'B',
      mode: 3,
      trailingAllowedPoints: [2, 3],
    });

    expect(getGestrichenState([round('A', 5), round('A', 5), round('A', 4), round('B', 3)], 15)).toEqual({
      leader: 'A',
      trailing: 'B',
      mode: 4,
      trailingAllowedPoints: [2, 4],
    });

    expect(getGestrichenState([round('A', 5), round('A', 5), round('A', 3), round('B', 11)], 15)).toBeNull();
    expect(getGestrichenState([round('A', 5), round('A', 5), round('A', 4), round('B', 11)], 15)).toBeNull();
  });

  it('supports negative penalty points in cumulative totals', () => {
    expect(calculateTotals([round('A', 5), { ...round('A', -2), type: 'penalty' }])).toEqual({ A: 3, B: 0 });
  });

  it('aggregates money totals and streaks correctly', () => {
    const games = [
      game({
        playedAt: '2026-04-18T18:00:00.000Z',
        winnerTeam: 'A',
        finalTotals: { A: 15, B: 9 },
        stakeAmount: 5,
      }),
      game({
        playedAt: '2026-04-19T18:00:00.000Z',
        winnerTeam: 'A',
        finalTotals: { A: 15, B: 11 },
        stakeAmount: 2,
      }),
      game({
        playedAt: '2026-04-21T18:00:00.000Z',
        winnerTeam: 'B',
        finalTotals: { A: 10, B: 15 },
        stakeAmount: -4,
      }),
    ];

    const stats = summarizeStats(games);

    expect(stats.totalGames).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.money.total).toBe(3);
    expect(stats.money.average).toBe(1);
    expect(stats.money.biggestWin).toBe(5);
    expect(stats.money.biggestLoss).toBe(-4);
    expect(stats.currentStreak).toEqual({ type: 'loss', count: 1 });
    expect(stats.bestWinStreak).toBe(2);
  });

  it('treats a lost game stake as negative in summaries', () => {
    const stats = summarizeStats([
      game({
        playedAt: '2026-04-22T18:00:00.000Z',
        winnerTeam: 'B',
        finalTotals: { A: 11, B: 15 },
        stakeAmount: -6,
      }),
    ]);

    expect(stats.money.total).toBe(-6);
    expect(stats.money.biggestLoss).toBe(-6);
  });

  it('tracks blind round win rate when first round roles are known', () => {
    const stats = summarizeStats([
      game({
        firstRoundSchlagSeat: 'B1',
        firstRoundTrumpfSeat: 'A2',
        rounds: [
          { ...round('A', 2), orderIndex: 1 },
          { ...round('B', 2), orderIndex: 2 },
          { ...round('A', 2), orderIndex: 3 },
          { ...round('A', 2), orderIndex: 4 },
        ],
      }),
    ]);

    expect(stats.blindRoundsTracked).toBe(2);
    expect(stats.blindRoundsWon).toBe(1);
    expect(stats.blindWinRate).toBe(0.5);
  });
});
