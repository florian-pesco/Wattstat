import type { Game, PersistedLiveGame } from '../types';

const STORAGE_KEY = 'wattstat.games.v1';
const LIVE_GAME_STORAGE_KEY = 'wattstat.live-game.v1';

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

export function loadPersistedLiveGame(): PersistedLiveGame | null {
  const raw = window.localStorage.getItem(LIVE_GAME_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedLiveGame(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedLiveGame(liveGame: PersistedLiveGame): void {
  window.localStorage.setItem(LIVE_GAME_STORAGE_KEY, JSON.stringify(liveGame));
}

export function clearPersistedLiveGame(): void {
  window.localStorage.removeItem(LIVE_GAME_STORAGE_KEY);
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

function isPersistedLiveGame(value: unknown): value is PersistedLiveGame {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybe = value as Partial<PersistedLiveGame>;
  return Boolean(maybe.draft) && typeof maybe.hasStarted === 'boolean';
}
