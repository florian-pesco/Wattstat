import type { Game } from '../types';

const STORAGE_KEY = 'wattstat.games.v1';

export function loadGames(): Game[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isGame);
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

function isGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybe = value as Partial<Game>;
  return (
    typeof maybe.id === 'string' &&
    typeof maybe.playedAt === 'string' &&
    typeof maybe.targetScore === 'number' &&
    Array.isArray(maybe.rounds) &&
    typeof maybe.winnerTeam === 'string' &&
    typeof maybe.finalTotals === 'object'
  );
}
