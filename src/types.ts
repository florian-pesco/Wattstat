export type TeamId = 'A' | 'B';
export type RoundType = 'normal' | 'penalty';
export type TargetScore = 11 | 15 | 18;

export interface RoundEntry {
  id: string;
  team: TeamId;
  pointsAwarded: number;
  type: RoundType;
  createdAt: string;
}

export interface Team {
  id: TeamId;
  name: string;
  players: [string, string];
}

export interface GameSettings {
  targetScore: TargetScore;
}

export interface Game {
  id: string;
  playedAt: string;
  targetScore: TargetScore;
  teamA: Team;
  teamB: Team;
  rounds: RoundEntry[];
  finalTotals: Record<TeamId, number>;
  winnerTeam: TeamId;
  stakeAmount?: number;
  note?: string;
}

export interface LiveGameDraft {
  targetScore: TargetScore;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
  stakeAmountText: string;
  note: string;
  rounds: RoundEntry[];
}

export interface MoneyResultSummary {
  total: number;
  average: number;
  biggestWin: number;
  biggestLoss: number;
}

export interface StatsSummary {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPointsScored: number;
  totalPointsConceded: number;
  averagePointsScored: number;
  averagePointsConceded: number;
  currentStreak: {
    type: 'win' | 'loss' | 'none';
    count: number;
  };
  bestWinStreak: number;
  money: MoneyResultSummary;
  recentGames: Game[];
}
