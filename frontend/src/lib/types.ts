export type PolicyType =
  | "larvicide"
  | "fogging"
  | "source_reduction"
  | "surveillance"
  | "ovitrap"
  | "habitat_mapping"
  | "public_campaign"
  | "targeted_inspection";

export type StationCommand = {
  station_code: string;
  policies: PolicyType[];
};

export type DistrictState = {
  code: string;
  name: string;
  name_eng: string;
  centroid: [number, number];
  mosquito_adults: number;
  larvae: number;
  breeding_sites: number;
  infected_vector_ratio: number;
  infection_risk: number;
  resident_population: number;
  floating_population: number;
  population_index: number;
  water_index: number;
  urban_heat_index: number;
  last_actions: PolicyType[];
};

export type GameState = {
  game_id: string;
  turn: number;
  year: number;
  week: number;
  temperature_c: number;
  precipitation_mm: number;
  resources: {
    budget: number;
    teams: number;
  };
  rules: {
    policy_costs: Record<PolicyType, { budget: number; teams: number }>;
    weekly_budget_income: number;
    team_hire_cost: number;
    max_teams: number;
  };
  population_movements: PopulationMovementFlow[];
  stations: StationState[];
  station_edges: StationEdge[];
  station_movements: StationMovementFlow[];
  station_mosquito_movements: StationMosquitoFlow[];
  districts: DistrictState[];
  event_log: string[];
};

export type TurnResponse = {
  status: "advanced";
  state: GameState;
  movements: MovementFlow[];
  station_deltas: StationTurnDelta[];
};

export type StationState = {
  code: string;
  name: string;
  lines: string[];
  location: [number, number];
  district_code: string;
  district_name: string;
  daily_ridership: number;
  living_population: number;
  activity_type: string;
  habitat_index: number;
  mosquito_adults: number;
  larvae: number;
  breeding_sites: number;
  infected_arrivals: number;
  exposure_risk: number;
  last_actions: PolicyType[];
};

export type StationEdge = {
  from_code: string;
  to_code: string;
  line: string;
  base_daily_flow: number;
};

export type StationMovementFlow = {
  from_code: string;
  to_code: string;
  line: string;
  estimated_people: number;
};

export type StationMosquitoFlow = {
  from_code: string;
  to_code: string;
  estimated_adults: number;
};

export type StationTurnDelta = {
  station_code: string;
  adults_delta: number;
  breeding_delta: number;
  arrivals_delta: number;
  living_population_delta: number;
  risk_delta: number;
};

export type MovementFlow = {
  from_code: string;
  to_code: string;
  estimated_adults: number;
};

export type PopulationMovementFlow = {
  from_code: string;
  to_code: string;
  estimated_people: number;
};

export type SeoulFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    code: string;
    name: string;
    name_eng: string;
    base_year: string;
  }
>;
