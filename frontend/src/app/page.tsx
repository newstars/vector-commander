"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandPanel } from "../components/CommandPanel";
import { SeoulMap } from "../components/SeoulMap";
import { createGame, fetchSeoulMap, hireTeam, runTurn } from "../lib/api";
import type { GameState, MovementFlow, PolicyType, SeoulFeatureCollection } from "../lib/types";

type DistrictPlans = Record<string, PolicyType[]>;

export default function Home() {
  const [mapData, setMapData] = useState<SeoulFeatureCollection | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [focusedCode, setFocusedCode] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [plans, setPlans] = useState<DistrictPlans>({});
  const [movements, setMovements] = useState<MovementFlow[]>([]);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function boot() {
      try {
        const [geojson, state] = await Promise.all([fetchSeoulMap(), createGame()]);
        const firstCode = state.districts[0]?.code ?? "";
        setMapData(geojson);
        setGame(state);
        setFocusedCode(firstCode);
        setSelectedCodes(firstCode ? [firstCode] : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "초기화 실패");
      }
    }
    boot();
  }, []);

  const selectedDistrict = useMemo(
    () => game?.districts.find((district) => district.code === focusedCode) ?? null,
    [game, focusedCode]
  );
  const currentPolicies = plans[focusedCode] ?? [];

  function selectDistrict(code: string) {
    setFocusedCode(code);
    setSelectedCodes((current) => (current.includes(code) ? current : [...current, code]));
  }

  function removeDistrict(code: string) {
    setSelectedCodes((current) => {
      const next = current.filter((item) => item !== code);
      if (focusedCode === code) setFocusedCode(next[0] ?? "");
      return next;
    });
    setPlans((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
  }

  function changePolicies(policies: PolicyType[]) {
    if (!focusedCode) return;
    setPlans((current) => ({ ...current, [focusedCode]: policies }));
  }

  async function executeTurn() {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      const commands = Object.entries(plans)
        .filter(([, policies]) => policies.length > 0)
        .map(([districtCode, policies]) => ({ district_code: districtCode, policies }));
      const response = await runTurn(game.game_id, commands);
      setGame(response.state);
      setMovements(response.movements);
      setPlans({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "턴 실행 실패");
    } finally {
      setBusy(false);
    }
  }

  async function hireResponseTeam() {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      setGame(await hireTeam(game.game_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "방역팀 편성 실패");
    } finally {
      setBusy(false);
    }
  }

  async function restartGame() {
    setBusy(true);
    setError("");
    try {
      const state = await createGame();
      const firstCode = state.districts[0]?.code ?? "";
      setGame(state);
      setFocusedCode(firstCode);
      setSelectedCodes(firstCode ? [firstCode] : []);
      setPlans({});
      setMovements([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "새 작전 시작 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Vector Commander</p>
          <h1>모기전쟁</h1>
        </div>
        {game ? (
          <div className="stats">
            <StatusItem label="진행" value={`턴 ${game.turn}`} />
            <StatusItem label="기간" value={`${game.week}주차 · ${calendarLabel(game.year, game.week)}`} />
            <StatusItem label="평균기온" value={`${game.temperature_c}°C`} />
            <StatusItem label="주간강수" value={`${game.precipitation_mm}mm`} />
            <StatusItem label="가용예산" value={formatWon(game.resources.budget)} />
            <StatusItem label="방역팀" value={`${game.resources.teams}/${game.rules.max_teams}`} />
          </div>
        ) : null}
      </section>

      <section className="war-room">
        <SeoulMap
          geojson={mapData}
          districts={game?.districts ?? []}
          focusedCode={focusedCode}
          selectedCodes={selectedCodes}
          movements={movements}
          populationMovements={game?.population_movements ?? []}
          onSelect={selectDistrict}
        />
        <CommandPanel
          game={game}
          selectedDistrict={selectedDistrict}
          focusedCode={focusedCode}
          selectedCodes={selectedCodes}
          plans={plans}
          policies={currentPolicies}
          busy={busy}
          error={error}
          onSelectDistrict={selectDistrict}
          onRemoveDistrict={removeDistrict}
          onPoliciesChange={changePolicies}
          onHireTeam={hireResponseTeam}
          onExecute={executeTurn}
          onRestart={restartGame}
        />
      </section>
    </main>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="status-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function calendarLabel(year: number, week: number): string {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekday = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - weekday + 1 + (week - 1) * 7);
  const monthStart = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1));
  const weekOfMonth = Math.ceil((monday.getUTCDate() + monthStart.getUTCDay()) / 7);
  return `${monday.getUTCMonth() + 1}월 ${weekOfMonth}주`;
}

function formatWon(value: number): string {
  if (value >= 100_000_000) {
    const amount = value / 100_000_000;
    return `${amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억원`;
  }
  return `${(value / 10_000).toLocaleString("ko-KR")}만원`;
}
