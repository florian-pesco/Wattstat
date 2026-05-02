import type { Session } from '@supabase/supabase-js';
import type { Game, RoundEntry, TeamId, UserProfile } from '../types';
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
  final_total_a: number;
  final_total_b: number;
  winner_team: TeamId;
  stake_amount: number | null;
  note: string | null;
  team_a_player_1_profile_id: string | null;
  first_round_schlag_seat: Game['firstRoundSchlagSeat'] | null;
  first_round_trumpf_seat: Game['firstRoundTrumpfSeat'] | null;
  rounds?: RoundRow[];
}

interface RoundRow {
  id: string;
  game_id: string;
  order_index: number;
  winner_team: TeamId;
  points_awarded: number;
  round_type: RoundEntry['type'];
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  email: string;
}

function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (left, right) => new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
  );
}

function sortRounds(rounds: RoundEntry[]): RoundEntry[] {
  return [...rounds].sort((left, right) => left.orderIndex - right.orderIndex);
}

function toRoundEntry(row: RoundRow): RoundEntry {
  return {
    id: row.id,
    team: row.winner_team,
    pointsAwarded: row.points_awarded,
    type: row.round_type,
    createdAt: row.created_at,
    orderIndex: row.order_index,
  };
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
    rounds: sortRounds((row.rounds ?? []).map(toRoundEntry)),
    finalTotals: {
      A: row.final_total_a,
      B: row.final_total_b,
    },
    winnerTeam: row.winner_team,
    stakeAmount: row.stake_amount ?? undefined,
    note: row.note ?? undefined,
    teamAPlayer1ProfileId: row.team_a_player_1_profile_id ?? undefined,
    firstRoundSchlagSeat: row.first_round_schlag_seat ?? undefined,
    firstRoundTrumpfSeat: row.first_round_trumpf_seat ?? undefined,
  };
}

function toGameRow(game: Game, userId: string): GameRow {
  return {
    id: game.id,
    user_id: userId,
    played_at: game.playedAt,
    target_score: game.targetScore,
    team_a_name: game.teamA.name,
    team_a_players: [...game.teamA.players],
    team_b_name: game.teamB.name,
    team_b_players: [...game.teamB.players],
    final_total_a: game.finalTotals.A,
    final_total_b: game.finalTotals.B,
    winner_team: game.winnerTeam,
    stake_amount: game.stakeAmount ?? null,
    note: game.note ?? null,
    team_a_player_1_profile_id: game.teamAPlayer1ProfileId ?? null,
    first_round_schlag_seat: game.firstRoundSchlagSeat ?? null,
    first_round_trumpf_seat: game.firstRoundTrumpfSeat ?? null,
  };
}

function toRoundRows(game: Game): RoundRow[] {
  return sortRounds(game.rounds).map((round) => ({
    id: round.id,
    game_id: game.id,
    order_index: round.orderIndex,
    winner_team: round.team,
    points_awarded: round.pointsAwarded,
    round_type: round.type,
    created_at: round.createdAt,
  }));
}

function getFallbackUsername(session: Session): string {
  const metadataUsername = session.user.user_metadata?.username;
  if (typeof metadataUsername === 'string' && metadataUsername.trim().length > 0) {
    return metadataUsername.trim();
  }

  const emailPrefix = session.user.email?.split('@')[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return `spieler-${session.user.id.slice(0, 6)}`;
}

export function loadLocalGames(): Game[] {
  return sortGames(loadGames()).map((game) => ({
    ...game,
    rounds: sortRounds(game.rounds.map((round, index) => ({ ...round, orderIndex: round.orderIndex || index + 1 }))),
  }));
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
    .select('*, rounds(*)')
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

  const payload = toGameRow(game, session.user.id);
  const { error: gameError } = await supabase.from('games').upsert(payload);
  if (gameError) {
    throw gameError;
  }

  const { error: deleteError } = await supabase.from('rounds').delete().eq('game_id', game.id);
  if (deleteError) {
    throw deleteError;
  }

  const roundRows = toRoundRows(game);
  if (roundRows.length > 0) {
    const { error: roundError } = await supabase.from('rounds').insert(roundRows);
    if (roundError) {
      throw roundError;
    }
  }

  const { data, error } = await supabase.from('games').select('*, rounds(*)').eq('id', game.id).single();
  if (error) {
    throw error;
  }

  return toGame(data as GameRow);
}

export async function deleteRemoteGame(gameId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (error) {
    throw error;
  }
}

export async function loadOrCreateRemoteProfile(session: Session): Promise<UserProfile> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existingData, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingData) {
    return {
      userId: existingData.user_id,
      username: existingData.username,
      email: existingData.email,
    };
  }

  const newProfile: ProfileRow = {
    user_id: session.user.id,
    username: getFallbackUsername(session),
    email: session.user.email ?? '',
  };

  const { data, error } = await supabase.from('profiles').upsert(newProfile).select('*').single();
  if (error) {
    throw error;
  }

  return {
    userId: data.user_id,
    username: data.username,
    email: data.email,
  };
}
