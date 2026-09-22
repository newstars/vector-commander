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
    event_log: list[str] = Field(default_factory=list)


class NewGameResponse(BaseModel):
    game_id: str
    state: GameState


class DistrictCommand(BaseModel):
    district_code: str
    policies: list[PolicyType]


class TurnRequest(BaseModel):
    commands: list[DistrictCommand]


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


class TurnResponse(BaseModel):
    status: Literal["advanced"]
    state: GameState
    deltas: list[TurnDelta]
    movements: list[MovementFlow]
