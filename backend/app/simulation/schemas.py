from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class PolicyType(StrEnum):
    LARVICIDE = "larvicide"
    FOGGING = "fogging"
    SOURCE_REDUCTION = "source_reduction"
    SURVEILLANCE = "surveillance"
    OVITRAP = "ovitrap"
    HABITAT_MAPPING = "habitat_mapping"
    PUBLIC_CAMPAIGN = "public_campaign"
    TARGETED_INSPECTION = "targeted_inspection"


class PolicyCost(BaseModel):
    budget: int
    teams: int


class DistrictState(BaseModel):
    code: str
    name: str
    name_eng: str
    centroid: tuple[float, float]
    mosquito_adults: float = Field(ge=0)
    larvae: float = Field(ge=0)
    breeding_sites: float = Field(ge=0)
    infected_vector_ratio: float = Field(ge=0, le=1)
    infection_risk: float = Field(ge=0, le=100)
    resident_population: int = Field(gt=0)
    floating_population: int = Field(gt=0)
    population_index: float = Field(gt=0)
    water_index: float = Field(ge=0)
    urban_heat_index: float = Field(gt=0)
    last_actions: list[PolicyType] = Field(default_factory=list)


class GameResources(BaseModel):
    budget: int
    teams: int


class GameRules(BaseModel):
    policy_costs: dict[PolicyType, PolicyCost]
    weekly_budget_income: int
    team_hire_cost: int
    max_teams: int


class PopulationMovementFlow(BaseModel):
    from_code: str
    to_code: str
    estimated_people: int


class StationState(BaseModel):
    code: str
    name: str
    lines: list[str]
    location: tuple[float, float]
    district_code: str
    district_name: str
    daily_ridership: int = Field(gt=0)
    living_population: int = Field(gt=0)
    activity_type: str
    habitat_index: float = Field(ge=0, le=1)
    mosquito_adults: float = Field(ge=0)
    larvae: float = Field(ge=0)
    breeding_sites: float = Field(ge=0)
    infected_arrivals: float = Field(ge=0)
    exposure_risk: float = Field(ge=0, le=100)
    last_actions: list[PolicyType] = Field(default_factory=list)


class StationEdge(BaseModel):
    from_code: str
    to_code: str
    line: str
    base_daily_flow: int = Field(gt=0)


class StationMovementFlow(BaseModel):
    from_code: str
    to_code: str
    line: str
    estimated_people: int = Field(gt=0)


class StationMosquitoFlow(BaseModel):
    from_code: str
    to_code: str
    estimated_adults: float = Field(gt=0)


class GameState(BaseModel):
    game_id: str
    turn: int
    year: int
    week: int
    temperature_c: float
    precipitation_mm: float
    resources: GameResources
    rules: GameRules
    districts: list[DistrictState]
    population_movements: list[PopulationMovementFlow]
    stations: list[StationState]
    station_edges: list[StationEdge]
    station_movements: list[StationMovementFlow]
    station_mosquito_movements: list[StationMosquitoFlow]
    event_log: list[str] = Field(default_factory=list)


class NewGameResponse(BaseModel):
    game_id: str
    state: GameState


class DistrictCommand(BaseModel):
    district_code: str
    policies: list[PolicyType]


class StationCommand(BaseModel):
    station_code: str
    policies: list[PolicyType]


class TurnRequest(BaseModel):
    commands: list[StationCommand]


class HireTeamRequest(BaseModel):
    count: int = Field(default=1, ge=1, le=8)


class TurnDelta(BaseModel):
    district_code: str
    adults_delta: float
    larvae_delta: float
    breeding_delta: float
    risk_delta: float


class MovementFlow(BaseModel):
    from_code: str
    to_code: str
    estimated_adults: float


class StationTurnDelta(BaseModel):
    station_code: str
    adults_delta: float
    breeding_delta: float
    arrivals_delta: float
    living_population_delta: int
    risk_delta: float


class TurnResponse(BaseModel):
    status: Literal["advanced"]
    state: GameState
    deltas: list[TurnDelta]
    movements: list[MovementFlow]
    station_deltas: list[StationTurnDelta]
