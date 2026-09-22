from __future__ import annotations

import json
import math
import uuid
from pathlib import Path

from app.simulation.adapters import SampleMosquitoAdapter, SimulationAdapter, SimulationContext
from app.simulation.schemas import (
    DistrictCommand,
    DistrictState,
    GameResources,
    GameRules,
    GameState,
    HireTeamRequest,
    MovementFlow,
    NewGameResponse,
    PopulationMovementFlow,
    PolicyCost,
    PolicyType,
    TurnRequest,
    TurnResponse,
)


class GameEngine:
    def __init__(
        self,
        geojson_path: Path,
        config_path: Path,
        adapter: SimulationAdapter | None = None,
    ) -> None:
        self.geojson_path = geojson_path
        self.config_path = config_path
        self.map_geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.policy_costs = {
            PolicyType(name): PolicyCost(**cost)
            for name, cost in self.config["policy_costs"].items()
        }
        self.adapter = adapter or SampleMosquitoAdapter()
        self.neighbor_map = self._build_neighbor_map()
        self.games: dict[str, GameState] = {}

    def new_game(self) -> NewGameResponse:
        game_id = str(uuid.uuid4())
        districts = self._initial_districts()
        state = GameState(
            game_id=game_id,
            turn=0,
            year=int(self.config["year"]),
            week=int(self.config["week"]),
            temperature_c=float(self.config["temperature_c"]),
            precipitation_mm=float(self.config["precipitation_mm"]),
            resources=GameResources(
                budget=int(self.config["initial_budget"]),
                teams=int(self.config["initial_teams"]),
            ),
            rules=GameRules(
                policy_costs=self.policy_costs,
                weekly_budget_income=int(self.config["weekly_budget_income"]),
                team_hire_cost=int(self.config["team_hire_cost"]),
                max_teams=int(self.config["max_teams"]),
            ),
            districts=districts,
            population_movements=self._population_movement_flows(districts),
            event_log=[
                "서울 전역 감시망 가동. 기본 파라미터는 검증용 샘플입니다.",
            ],
        )
        self.games[game_id] = state
        return NewGameResponse(game_id=game_id, state=state)

    def get_game(self, game_id: str) -> GameState | None:
        return self.games.get(game_id)

    def hire_teams(self, game_id: str, request: HireTeamRequest) -> GameState:
        state = self.games.get(game_id)
        if state is None:
            raise KeyError("Game not found")
        if state.resources.teams + request.count > state.rules.max_teams:
            raise ValueError("Maximum response teams exceeded")

        cost = state.rules.team_hire_cost * request.count
        if cost > state.resources.budget:
            raise ValueError("Insufficient budget")

        next_state = state.model_copy(
            update={
                "resources": GameResources(
                    budget=state.resources.budget - cost,
                    teams=state.resources.teams + request.count,
                ),
                "event_log": [
                    *state.event_log[-5:],
                    f"방역팀 {request.count}개 편성, 예산 {cost:,} 사용.",
                ],
            }
        )
        self.games[game_id] = next_state
        return next_state

    def run_turn(self, game_id: str, request: TurnRequest) -> TurnResponse:
        state = self.games.get(game_id)
        if state is None:
            raise KeyError("Game not found")
        interventions = self._validate_and_price_commands(state, request.commands)

        next_week = 1 + (state.week % 52)
        next_year = state.year + 1 if next_week == 1 else state.year
        temperature, precipitation = self._weather_for_week(next_week, state.turn + 1)
        context = SimulationContext(
            turn=state.turn + 1,
            week=next_week,
            temperature_c=temperature,
            precipitation_mm=precipitation,
            neighbor_map=self.neighbor_map,
        )
        next_districts, deltas = self.adapter.step(state.districts, interventions, context)
        next_districts = self._update_floating_population(
            next_districts,
            turn=state.turn + 1,
            week=next_week,
        )
        movements = self._movement_flows(state.districts)

        budget_spent, teams_spent = self._command_costs(request.commands)
        if request.commands:
            turn_summary = (
                f"{state.turn + 1}턴: {len(request.commands)}개 지역에 정책 실행, "
                f"예산 {budget_spent:,} 사용, 팀 {teams_spent}개 투입, "
                f"주간 예산 {state.rules.weekly_budget_income:,} 배정."
            )
        else:
            turn_summary = (
                f"{state.turn + 1}턴: 방역 정책 없이 1주 경과, "
                f"주간 예산 {state.rules.weekly_budget_income:,} 배정."
            )
        event_log = [
            *state.event_log[-5:],
            turn_summary,
        ]
        next_state = state.model_copy(
            update={
                "turn": state.turn + 1,
                "year": next_year,
                "week": next_week,
                "temperature_c": temperature,
                "precipitation_mm": precipitation,
                "resources": GameResources(
                    budget=state.resources.budget
                    - budget_spent
                    + state.rules.weekly_budget_income,
                    teams=state.resources.teams,
                ),
                "districts": next_districts,
                "population_movements": self._population_movement_flows(next_districts),
                "event_log": event_log,
            }
        )
        self.games[game_id] = next_state
        return TurnResponse(
            status="advanced",
            state=next_state,
            deltas=deltas,
            movements=movements,
        )

    def _movement_flows(self, districts: list[DistrictState]) -> list[MovementFlow]:
        by_code = {district.code: district for district in districts}
        seen_edges: set[tuple[str, str]] = set()
        flows: list[MovementFlow] = []

        for code, neighbors in self.neighbor_map.items():
            for neighbor_code in neighbors:
                edge = tuple(sorted((code, neighbor_code)))
                if edge in seen_edges:
                    continue
                seen_edges.add(edge)
                first = by_code[code]
                second = by_code[neighbor_code]
                difference = first.mosquito_adults - second.mosquito_adults
                if abs(difference) < 20:
                    continue
                source, target = (first, second) if difference > 0 else (second, first)
                flows.append(
                    MovementFlow(
                        from_code=source.code,
                        to_code=target.code,
                        estimated_adults=round(abs(difference) * 0.00625, 2),
                    )
                )

        return sorted(flows, key=lambda flow: flow.estimated_adults, reverse=True)[:18]

    def _population_movement_flows(
        self,
        districts: list[DistrictState],
    ) -> list[PopulationMovementFlow]:
        by_code = {district.code: district for district in districts}
        seen_edges: set[tuple[str, str]] = set()
        flows: list[PopulationMovementFlow] = []

        for code, neighbors in self.neighbor_map.items():
            for neighbor_code in neighbors:
                edge = tuple(sorted((code, neighbor_code)))
                if edge in seen_edges:
                    continue
                seen_edges.add(edge)
                first = by_code[code]
                second = by_code[neighbor_code]
                first_ratio = first.floating_population / first.resident_population
                second_ratio = second.floating_population / second.resident_population
                difference = first_ratio - second_ratio
                if abs(difference) < 0.015:
                    continue
                source, target = (second, first) if difference > 0 else (first, second)
                estimated_people = round(
                    min(first.resident_population, second.resident_population)
                    * abs(difference)
                    * 0.08
                )
                if estimated_people < 100:
                    continue
                flows.append(
                    PopulationMovementFlow(
                        from_code=source.code,
                        to_code=target.code,
                        estimated_people=estimated_people,
                    )
                )

        return sorted(flows, key=lambda flow: flow.estimated_people, reverse=True)[:14]

    def _validate_and_price_commands(
        self,
        state: GameState,
        commands: list[DistrictCommand],
    ) -> dict[str, list[PolicyType]]:
        known_codes = {district.code for district in state.districts}
        seen: set[str] = set()
        for command in commands:
            if command.district_code not in known_codes:
                raise ValueError(f"Unknown district code: {command.district_code}")
            if command.district_code in seen:
                raise ValueError(f"Duplicate command for district: {command.district_code}")
            seen.add(command.district_code)

        budget, teams = self._command_costs(commands)
        if budget > state.resources.budget:
            raise ValueError("Insufficient budget")
        if teams > state.resources.teams:
            raise ValueError("Insufficient response teams")
        return {command.district_code: command.policies for command in commands}

    def _command_costs(self, commands: list[DistrictCommand]) -> tuple[int, int]:
        budget = 0
        teams = 0
        for command in commands:
            unique_policies = set(command.policies)
            budget += sum(self.policy_costs[policy].budget for policy in unique_policies)
            teams += sum(self.policy_costs[policy].teams for policy in unique_policies)
        return budget, teams

    def _initial_districts(self) -> list[DistrictState]:
        districts: list[DistrictState] = []
        overrides = self.config.get("district_overrides", {})
        for idx, feature in enumerate(self.map_geojson["features"]):
            props = feature["properties"]
            name = props["name"]
            centroid = self._centroid(feature["geometry"]["coordinates"][0])
            override = overrides.get(name, {})
            water = float(override.get("water_index", 0.45 + (idx % 5) * 0.11))
            population = float(override.get("population_index", 0.82 + (idx % 7) * 0.07))
            heat = float(override.get("urban_heat_index", 0.94 + (idx % 4) * 0.04))
            resident_population = int(self.config["resident_population"][name])
            floating_population = self._floating_population(
                resident_population,
                population,
                turn=0,
                week=int(self.config["week"]),
            )
            base = 380 + (idx * 37) % 340
            breeding = 34 + water * 36
            larvae = breeding * 5.8
            adults = base * population * (0.85 + water * 0.18)
            districts.append(
                DistrictState(
                    code=props["code"],
                    name=name,
                    name_eng=props["name_eng"],
                    centroid=centroid,
                    mosquito_adults=round(adults, 2),
                    larvae=round(larvae, 2),
                    breeding_sites=round(breeding, 2),
                    infected_vector_ratio=round(0.012 + (idx % 6) * 0.002, 4),
                    infection_risk=0,
                    resident_population=resident_population,
                    floating_population=floating_population,
                    population_index=population,
                    water_index=water,
                    urban_heat_index=heat,
                )
            )
        seeded, _ = self.adapter.step(
            districts,
            {},
            SimulationContext(
                turn=0,
                week=int(self.config["week"]),
                temperature_c=float(self.config["temperature_c"]),
                precipitation_mm=float(self.config["precipitation_mm"]),
                neighbor_map=self.neighbor_map,
            ),
        )
        return seeded

    def _update_floating_population(
        self,
        districts: list[DistrictState],
        turn: int,
        week: int,
    ) -> list[DistrictState]:
        return [
            district.model_copy(
                update={
                    "floating_population": self._floating_population(
                        district.resident_population,
                        district.population_index,
                        turn,
                        week,
                    )
                }
            )
            for district in districts
        ]

    def _floating_population(
        self,
        resident_population: int,
        population_index: float,
        turn: int,
        week: int,
    ) -> int:
        weekly_wave = 1.0 + 0.055 * math.sin((week / 52.0) * math.tau + turn * 0.7)
        activity_multiplier = 0.76 + 0.26 * population_index
        return round(resident_population * activity_multiplier * weekly_wave)

    def _build_neighbor_map(self) -> dict[str, list[str]]:
        centroids = {
            feature["properties"]["code"]: self._centroid(feature["geometry"]["coordinates"][0])
            for feature in self.map_geojson["features"]
        }
        neighbor_map: dict[str, list[str]] = {}
        for code, centroid in centroids.items():
            ranked = sorted(
                (
                    (other_code, self._distance_km(centroid, other_centroid))
                    for other_code, other_centroid in centroids.items()
                    if other_code != code
                ),
                key=lambda item: item[1],
            )
            neighbor_map[code] = [item[0] for item in ranked[:4]]
        return neighbor_map

    def _weather_for_week(self, week: int, turn: int) -> tuple[float, float]:
        seasonal_temp = 18.0 + 10.5 * math.sin(((week - 18) / 52.0) * math.tau)
        temp_noise = ((turn * 7) % 5) - 2
        rain = 24.0 + 32.0 * max(0, math.sin(((week - 21) / 52.0) * math.tau))
        rain += (turn * 11) % 19
        return round(seasonal_temp + temp_noise, 1), round(rain, 1)

    def _centroid(self, ring: list[list[float]]) -> tuple[float, float]:
        lng = sum(point[0] for point in ring) / len(ring)
        lat = sum(point[1] for point in ring) / len(ring)
        return round(lng, 6), round(lat, 6)

    def _distance_km(self, a: tuple[float, float], b: tuple[float, float]) -> float:
        lng1, lat1 = a
        lng2, lat2 = b
        mean_lat = math.radians((lat1 + lat2) / 2)
        km_per_lng = 111.32 * math.cos(mean_lat)
        return math.hypot((lng1 - lng2) * km_per_lng, (lat1 - lat2) * 110.57)
