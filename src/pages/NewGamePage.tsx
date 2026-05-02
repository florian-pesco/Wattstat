import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  getGestrichenState,
  PENALTY_POINT_VALUE,
  PLAYER_SEAT_ORDER,
  ROUND_POINT_OPTIONS,
  TARGET_SCORE_OPTIONS,
  TEAM_A,
  TEAM_B,
  calculateTotals,
  getWinner,
} from '../lib/gameLogic';
import type { Game, LiveGameDraft, PlayerSeat, RoundEntry, RoundType, TeamId } from '../types';

interface NewGamePageProps {
  onSaveGame: (game: Game) => Promise<void>;
  initialGame?: Game | null;
  currentUsername?: string | null;
  currentUserId?: string | null;
  onCancelEdit?: () => void;
}

function createInitialDraft(currentUsername: string | null): LiveGameDraft {
  return {
    gameId: null,
    targetScore: 15,
    teamAPlayers: [currentUsername ?? '', ''],
    teamBPlayers: ['', ''],
    stakeAmountText: '',
    note: '',
    rounds: [],
    firstRoundSchlagSeat: '',
    firstRoundTrumpfSeat: '',
  };
}

function createDraftFromGame(game: Game, currentUsername: string | null): LiveGameDraft {
  return {
    gameId: game.id,
    targetScore: game.targetScore,
    teamAPlayers: [currentUsername ?? game.teamA.players[0], game.teamA.players[1]],
    teamBPlayers: [...game.teamB.players] as [string, string],
    stakeAmountText: typeof game.stakeAmount === 'number' ? String(Math.abs(game.stakeAmount)) : '',
    note: game.note ?? '',
    rounds: [...game.rounds].sort((left, right) => left.orderIndex - right.orderIndex),
    firstRoundSchlagSeat: game.firstRoundSchlagSeat ?? '',
    firstRoundTrumpfSeat: game.firstRoundTrumpfSeat ?? '',
  };
}

export function NewGamePage({
  onSaveGame,
  initialGame = null,
  currentUsername = null,
  currentUserId = null,
  onCancelEdit,
}: NewGamePageProps) {
  const [draft, setDraft] = useState<LiveGameDraft>(() => createInitialDraft(currentUsername));
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialGame) {
      setDraft(createDraftFromGame(initialGame, currentUsername));
      setHasStarted(true);
      setError(null);
      return;
    }

    setDraft((current) => ({
      ...current,
      teamAPlayers: [currentUsername ?? current.teamAPlayers[0], current.teamAPlayers[1]],
    }));
  }, [initialGame, currentUsername]);

  const totals = useMemo(() => calculateTotals(draft.rounds), [draft.rounds]);
  const winner = useMemo(() => getWinner(draft.rounds, draft.targetScore), [draft.rounds, draft.targetScore]);
  const gestrichenState = useMemo(
    () => getGestrichenState(draft.rounds, draft.targetScore),
    [draft.rounds, draft.targetScore],
  );
  const isEditing = initialGame !== null;

  function updatePlayer(team: TeamId, index: 0 | 1, value: string) {
    if (team === TEAM_A && index === 0 && currentUsername) {
      return;
    }

    setDraft((current) => {
      if (team === TEAM_A) {
        const next = [...current.teamAPlayers] as [string, string];
        next[index] = value;
        return { ...current, teamAPlayers: next };
      }

      const next = [...current.teamBPlayers] as [string, string];
      next[index] = value;
      return { ...current, teamBPlayers: next };
    });
  }

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ([...draft.teamAPlayers, ...draft.teamBPlayers].some((name) => name.trim().length === 0)) {
      setError('Bitte alle vier Spielernamen eintragen.');
      return;
    }

    if ((draft.firstRoundSchlagSeat && !draft.firstRoundTrumpfSeat) || (!draft.firstRoundSchlagSeat && draft.firstRoundTrumpfSeat)) {
      setError('Bitte entweder Schlag und Trumpf beide auswaehlen oder beide leer lassen.');
      return;
    }

    if (draft.firstRoundSchlagSeat && draft.firstRoundSchlagSeat === draft.firstRoundTrumpfSeat) {
      setError('Schlag und Trumpf koennen nicht dieselbe Person sein.');
      return;
    }

    setError(null);
    setHasStarted(true);
  }

  function addRound(team: TeamId, pointsAwarded: number, type: RoundType) {
    const round: RoundEntry = {
      id: crypto.randomUUID(),
      team,
      pointsAwarded,
      type,
      createdAt: new Date().toISOString(),
      orderIndex: draft.rounds.length + 1,
    };

    setDraft((current) => ({ ...current, rounds: [...current.rounds, round] }));
  }

  function undoLastRound() {
    setDraft((current) => ({
      ...current,
      rounds: current.rounds.slice(0, -1).map((round, index) => ({ ...round, orderIndex: index + 1 })),
    }));
  }

  function resetGame() {
    setDraft(createInitialDraft(currentUsername));
    setHasStarted(false);
    setError(null);
    onCancelEdit?.();
  }

  async function saveFinishedGame() {
    if (!winner) {
      return;
    }

    const rawStakeAmount =
      draft.stakeAmountText.trim() === '' ? undefined : Number.parseFloat(draft.stakeAmountText.replace(',', '.'));

    if (draft.stakeAmountText.trim() !== '' && Number.isNaN(rawStakeAmount)) {
      setError('Der Einsatz muss eine Zahl sein, z. B. 5 oder 2.50.');
      return;
    }

    const stakeAmount =
      typeof rawStakeAmount === 'number'
        ? winner === TEAM_A
          ? Math.abs(rawStakeAmount)
          : -Math.abs(rawStakeAmount)
        : undefined;

    const game: Game = {
      id: draft.gameId ?? crypto.randomUUID(),
      playedAt: initialGame?.playedAt ?? new Date().toISOString(),
      targetScore: draft.targetScore,
      teamA: { id: TEAM_A, name: 'Dein Team', players: [currentUsername ?? draft.teamAPlayers[0], draft.teamAPlayers[1]] },
      teamB: { id: TEAM_B, name: 'Gegner', players: draft.teamBPlayers },
      rounds: draft.rounds.map((round, index) => ({ ...round, orderIndex: index + 1 })),
      finalTotals: totals,
      winnerTeam: winner,
      stakeAmount,
      note: draft.note.trim() || undefined,
      teamAPlayer1ProfileId: currentUserId ?? undefined,
      firstRoundSchlagSeat: draft.firstRoundSchlagSeat || undefined,
      firstRoundTrumpfSeat: draft.firstRoundTrumpfSeat || undefined,
    };

    setIsSaving(true);

    try {
      await onSaveGame(game);
      resetGame();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Speichern fehlgeschlagen.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const seatOptions = buildSeatOptions(draft, currentUsername);

  return (
    <section className="page">
      <div className="hero-card">
        <p className="eyebrow">Suedtiroler Wattblock</p>
        <h1>{isEditing ? 'Gespeichertes Spiel bearbeiten.' : 'Spiel mitschreiben, speichern und spaeter sauber auswerten.'}</h1>
        <p className="hero-copy">
          {currentUsername
            ? `Du spielst als ${currentUsername} immer auf Position 1 in deinem Team.`
            : 'Ohne Login kannst du lokal spielen. Mit Login wird Position 1 automatisch dein Benutzername.'}
        </p>
      </div>

      {!hasStarted ? (
        <form className="panel stack" onSubmit={startGame}>
          <div className="section-heading">
            <h2>{isEditing ? 'Spiel bearbeiten' : 'Neues Spiel'}</h2>
            <p>Bis 11, 15 oder 18 spielen, dann direkt am Tisch mitschreiben.</p>
          </div>

          <div className="grid two">
            <label className="field">
              <span>Zielpunkte</span>
              <select
                value={draft.targetScore}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetScore: Number(event.target.value) as LiveGameDraft['targetScore'],
                  }))
                }
              >
                {TARGET_SCORE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} Punkte
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Einsatz</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="z. B. 5"
                value={draft.stakeAmountText}
                onChange={(event) => setDraft((current) => ({ ...current, stakeAmountText: event.target.value }))}
              />
            </label>
          </div>

          <div className="team-setup-grid">
            <div className="panel inset team-card team-card-a">
              <h3>Dein Team</h3>
              <label className="field">
                <span>Spieler 1</span>
                <input
                  type="text"
                  value={currentUsername ?? draft.teamAPlayers[0]}
                  onChange={(event) => updatePlayer(TEAM_A, 0, event.target.value)}
                  readOnly={Boolean(currentUsername)}
                  className={currentUsername ? 'readonly-input' : ''}
                />
              </label>
              <label className="field">
                <span>Spieler 2</span>
                <input
                  type="text"
                  placeholder="Vorname"
                  value={draft.teamAPlayers[1]}
                  onChange={(event) => updatePlayer(TEAM_A, 1, event.target.value)}
                />
              </label>
            </div>

            <div className="panel inset team-card team-card-b">
              <h3>Gegner</h3>
              <label className="field">
                <span>Spieler 1</span>
                <input
                  type="text"
                  placeholder="Vorname"
                  value={draft.teamBPlayers[0]}
                  onChange={(event) => updatePlayer(TEAM_B, 0, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Spieler 2</span>
                <input
                  type="text"
                  placeholder="Vorname"
                  value={draft.teamBPlayers[1]}
                  onChange={(event) => updatePlayer(TEAM_B, 1, event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="grid two">
            <label className="field">
              <span>Schlag in Runde 1 (optional)</span>
              <select
                value={draft.firstRoundSchlagSeat}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, firstRoundSchlagSeat: event.target.value as PlayerSeat | '' }))
                }
              >
                <option value="">Nicht erfassen</option>
                {seatOptions.map((option) => (
                  <option key={option.seat} value={option.seat}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Trumpf in Runde 1 (optional)</span>
              <select
                value={draft.firstRoundTrumpfSeat}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, firstRoundTrumpfSeat: event.target.value as PlayerSeat | '' }))
                }
              >
                <option value="">Nicht erfassen</option>
                {seatOptions.map((option) => (
                  <option key={option.seat} value={option.seat}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Notiz zum Spiel</span>
            <textarea
              rows={3}
              placeholder="Optional, z. B. Wirtshausrunde oder Preiswatten"
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="live-actions">
            <button className="primary-button" type="submit">
              Wattblock starten
            </button>
            {isEditing ? (
              <button className="ghost-button" type="button" onClick={resetGame}>
                Bearbeitung abbrechen
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="stack">
          <div className="panel live-header">
            <div>
              <p className="eyebrow">{isEditing ? 'Bearbeitung' : 'Live-Spiel'}</p>
              <h2>Bis {draft.targetScore} Punkte</h2>
            </div>
            <div className="live-actions">
              <button className="secondary-button" type="button" onClick={undoLastRound} disabled={draft.rounds.length === 0}>
                Letzte Runde loeschen
              </button>
              <button className="ghost-button" type="button" onClick={resetGame}>
                {isEditing ? 'Bearbeitung abbrechen' : 'Abbrechen'}
              </button>
            </div>
          </div>

          <div className="score-columns">
            <ScoreColumn
              label="Dein Team"
              players={[currentUsername ?? draft.teamAPlayers[0], draft.teamAPlayers[1]]}
              team={TEAM_A}
              rounds={draft.rounds}
              total={totals.A}
              winner={winner}
              gestrichenState={gestrichenState}
            />
            <ScoreColumn
              label="Gegner"
              players={draft.teamBPlayers}
              team={TEAM_B}
              rounds={draft.rounds}
              total={totals.B}
              winner={winner}
              gestrichenState={gestrichenState}
            />
          </div>

          {!winner ? (
            <div className="round-controls">
              <RoundButtons
                label="Dein Team bekommt"
                team={TEAM_A}
                onAddRound={addRound}
                gestrichenState={gestrichenState}
              />
              <RoundButtons
                label="Gegner bekommt"
                team={TEAM_B}
                onAddRound={addRound}
                gestrichenState={gestrichenState}
              />
            </div>
          ) : (
            <div className="panel complete-card">
              <p className="eyebrow">Spiel fertig</p>
              <h2>{winner === TEAM_A ? 'Dein Team gewinnt.' : 'Die Gegner gewinnen.'}</h2>
              <p>
                Endstand {totals.A}:{totals.B}. Jetzt speichern, damit das Spiel in der Liste und in deinen Statistiken
                auftaucht.
              </p>
              {error ? <p className="error-text">{error}</p> : null}
              <div className="live-actions">
                <button className="primary-button" type="button" onClick={saveFinishedGame} disabled={isSaving}>
                  {isSaving ? 'Speichert...' : 'Spiel speichern'}
                </button>
                <button className="secondary-button" type="button" onClick={undoLastRound}>
                  Letzte Runde korrigieren
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function buildSeatOptions(draft: LiveGameDraft, currentUsername: string | null): Array<{ seat: PlayerSeat; label: string }> {
  const labelBySeat: Record<PlayerSeat, string> = {
    A1: `Du (${(currentUsername ?? draft.teamAPlayers[0]) || 'Spieler 1'})`,
    B1: `Gegner 1 (${draft.teamBPlayers[0] || 'offen'})`,
    A2: `Partner (${draft.teamAPlayers[1] || 'offen'})`,
    B2: `Gegner 2 (${draft.teamBPlayers[1] || 'offen'})`,
  };

  return PLAYER_SEAT_ORDER.map((seat) => ({ seat, label: labelBySeat[seat] }));
}

interface RoundButtonsProps {
  label: string;
  team: TeamId;
  onAddRound: (team: TeamId, pointsAwarded: number, type: RoundType) => void;
  gestrichenState: ReturnType<typeof getGestrichenState>;
}

function RoundButtons({ label, team, onAddRound, gestrichenState }: RoundButtonsProps) {
  const isRestrictedTeam = gestrichenState?.trailing === team;
  const availableRoundPoints = isRestrictedTeam ? gestrichenState.trailingAllowedPoints : [...ROUND_POINT_OPTIONS];

  return (
    <div className="panel">
      <h3>{label}</h3>
      {isRestrictedTeam ? (
        <p className="restriction-copy">
          {gestrichenState.mode} gestrichen: Hier sind nur +{availableRoundPoints.join(' oder +')} erlaubt.
        </p>
      ) : null}
      <div className="round-button-grid">
        {availableRoundPoints.map((value) => (
          <button key={value} className="round-button" type="button" onClick={() => onAddRound(team, value, 'normal')}>
            +{value}
          </button>
        ))}
        <button className="round-button penalty-button" type="button" onClick={() => onAddRound(team, PENALTY_POINT_VALUE, 'penalty')}>
          Strafpunkt {PENALTY_POINT_VALUE}
        </button>
      </div>
    </div>
  );
}

interface ScoreColumnProps {
  label: string;
  players: [string, string];
  team: TeamId;
  rounds: RoundEntry[];
  total: number;
  winner: TeamId | null;
  gestrichenState: ReturnType<typeof getGestrichenState>;
}

function ScoreColumn({ label, players, team, rounds, total, winner, gestrichenState }: ScoreColumnProps) {
  const entries = rounds.filter((round) => round.team === team);
  const cumulativeEntries = entries.map((entry, index) => ({
    ...entry,
    totalAfterRound: entries.slice(0, index + 1).reduce((sum, current) => sum + current.pointsAwarded, 0),
  }));
  const gestrichen = gestrichenState?.leader === team;
  const isWinner = winner === team;

  return (
    <article className={`panel score-column ${gestrichen ? 'gestrichen' : ''} ${isWinner ? 'winner-column' : ''}`}>
      <div className="score-head">
        <p className="eyebrow">{label}</p>
        <h3>
          {players[0]} &amp; {players[1]}
        </h3>
        <div className="score-badge">
          <span>{total}</span>
        </div>
      </div>

      {gestrichen ? <div className="gestrichen-label">{gestrichenState.mode} gestrichen</div> : null}

      <ol className="score-list" aria-label={`${label} Punkte`}>
        {entries.length === 0 ? <li className="score-empty">Noch kein Eintrag</li> : null}
        {cumulativeEntries.map((entry) => (
          <li key={entry.id} className={`score-entry ${entry.type === 'penalty' ? 'penalty-entry' : ''}`}>
            <span>{entry.totalAfterRound}</span>
            <small>{entry.type === 'penalty' ? `Strafe ${entry.pointsAwarded}` : `+${entry.pointsAwarded}`}</small>
          </li>
        ))}
      </ol>
    </article>
  );
}
