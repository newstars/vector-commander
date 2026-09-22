"use client";

import type {
  GameState,
  PolicyType,
  StationState,
  StationTurnDelta
} from "../lib/types";

const policyLabels: Record<PolicyType, string> = {
  larvicide: "배수로 유충 구제",
  fogging: "역세권 성충 방제",
  source_reduction: "고인물 제거",
  surveillance: "출입구 감시 강화",
  ovitrap: "유인산란트랩",
  habitat_mapping: "역세권 서식지 지도",
  public_campaign: "승객 행동 캠페인",
  targeted_inspection: "표적 현장점검"
};

const allPolicies = Object.keys(policyLabels) as PolicyType[];

type Props = {
  game: GameState | null;
  selectedStation: StationState | null;
  focusedCode: string;
  selectedCodes: string[];
  plans: Record<string, PolicyType[]>;
  policies: PolicyType[];
  stationDeltas: StationTurnDelta[];
  busy: boolean;
  error: string;
  onSelectStation: (code: string) => void;
  onRemoveStation: (code: string) => void;
  onPoliciesChange: (policies: PolicyType[]) => void;
  onHireTeam: () => void;
  onExecute: () => void;
  onRestart: () => void;
};

export function CommandPanel({
  game,
  selectedStation,
  focusedCode,
  selectedCodes,
  plans,
  policies,
  stationDeltas,
  busy,
  error,
  onSelectStation,
  onRemoveStation,
  onPoliciesChange,
  onHireTeam,
  onExecute,
  onRestart
}: Props) {
  const plannedPolicies = Object.values(plans).flat();
  const totalCost = plannedPolicies.reduce(
    (total, policy) => {
      const cost = game?.rules.policy_costs[policy];
      return {
        budget: total.budget + (cost?.budget ?? 0),
        teams: total.teams + (cost?.teams ?? 0)
      };
    },
    { budget: 0, teams: 0 }
  );
  const plannedStationCount = Object.values(plans).filter((items) => items.length > 0).length;
  const canExecute = Boolean(
    game && totalCost.budget <= game.resources.budget && totalCost.teams <= game.resources.teams
  );
  const canHire = Boolean(
    game &&
      game.resources.teams < game.rules.max_teams &&
      game.resources.budget >= game.rules.team_hire_cost
  );
  const focusedDelta = stationDeltas.find((delta) => delta.station_code === focusedCode);
  const largestChanges = [...stationDeltas]
    .sort((a, b) => Math.abs(b.risk_delta) - Math.abs(a.risk_delta))
    .slice(0, 4);
  const stationsByRidership = [...(game?.stations ?? [])].sort(
    (a, b) => b.daily_ridership - a.daily_ridership
  );

  function togglePolicy(policy: PolicyType) {
    onPoliciesChange(
      policies.includes(policy)
        ? policies.filter((item) => item !== policy)
        : [...policies, policy]
    );
  }

  return (
    <aside className="command-panel">
      <div className="panel-section">
        <p className="eyebrow">동시 작전 역세권 · {selectedCodes.length}개 역</p>
        <select value={focusedCode} onChange={(event) => onSelectStation(event.target.value)}>
          <option value="" disabled>지하철역 선택</option>
          {stationsByRidership.map((station) => (
            <option key={station.code} value={station.code}>
              {station.name} · {station.daily_ridership.toLocaleString()}명
            </option>
          ))}
        </select>
        <div className="district-chips">
          {selectedCodes.map((code) => {
            const station = game?.stations.find((item) => item.code === code);
            return station ? (
              <span key={code} className={code === focusedCode ? "district-chip focused" : "district-chip"}>
                <button type="button" onClick={() => onSelectStation(code)}>{station.name}</button>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`${station.name} 작전 역 제거`}
                  onClick={() => onRemoveStation(code)}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
      </div>

      {selectedStation ? (
        <>
          <div className="district-readout station-readout">
            <div>
              <h2>{selectedStation.name}역</h2>
              <p>{selectedStation.district_name} · {selectedStation.activity_type}</p>
              <div className="line-badges">
                {selectedStation.lines.map((line) => <span key={line}>{line}</span>)}
              </div>
            </div>
            <strong>{selectedStation.exposure_risk.toFixed(1)}</strong>
          </div>

          <div className="metrics station-metrics">
            <Metric label="일평균 승하차" value={`${selectedStation.daily_ridership.toLocaleString()}명`} />
            <Metric label="추정 생활인구" value={`${selectedStation.living_population.toLocaleString()}명`} />
            <Metric label="성충" value={selectedStation.mosquito_adults.toFixed(0)} />
            <Metric label="번식지" value={selectedStation.breeding_sites.toFixed(1)} />
            <Metric label="감염 유입" value={`${selectedStation.infected_arrivals.toFixed(0)}명`} />
            <Metric label="서식 압력" value={selectedStation.habitat_index.toFixed(2)} />
          </div>
          <p className="population-note">
            승하차량은 서울시 공개 통계, 생활인구·감염 유입·서식 압력은 역세권 시나리오 추정치입니다.
          </p>
        </>
      ) : null}

      <div className="team-control">
        <div>
          <span>가용 방역팀</span>
          <strong>{game?.resources.teams ?? 0}/{game?.rules.max_teams ?? 0}팀</strong>
        </div>
        <button type="button" disabled={busy || !canHire} onClick={onHireTeam}>
          1팀 편성 · {formatWon(game?.rules.team_hire_cost ?? 0)}
        </button>
      </div>

      <div className="panel-section">
        <p className="eyebrow">{selectedStation ? `${selectedStation.name}역` : "선택 역"} 정책 명령</p>
        <div className="policy-grid">
          {allPolicies.map((policy) => (
            <button
              key={policy}
              type="button"
              className={policies.includes(policy) ? "policy selected" : "policy"}
              disabled={!selectedStation}
              onClick={() => togglePolicy(policy)}
            >
              <span>{policyLabels[policy]}</span>
              <small>
                {formatWon(game?.rules.policy_costs[policy].budget ?? 0)} · {game?.rules.policy_costs[policy].teams ?? 0}팀
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="command-cost">
        <span>{plannedStationCount ? `${plannedStationCount}개 역 동시 작전` : "선택 작전 없음"}</span>
        <strong>{formatWon(totalCost.budget)} · {totalCost.teams}팀</strong>
      </div>

      <button className="execute" type="button" disabled={busy || !canExecute} onClick={onExecute}>
        {busy ? "작전 처리 중" : plannedPolicies.length ? "역세권 동시 작전 · 1주 진행" : "무대응으로 1주 진행"}
      </button>

      {!canExecute && game ? (
        <p className="warning">가용 예산 또는 방역팀 범위 안에서 작전을 편성하세요.</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {focusedDelta ? (
        <section className="turn-result">
          <div className="result-heading">
            <p className="eyebrow">턴 결과 · {selectedStation?.name}역</p>
            <strong className={focusedDelta.risk_delta <= 0 ? "delta down" : "delta up"}>
              위험 {formatDelta(focusedDelta.risk_delta)}
            </strong>
          </div>
          <div className="delta-grid">
            <Delta label="성충" value={focusedDelta.adults_delta} />
            <Delta label="번식지" value={focusedDelta.breeding_delta} />
            <Delta label="감염 유입" value={focusedDelta.arrivals_delta} />
            <Delta label="생활인구" value={focusedDelta.living_population_delta} integer />
          </div>
          <div className="network-changes">
            {largestChanges.map((delta) => {
              const station = game?.stations.find((item) => item.code === delta.station_code);
              return (
                <span key={delta.station_code}>
                  {station?.name} <b className={delta.risk_delta <= 0 ? "delta down" : "delta up"}>
                    {formatDelta(delta.risk_delta)}
                  </b>
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="panel-section">
        <p className="eyebrow">상황 기록</p>
        <div className="log">
          {game?.event_log.slice(-4).map((item) => <p key={item}>{item}</p>)}
        </div>
      </div>

      <button className="restart" type="button" disabled={busy} onClick={onRestart}>
        새 작전 시작
      </button>

      <section className="references">
        <p className="eyebrow">데이터·모델 레퍼런스</p>
        <a href="https://data.seoul.go.kr/dataList/OA-12914/S/1/datasetView.do" target="_blank" rel="noreferrer">
          서울시 역별 승하차 인원
        </a>
        <a href="https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036" target="_blank" rel="noreferrer">
          서울시 지하철역 역사 마스터
        </a>
        <a href="https://doi.org/10.3390/ijerph14070792" target="_blank" rel="noreferrer">
          Kang &amp; Aldstadt (2017), spatial dengue ABM
        </a>
        <p>강전영 교수의 공개 공간 ABM 연구 기반이며, 승하차량 외 역세권 파라미터는 시나리오 추정치입니다.</p>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Delta({ label, value, integer = false }: { label: string; value: number; integer?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={value <= 0 ? "delta down" : "delta up"}>
        {formatDelta(value, integer ? 0 : 1)}
      </strong>
    </div>
  );
}

function formatDelta(value: number, digits = 1): string {
  const rounded = value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return value > 0 ? `+${rounded}` : rounded;
}

function formatWon(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억원`;
  }
  return `${(value / 10_000).toLocaleString("ko-KR")}만원`;
}
