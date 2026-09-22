export type PolicyType =
  | "larvicide"
  | "fogging"
  | "source_reduction"
  | "surveillance"
  | "ovitrap"
  | "habitat_mapping"
  | "public_campaign"
  | "targeted_inspection";

export type DistrictCommand = {
  district_code: string;
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
  districts: DistrictState[];
  event_log: string[];
};

export type TurnResponse = {
  status: "advanced";
  state: GameState;
  movements: MovementFlow[];
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
