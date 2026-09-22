from __future__ import annotations

import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.simulation.schemas import DistrictState, PolicyType, TurnDelta


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
