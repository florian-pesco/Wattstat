import type { Session } from '@supabase/supabase-js';
import type { Game, RoundEntry, TeamId } from '../types';
import { loadGames, saveGames } from './storage';
import { supabase } from './supabase';

interface GameRow {
  id: string;
  user_id: string;
  played_at: string;
  target_score: number;
  team_a_name: string;
  team_a_players: string[];
  team_b_name: string;
  team_b_players: string[];
  rounds: RoundEntry[];
  final_total_a: number;
  final_total_b: number;
  winner_team: TeamId;
  stake_amount: number | null;
  note: string | null;
}

function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
  );
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    playedAt: row.played_at,
    targetScore: row.target_score as Game['targetScore'],
    teamA: {
      id: 'A',
      name: row.team_a_name,
      players: [row.team_a_players[0] ?? '', row.team_a_players[1] ?? ''],
    },
    teamB: {
      id: 'B',
      name: row.team_b_name,
      players: [row.team_b_players[0] ?? '', row.team_b_players[1] ?? ''],
    },
    rounds: row.rounds,
    finalTotals: {
      A: row.final_total_a,
      B: row.final_total_b,
    },
    winnerTeam: row.winner_team,
    stakeAmount: row.stake_amount ?? undefined,
    note: row.note ?? undefined,
  };
}

function toRow(game: Game, userId: string): GameRow {
  return {
    id: game.id,
    user_id: userId,
    played_at: game.playedAt,
    target_score: game.targetScore,
    team_a_name: game.teamA.name,
    team_a_players: [...game.teamA.players],
    team_b_name: game.teamB.name,
    team_b_players: [...game.teamB.players],
    rounds: game.rounds,
    final_total_a: game.finalTotals.A,
    final_total_b: game.finalTotals.B,
    winner_team: game.winnerTeam,
    stake_amount: game.stakeAmount ?? null,
    note: game.note ?? null,
  };
}

export function loadLocalGames(): Game[] {
  return sortGames(loadGames());
}

export function saveLocalGames(games: Game[]): void {
  saveGames(sortGames(games));
}

export async function loadRemoteGames(session: Session): Promise<Game[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', session.user.id)
    .order('played_at', { ascending: false });

  if (error) {
    throw error;
  }

  return sortGames((data as GameRow[]).map(toGame));
}

export async function saveRemoteGame(session: Session, game: Game): Promise<Game> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = toRow(game, session.user.id);
  const { data, error } = await supabase.from('games').upsert(payload).select('*').single();

  if (error) {
    throw error;
  }

  return toGame(data as GameRow);
}
