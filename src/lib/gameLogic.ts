import type { Game, PlayerSeat, RoundEntry, StatsSummary, TargetScore, TeamId } from '../types';

export const TEAM_A: TeamId = 'A';
export const TEAM_B: TeamId = 'B';
export const TARGET_SCORE_OPTIONS: TargetScore[] = [11, 15, 18];
export const ROUND_POINT_OPTIONS = [2, 3, 4, 5] as const;
export const PENALTY_POINT_VALUE = -2;
export const PLAYER_SEAT_ORDER: PlayerSeat[] = ['A1', 'B1', 'A2', 'B2'];

export interface GestrichenState {
  leader: TeamId;
  trailing: TeamId;
  mode: 3 | 4;
  trailingAllowedPoints: number[];
}

export function calculateTotals(rounds: RoundEntry[]): Record<TeamId, number> {
  return rounds.reduce(
    (totals, round) => {
      totals[round.team] += round.pointsAwarded;
      return totals;
    },
    { A: 0, B: 0 } as Record<TeamId, number>,
  );
}

export function getWinner(rounds: RoundEntry[], targetScore: TargetScore): TeamId | null {
  const totals = calculateTotals(rounds);
  if (totals.A >= targetScore && totals.A > totals.B) {
    return 'A';
  }

  if (totals.B >= targetScore && totals.B > totals.A) {
    return 'B';
  }

  return null;
}

export function isGameComplete(rounds: RoundEntry[], targetScore: TargetScore): boolean {
  return getWinner(rounds, targetScore) !== null;
}

export function getGestrichenState(rounds: RoundEntry[], targetScore: TargetScore): GestrichenState | null {
  const winner = getWinner(rounds, targetScore);
  if (winner) {
    return null;
  }

  const totals = calculateTotals(rounds);
  if (totals.A === totals.B) {
    return null;
  }

  const leader: TeamId = totals.A > totals.B ? TEAM_A : TEAM_B;
  const trailing: TeamId = leader === TEAM_A ? TEAM_B : TEAM_A;
  const leaderPoints = totals[leader];
  const trailingPoints = totals[trailing];
  const distanceToWin = targetScore - leaderPoints;

  if (distanceToWin === 2) {
    if (trailingPoints + 3 > leaderPoints) {
      return null;
    }

    return {
      leader,
      trailing,
      mode: 3,
      trailingAllowedPoints: [2, 3],
    };
  }

  if (distanceToWin === 1) {
    if (trailingPoints + 4 > leaderPoints) {
      return null;
    }

    return {
      leader,
      trailing,
      mode: 4,
      trailingAllowedPoints: [2, 4],
    };
  }

  return null;
}

export function buildGameName(game: Game, team: TeamId): string {
  const selected = team === 'A' ? game.teamA : game.teamB;
  return `${selected.players[0]} & ${selected.players[1]}`;
}

export function getSignedStakeAmount(game: Game): number | undefined {
  if (typeof game.stakeAmount !== 'number') {
    return undefined;
  }

  return game.winnerTeam === TEAM_A ? Math.abs(game.stakeAmount) : -Math.abs(game.stakeAmount);
}

export function getRoundRoleSeats(game: Game, roundIndex: number): { schlagSeat: PlayerSeat; trumpfSeat: PlayerSeat } | null {
  if (!game.firstRoundSchlagSeat || !game.firstRoundTrumpfSeat) {
    return null;
  }

  return {
    schlagSeat: rotateSeat(game.firstRoundSchlagSeat, roundIndex),
    trumpfSeat: rotateSeat(game.firstRoundTrumpfSeat, roundIndex),
  };
}

export function getRoleForSeat(game: Game, roundIndex: number, seat: PlayerSeat): 'schlag' | 'trumpf' | 'blind' | null {
  const roles = getRoundRoleSeats(game, roundIndex);
  if (!roles) {
    return null;
  }

  if (roles.schlagSeat === seat) {
    return 'schlag';
  }

  if (roles.trumpfSeat === seat) {
    return 'trumpf';
  }

  return 'blind';
}

export function summarizeStats(games: Game[]): StatsSummary {
  const sortedGames = [...games].sort(
    (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
  );

  const totalGames = sortedGames.length;
  const wins = sortedGames.filter((game) => game.winnerTeam === TEAM_A).length;
  const losses = totalGames - wins;
  const totalPointsScored = sortedGames.reduce((sum, game) => sum + game.finalTotals.A, 0);
  const totalPointsConceded = sortedGames.reduce((sum, game) => sum + game.finalTotals.B, 0);
  const stakeValues = sortedGames
    .map(getSignedStakeAmount)
    .filter((stake): stake is number => typeof stake === 'number');

  const totalMoney = stakeValues.reduce((sum, stake) => sum + stake, 0);
  const biggestWin = stakeValues.length > 0 ? Math.max(...stakeValues, 0) : 0;
  const biggestLoss = stakeValues.length > 0 ? Math.min(...stakeValues, 0) : 0;

  let blindRoundsTracked = 0;
  let blindRoundsWon = 0;

  for (const game of sortedGames) {
    game.rounds.forEach((round, index) => {
      const role = getRoleForSeat(game, index, 'A1');
      if (role === 'blind') {
        blindRoundsTracked += 1;
        if (round.team === TEAM_A) {
          blindRoundsWon += 1;
        }
      }
    });
  }

  const currentStreak = getCurrentStreak(sortedGames);
  const bestWinStreak = getBestWinStreak([...sortedGames].reverse());

  return {
    totalGames,
    wins,
    losses,
    winRate: totalGames > 0 ? wins / totalGames : 0,
    totalPointsScored,
    totalPointsConceded,
    averagePointsScored: totalGames > 0 ? totalPointsScored / totalGames : 0,
    averagePointsConceded: totalGames > 0 ? totalPointsConceded / totalGames : 0,
    currentStreak,
    bestWinStreak,
    money: {
      total: totalMoney,
      average: stakeValues.length > 0 ? totalMoney / stakeValues.length : 0,
      biggestWin,
      biggestLoss,
    },
    blindRoundsTracked,
    blindRoundsWon,
    blindWinRate: blindRoundsTracked > 0 ? blindRoundsWon / blindRoundsTracked : 0,
    recentGames: sortedGames.slice(0, 10),
  };
}

function rotateSeat(seat: PlayerSeat, roundIndex: number): PlayerSeat {
  const currentIndex = PLAYER_SEAT_ORDER.indexOf(seat);
  return PLAYER_SEAT_ORDER[(currentIndex + roundIndex) % PLAYER_SEAT_ORDER.length];
}

function getCurrentStreak(gamesDescending: Game[]): StatsSummary['currentStreak'] {
  if (gamesDescending.length === 0) {
    return { type: 'none', count: 0 };
  }

  const firstType = gamesDescending[0].winnerTeam === TEAM_A ? 'win' : 'loss';
  let count = 0;

  for (const game of gamesDescending) {
    const currentType = game.winnerTeam === TEAM_A ? 'win' : 'loss';
    if (currentType !== firstType) {
      break;
    }

    count += 1;
  }

  return { type: firstType, count };
}

function getBestWinStreak(gamesAscending: Game[]): number {
  let best = 0;
  let current = 0;

  for (const game of gamesAscending) {
    if (game.winnerTeam === TEAM_A) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}
