import type { GameState, SeoulFeatureCollection, StationCommand, TurnResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export async function fetchSeoulMap(): Promise<SeoulFeatureCollection> {
  const response = await fetch(`${API_BASE}/map/seoul`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("서울 경계 데이터를 불러오지 못했습니다.");
  }
  return response.json();
}

export async function createGame(): Promise<GameState> {
  const response = await fetch(`${API_BASE}/game/new`, { method: "POST" });
  if (!response.ok) {
    throw new Error("새 게임을 시작하지 못했습니다.");
  }
  const payload = await response.json();
  return payload.state;
}

export async function runTurn(
  gameId: string,
  commands: StationCommand[]
): Promise<TurnResponse> {
  const response = await fetch(`${API_BASE}/game/${gameId}/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = typeof payload?.detail === "string" ? payload.detail : "턴을 진행하지 못했습니다.";
    const messages: Record<string, string> = {
      "Insufficient budget": "예산이 부족합니다. 정책 수를 줄이거나 새 작전을 시작하세요.",
      "Insufficient response teams": "투입 가능한 방역팀이 부족합니다. 정책 수를 줄여주세요.",
      "Game not found": "게임 세션이 만료되었습니다. 새 작전을 시작하세요."
    };
    throw new Error(messages[detail] ?? detail);
  }
  return response.json();
}

export async function hireTeam(gameId: string, count = 1): Promise<GameState> {
  const response = await fetch(`${API_BASE}/game/${gameId}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = typeof payload?.detail === "string" ? payload.detail : "방역팀을 편성하지 못했습니다.";
    const messages: Record<string, string> = {
      "Insufficient budget": "방역팀 편성 예산이 부족합니다.",
      "Maximum response teams exceeded": "편성 가능한 방역팀 수를 초과했습니다.",
      "Game not found": "게임 세션이 만료되었습니다. 새 작전을 시작하세요."
    };
    throw new Error(messages[detail] ?? detail);
  }
  return response.json();
}
