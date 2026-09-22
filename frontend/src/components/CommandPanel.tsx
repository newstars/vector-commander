"use client";

import type { DistrictState, GameState, PolicyType } from "../lib/types";

const policyLabels: Record<PolicyType, string> = {
  larvicide: "유충 구제",
  fogging: "성충 방제",
  source_reduction: "번식지 제거",
  surveillance: "감시 강화",
  ovitrap: "유인산란트랩",
  habitat_mapping: "서식지 정밀지도",
  public_campaign: "주민 행동 캠페인",
  targeted_inspection: "표적 현장점검"
};

const allPolicies = Object.keys(policyLabels) as PolicyType[];

type Props = {
  game: GameState | null;
  selectedDistrict: DistrictState | null;
  focusedCode: string;
  selectedCodes: string[];
  plans: Record<string, PolicyType[]>;
  policies: PolicyType[];
  busy: boolean;
  error: string;
  onSelectDistrict: (code: string) => void;
  onRemoveDistrict: (code: string) => void;
  onPoliciesChange: (policies: PolicyType[]) => void;
  onHireTeam: () => void;
  onExecute: () => void;
  onRestart: () => void;
};

export function CommandPanel({
  game,
  selectedDistrict,
  focusedCode,
  selectedCodes,
  plans,
  policies,
  busy,
  error,
  onSelectDistrict,
  onRemoveDistrict,
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
  const plannedDistrictCount = Object.values(plans).filter((items) => items.length > 0).length;
  const canExecute = Boolean(
    game && totalCost.budget <= game.resources.budget && totalCost.teams <= game.resources.teams
  );
  const canHire = Boolean(
    game &&
      game.resources.teams < game.rules.max_teams &&
      game.resources.budget >= game.rules.team_hire_cost
  );

  function togglePolicy(policy: PolicyType) {
    if (policies.includes(policy)) {
      onPoliciesChange(policies.filter((item) => item !== policy));
    } else {
      onPoliciesChange([...policies, policy]);
    }
  }

  return (
    <aside className="command-panel">
      <div className="panel-section">
        <p className="eyebrow">동시 작전 구역 · {selectedCodes.length}개 구</p>
        <select value={focusedCode} onChange={(event) => onSelectDistrict(event.target.value)}>
          <option value="" disabled>자치구 선택</option>
          {game?.districts.map((district) => (
            <option key={district.code} value={district.code}>
              {district.name}
            </option>
          ))}
        </select>
        <div className="district-chips">
          {selectedCodes.map((code) => {
            const district = game?.districts.find((item) => item.code === code);
            return district ? (
              <span key={code} className={code === focusedCode ? "district-chip focused" : "district-chip"}>
                <button type="button" onClick={() => onSelectDistrict(code)}>{district.name}</button>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`${district.name} 작전 구역 제거`}
                  onClick={() => onRemoveDistrict(code)}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
      </div>

      {selectedDistrict ? (
        <div className="district-readout">
          <div>
            <h2>{selectedDistrict.name}</h2>
            <p>{selectedDistrict.name_eng}</p>
          </div>
          <strong>{selectedDistrict.infection_risk.toFixed(1)}</strong>
        </div>
      ) : null}

      {selectedDistrict ? (
        <div className="metrics">
          <Metric label="성충" value={selectedDistrict.mosquito_adults.toFixed(0)} />
          <Metric label="유충" value={selectedDistrict.larvae.toFixed(0)} />
          <Metric label="번식지" value={selectedDistrict.breeding_sites.toFixed(1)} />
          <Metric label="감염 벡터" value={`${(selectedDistrict.infected_vector_ratio * 100).toFixed(2)}%`} />
          <Metric label="등록인구" value={`${selectedDistrict.resident_population.toLocaleString()}명`} />
          <Metric label="추정 생활인구" value={`${selectedDistrict.floating_population.toLocaleString()}명`} />
        </div>
      ) : null}

      {selectedDistrict ? (
        <p className="population-note">생활인구는 현재 샘플 ABM의 주간 추정치입니다.</p>
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
        <p className="eyebrow">{selectedDistrict?.name ?? "선택 구역"} 정책 명령</p>
        <div className="policy-grid">
          {allPolicies.map((policy) => (
            <button
              key={policy}
              type="button"
              className={policies.includes(policy) ? "policy selected" : "policy"}
              disabled={!selectedDistrict}
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
        <span>{plannedDistrictCount ? `${plannedDistrictCount}개 구 동시 작전` : "선택 작전 없음"}</span>
        <strong>{formatWon(totalCost.budget)} · {totalCost.teams}팀</strong>
      </div>

      <button className="execute" type="button" disabled={busy || !canExecute} onClick={onExecute}>
        {busy ? "작전 처리 중" : plannedPolicies.length ? "동시 작전 실행 후 1주 진행" : "무대응으로 1주 진행"}
      </button>

      {!canExecute && game ? (
        <p className="warning">가용 예산 또는 방역팀 범위 안에서 작전을 편성하세요.</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="panel-section">
        <p className="eyebrow">상황 기록</p>
        <div className="log">
          {game?.event_log.slice(-4).map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>

      <button className="restart" type="button" disabled={busy} onClick={onRestart}>
        새 작전 시작
      </button>

      <section className="references">
        <p className="eyebrow">모델 레퍼런스</p>
        <a href="https://doi.org/10.3390/ijerph14070792" target="_blank" rel="noreferrer">
          Kang &amp; Aldstadt (2017), spatial dengue ABM
        </a>
        <a href="https://doi.org/10.1016/j.compenvurbsys.2019.02.006" target="_blank" rel="noreferrer">
          Kang &amp; Aldstadt (2019), spatial ABM sensitivity
        </a>
        <p>강전영 교수의 공개 공간 ABM 연구 기반이며, 현재 파라미터는 논문 원본 재현값이 아닙니다.</p>
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

function formatWon(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억원`;
  }
  return `${(value / 10_000).toLocaleString("ko-KR")}만원`;
}
