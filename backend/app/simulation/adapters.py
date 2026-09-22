from __future__ import annotations

import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.simulation.schemas import (
    DistrictState,
    PolicyType,
    StationEdge,
    StationMovementFlow,
    StationState,
    StationTurnDelta,
    TurnDelta,
)


@dataclass(frozen=True)
class SimulationContext:
    turn: int
    week: int
    temperature_c: float
    precipitation_mm: float
    neighbor_map: dict[str, list[str]]


class SimulationAdapter(ABC):
    @abstractmethod
    def step(
        self,
        districts: list[DistrictState],
        interventions: dict[str, list[PolicyType]],
        context: SimulationContext,
    ) -> tuple[list[DistrictState], list[TurnDelta]]:
        """Advance the model by one week."""


class SampleMosquitoAdapter(SimulationAdapter):
    """Transparent sample ABM-like adapter for gameplay validation.

    This is not a claim about Kang's unpublished or unavailable original
    parameters. It implements commonly reported mosquito ABM drivers behind a
    stable interface: temperature, precipitation, breeding sites, movement, and
    control intervention effects.
    """

    def step(
        self,
        districts: list[DistrictState],
        interventions: dict[str, list[PolicyType]],
        context: SimulationContext,
    ) -> tuple[list[DistrictState], list[TurnDelta]]:
        rng = random.Random(20260921 + context.turn)
        by_code = {district.code: district for district in districts}
        updated: list[DistrictState] = []
        deltas: list[TurnDelta] = []

        for district in districts:
            actions = interventions.get(district.code, [])
            before = district.model_copy(deep=True)

            climate = self._climate_multiplier(
                context.temperature_c,
                context.precipitation_mm,
                district.urban_heat_index,
            )
            neighbor_pressure = self._neighbor_pressure(district, by_code, context.neighbor_map)

            breeding_sites = district.breeding_sites
            breeding_sites += 3.2 * district.water_index * climate
            breeding_sites += rng.uniform(-1.8, 2.2)

            larvae = district.larvae
            larvae += breeding_sites * (0.22 + 0.05 * climate)
            larvae -= larvae * self._larval_mortality(context.temperature_c)

            adults = district.mosquito_adults
            matured = larvae * (0.08 + 0.025 * climate)
            adults += matured
            larvae -= matured
            adults += neighbor_pressure
            adults -= adults * self._adult_mortality(context.temperature_c)

            infected_ratio = district.infected_vector_ratio
            infected_ratio += 0.0025 * district.population_index * climate
            infected_ratio += rng.uniform(-0.001, 0.002)

            breeding_sites, larvae, adults, infected_ratio = self._apply_interventions(
                breeding_sites,
                larvae,
                adults,
                infected_ratio,
                actions,
            )

            risk = self._risk_score(adults, breeding_sites, infected_ratio, district.population_index)

            new_state = district.model_copy(
                update={
                    "mosquito_adults": round(max(adults, 0), 2),
                    "larvae": round(max(larvae, 0), 2),
                    "breeding_sites": round(max(breeding_sites, 0), 2),
                    "infected_vector_ratio": round(min(max(infected_ratio, 0), 1), 4),
                    "infection_risk": round(risk, 2),
                    "last_actions": actions,
                }
            )
            updated.append(new_state)
            deltas.append(
                TurnDelta(
                    district_code=district.code,
                    adults_delta=round(new_state.mosquito_adults - before.mosquito_adults, 2),
                    larvae_delta=round(new_state.larvae - before.larvae, 2),
                    breeding_delta=round(new_state.breeding_sites - before.breeding_sites, 2),
                    risk_delta=round(new_state.infection_risk - before.infection_risk, 2),
                )
            )

        return updated, deltas

    def _climate_multiplier(self, temperature_c: float, precipitation_mm: float, heat_index: float) -> float:
        temp = temperature_c * heat_index
        temp_score = math.exp(-((temp - 28.0) ** 2) / 80.0)
        rain_score = min(precipitation_mm / 45.0, 1.8)
        flood_penalty = 0.72 if precipitation_mm > 90 else 1.0
        return max(0.35, temp_score * (0.65 + rain_score * 0.35) * flood_penalty)

    def _larval_mortality(self, temperature_c: float) -> float:
        if temperature_c < 15 or temperature_c > 35:
            return 0.34
        return 0.16

    def _adult_mortality(self, temperature_c: float) -> float:
        if temperature_c < 13 or temperature_c > 36:
            return 0.31
        if temperature_c > 31:
            return 0.22
        return 0.14

    def _neighbor_pressure(
        self,
        district: DistrictState,
        by_code: dict[str, DistrictState],
        neighbor_map: dict[str, list[str]],
    ) -> float:
        neighbors = neighbor_map.get(district.code, [])
        if not neighbors:
            return 0
        avg_neighbors = sum(by_code[code].mosquito_adults for code in neighbors) / len(neighbors)
        return (avg_neighbors - district.mosquito_adults) * 0.025

    def _apply_interventions(
        self,
        breeding_sites: float,
        larvae: float,
        adults: float,
        infected_ratio: float,
        actions: list[PolicyType],
    ) -> tuple[float, float, float, float]:
        if PolicyType.SOURCE_REDUCTION in actions:
            breeding_sites *= 0.72
            larvae *= 0.86
        if PolicyType.LARVICIDE in actions:
            larvae *= 0.56
        if PolicyType.FOGGING in actions:
            adults *= 0.72
            infected_ratio *= 0.9
        if PolicyType.SURVEILLANCE in actions:
            infected_ratio *= 0.96
        if PolicyType.OVITRAP in actions:
            larvae *= 0.88
            infected_ratio *= 0.94
        if PolicyType.HABITAT_MAPPING in actions:
            breeding_sites *= 0.91
            larvae *= 0.96
        if PolicyType.PUBLIC_CAMPAIGN in actions:
            breeding_sites *= 0.86
            infected_ratio *= 0.97
        if PolicyType.TARGETED_INSPECTION in actions:
            larvae *= 0.78
            adults *= 0.95
        return breeding_sites, larvae, adults, infected_ratio

    def _risk_score(self, adults: float, breeding_sites: float, infected_ratio: float, population_index: float) -> float:
        abundance = min(adults / 950.0, 1.3)
        habitat = min(breeding_sites / 120.0, 1.1)
        infection = min(infected_ratio * 18.0, 1.0)
        risk = (abundance * 52.0) + (habitat * 20.0) + (infection * 28.0)
        return min(100.0, risk * population_index)


@dataclass(frozen=True)
class StationSimulationContext:
    turn: int
    week: int
    temperature_c: float
    precipitation_mm: float


class StationSimulationAdapter(ABC):
    @abstractmethod
    def step(
        self,
        stations: list[StationState],
        edges: list[StationEdge],
        interventions: dict[str, list[PolicyType]],
        context: StationSimulationContext,
    ) -> tuple[list[StationState], list[StationTurnDelta], list[StationMovementFlow]]:
        """Advance station catchments and passenger flows by one week."""


class SampleStationAdapter(StationSimulationAdapter):
    """Station-catchment model built from published spatial ABM concepts.

    Ridership values are observed public statistics. Living population,
    passenger OD, infection arrivals, habitat pressure, and intervention
    effects are explicit scenario estimates rather than measured station data.
    """

    def step(
        self,
        stations: list[StationState],
        edges: list[StationEdge],
        interventions: dict[str, list[PolicyType]],
        context: StationSimulationContext,
    ) -> tuple[list[StationState], list[StationTurnDelta], list[StationMovementFlow]]:
        by_code = {station.code: station for station in stations}
        flows = self._passenger_flows(by_code, edges, context.turn)
        incoming = {station.code: 0 for station in stations}
        for flow in flows:
            incoming[flow.to_code] += flow.estimated_people

        updated: list[StationState] = []
        deltas: list[StationTurnDelta] = []
        rng = random.Random(31001 + context.turn)
        climate = self._climate(context.temperature_c, context.precipitation_mm)

        for station in stations:
            actions = interventions.get(station.code, [])
            activity = self._activity_multiplier(station.activity_type, context.turn)
            living_population = round(
                station.daily_ridership * activity
                + incoming[station.code] * 0.55
                + 6800
            )

            breeding_sites = (
                station.breeding_sites
                + 2.8 * station.habitat_index * climate
                + rng.uniform(-1.2, 1.6)
            )
            larvae = station.larvae
            larvae += breeding_sites * (0.18 + climate * 0.05)
            larvae *= 0.84

            network_neighbors = self._neighbors(station.code, edges)
            neighbor_adults = [
                by_code[code].mosquito_adults for code in network_neighbors if code in by_code
            ]
            neighbor_pressure = (
                (sum(neighbor_adults) / len(neighbor_adults) - station.mosquito_adults) * 0.012
                if neighbor_adults
                else 0
            )
            adults = station.mosquito_adults + larvae * (0.075 + climate * 0.018)
            adults += neighbor_pressure
            adults *= 0.86

            infected_arrivals = (
                living_population * 0.0011
                + incoming[station.code] * 0.0018
                + rng.uniform(1.0, 8.0)
            )
            breeding_sites, larvae, adults, infected_arrivals = self._apply_interventions(
                breeding_sites,
                larvae,
                adults,
                infected_arrivals,
                actions,
            )
            exposure_risk = self._risk(
                adults,
                breeding_sites,
                living_population,
                infected_arrivals,
                station.habitat_index,
            )

            next_station = station.model_copy(
                update={
                    "living_population": max(round(living_population), 1),
                    "mosquito_adults": round(max(adults, 0), 2),
                    "larvae": round(max(larvae, 0), 2),
                    "breeding_sites": round(max(breeding_sites, 0), 2),
                    "infected_arrivals": round(max(infected_arrivals, 0), 2),
                    "exposure_risk": round(exposure_risk, 2),
                    "last_actions": actions,
                }
            )
            updated.append(next_station)
            deltas.append(
                StationTurnDelta(
                    station_code=station.code,
                    adults_delta=round(next_station.mosquito_adults - station.mosquito_adults, 2),
                    breeding_delta=round(next_station.breeding_sites - station.breeding_sites, 2),
                    arrivals_delta=round(next_station.infected_arrivals - station.infected_arrivals, 2),
                    living_population_delta=next_station.living_population - station.living_population,
                    risk_delta=round(next_station.exposure_risk - station.exposure_risk, 2),
                )
            )

        return updated, deltas, flows

    def _passenger_flows(
        self,
        stations: dict[str, StationState],
        edges: list[StationEdge],
        turn: int,
    ) -> list[StationMovementFlow]:
        flows: list[StationMovementFlow] = []
        for index, edge in enumerate(edges):
            first = stations[edge.from_code]
            second = stations[edge.to_code]
            reverse = (turn + index) % 3 == 0
            source, target = (second, first) if reverse else (first, second)
            pulse = 0.88 + ((turn * 13 + index * 7) % 31) / 100
            transfer_boost = 1.22 if len(target.lines) > 1 else 1.0
            flows.append(
                StationMovementFlow(
                    from_code=source.code,
                    to_code=target.code,
                    line=edge.line,
                    estimated_people=max(
                        round(edge.base_daily_flow * pulse * transfer_boost),
                        500,
                    ),
                )
            )
        return sorted(flows, key=lambda flow: flow.estimated_people, reverse=True)[:36]

    def _neighbors(self, code: str, edges: list[StationEdge]) -> list[str]:
        neighbors = []
        for edge in edges:
            if edge.from_code == code:
                neighbors.append(edge.to_code)
            elif edge.to_code == code:
                neighbors.append(edge.from_code)
        return neighbors

    def _activity_multiplier(self, activity_type: str, turn: int) -> float:
        phases = {
            "업무중심형": (1.18, 1.28, 1.08, 0.78),
            "도심혼합형": (1.06, 1.18, 1.24, 0.92),
            "평일우위형": (1.12, 1.2, 1.02, 0.8),
        }
        pattern = phases.get(activity_type, phases["도심혼합형"])
        return pattern[turn % len(pattern)]

    def _climate(self, temperature_c: float, precipitation_mm: float) -> float:
        temperature = math.exp(-((temperature_c - 28.0) ** 2) / 72.0)
        rain = min(precipitation_mm / 48.0, 1.7)
        return max(0.35, temperature * (0.68 + rain * 0.32))

    def _apply_interventions(
        self,
        breeding_sites: float,
        larvae: float,
        adults: float,
        infected_arrivals: float,
        actions: list[PolicyType],
    ) -> tuple[float, float, float, float]:
        if PolicyType.SOURCE_REDUCTION in actions:
            breeding_sites *= 0.68
            larvae *= 0.84
        if PolicyType.LARVICIDE in actions:
            larvae *= 0.52
        if PolicyType.FOGGING in actions:
            adults *= 0.68
        if PolicyType.SURVEILLANCE in actions:
            infected_arrivals *= 0.91
        if PolicyType.OVITRAP in actions:
            larvae *= 0.83
            infected_arrivals *= 0.95
        if PolicyType.HABITAT_MAPPING in actions:
            breeding_sites *= 0.88
        if PolicyType.PUBLIC_CAMPAIGN in actions:
            infected_arrivals *= 0.9
        if PolicyType.TARGETED_INSPECTION in actions:
            larvae *= 0.74
            adults *= 0.92
        return breeding_sites, larvae, adults, infected_arrivals

    def _risk(
        self,
        adults: float,
        breeding_sites: float,
        living_population: int,
        infected_arrivals: float,
        habitat_index: float,
    ) -> float:
        mosquito = min(adults / 620.0, 1.25) * 34
        habitat = min(breeding_sites / 92.0, 1.1) * 16
        crowd = min(living_population / 180000.0, 1.3) * 30
        arrival = min(infected_arrivals / 280.0, 1.2) * 20
        return min(100.0, (mosquito + habitat + crowd + arrival) * (0.82 + habitat_index * 0.22))
