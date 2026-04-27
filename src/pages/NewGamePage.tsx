import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  getGestrichenState,
  PENALTY_POINT_VALUE,
  ROUND_POINT_OPTIONS,
  TARGET_SCORE_OPTIONS,
  TEAM_A,
  TEAM_B,
  calculateTotals,
  getWinner,
} from '../lib/gameLogic';
import type { Game, LiveGameDraft, RoundEntry, RoundType, TeamId } from '../types';

interface NewGamePageProps {
  onSaveGame: (game: Game) => Promise<void>;
  saveDisabled?: boolean;
}

const initialDraft: LiveGameDraft = {
  targetScore: 15,
  teamAPlayers: ['', ''],
  teamBPlayers: ['', ''],
  stakeAmountText: '',
  note: '',
  rounds: [],
};

export function NewGamePage({ onSaveGame, saveDisabled = false }: NewGamePageProps) {
  const [draft, setDraft] = useState<LiveGameDraft>(initialDraft);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => calculateTotals(draft.rounds), [draft.rounds]);
  const winner = useMemo(() => getWinner(draft.rounds, draft.targetScore), [draft.rounds, draft.targetScore]);
  const gestrichenState = useMemo(
    () => getGestrichenState(draft.rounds, draft.targetScore),
    [draft.rounds, draft.targetScore],
  );

  function updatePlayer(team: TeamId, index: 0 | 1, value: string) {
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
    };

    setDraft((current) => ({ ...current, rounds: [...current.rounds, round] }));
  }

  function undoLastRound() {
    setDraft((current) => ({ ...current, rounds: current.rounds.slice(0, -1) }));
  }

  function resetGame() {
    setDraft(initialDraft);
    setHasStarted(false);
    setError(null);
  }

  async function saveFinishedGame() {
    if (!winner) {
      return;
    }

    const stakeAmount =
      draft.stakeAmountText.trim() === '' ? undefined : Number.parseFloat(draft.stakeAmountText.replace(',', '.'));

    if (draft.stakeAmountText.trim() !== '' && Number.isNaN(stakeAmount)) {
      setError('Der Einsatz muss eine Zahl sein, z. B. 5 oder -2.50.');
      return;
    }

    const game: Game = {
      id: crypto.randomUUID(),
      playedAt: new Date().toISOString(),
      targetScore: draft.targetScore,
      teamA: { id: TEAM_A, name: 'Dein Team', players: draft.teamAPlayers },
      teamB: { id: TEAM_B, name: 'Gegner', players: draft.teamBPlayers },
      rounds: draft.rounds,
      finalTotals: totals,
      winnerTeam: winner,
      stakeAmount,
      note: draft.note.trim() || undefined,
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

  return (
    <section className="page">
      <div className="hero-card">
        <p className="eyebrow">Südtiroler Wattblock</p>
        <h1>Spiel mitschreiben, speichern und später sauber auswerten.</h1>
        <p className="hero-copy">
          Dein Team ist immer links. Du startest schnell mit vier Namen, schreibst die Runden wie auf Papier mit und
          siehst danach sofort deine Statistik und den Geldstand.
        </p>
      </div>

      {!hasStarted ? (
        <form className="panel stack" onSubmit={startGame}>
          <div className="section-heading">
            <h2>Neues Spiel</h2>
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
              <span>Geldstand aus deiner Sicht</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="z. B. 5 oder -3.50"
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
                  placeholder="Vorname"
                  value={draft.teamAPlayers[0]}
                  onChange={(event) => updatePlayer(TEAM_A, 0, event.target.value)}
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

          {saveDisabled ? <p className="restriction-copy">Zum Speichern bitte zuerst per Magic Link anmelden.</p> : null}

          <button className="primary-button" type="submit" disabled={saveDisabled}>
            Wattblock starten
          </button>
        </form>
      ) : (
        <div className="stack">
          <div className="panel live-header">
            <div>
              <p className="eyebrow">Live-Spiel</p>
              <h2>
                Bis {draft.targetScore} Punkte
              </h2>
            </div>
            <div className="live-actions">
              <button className="secondary-button" type="button" onClick={undoLastRound} disabled={draft.rounds.length === 0}>
                Letzte Runde löschen
              </button>
              <button className="ghost-button" type="button" onClick={resetGame}>
                Abbrechen
              </button>
            </div>
          </div>

          <div className="score-columns">
            <ScoreColumn
              label="Dein Team"
              players={draft.teamAPlayers}
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
                <button className="primary-button" type="button" onClick={saveFinishedGame} disabled={isSaving || saveDisabled}>
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
