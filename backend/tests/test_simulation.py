from pathlib import Path

from app.simulation.game import GameEngine
from app.simulation.schemas import HireTeamRequest, PolicyType, StationCommand, TurnRequest


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT.parent / "shared" / "config" / "sample_scenario.json"
GEOJSON = ROOT / "data" / "seoul" / "municipalities.geojson"


def test_new_game_loads_25_seoul_districts() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    response = engine.new_game()

    assert len(response.state.districts) == 25
    assert response.state.resources.budget == 300000000
    assert response.state.resources.teams == 0
    assert response.state.population_movements
    assert all(district.infection_risk >= 0 for district in response.state.districts)
    assert all(district.resident_population > 0 for district in response.state.districts)
    assert all(district.floating_population > 0 for district in response.state.districts)
    assert len(response.state.stations) == 53
    assert response.state.station_movements
    assert max(station.daily_ridership for station in response.state.stations) > 200000


def test_turn_applies_policy_costs_and_changes_state() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()
    target = game.state.stations[0]
    engine.hire_teams(game.game_id, HireTeamRequest(count=3))

    response = engine.run_turn(
        game.game_id,
        TurnRequest(
            commands=[
                StationCommand(
                    station_code=target.code,
                    policies=[PolicyType.LARVICIDE, PolicyType.SOURCE_REDUCTION],
                )
            ]
        ),
    )

    updated = next(s for s in response.state.stations if s.code == target.code)
    assert response.state.turn == 1
    assert response.state.resources.budget == 85000000
    assert updated.larvae < target.larvae
    assert response.station_deltas
    assert response.movements


def test_turn_advances_without_policy_commands() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()

    before_living = game.state.stations[0].living_population
    response = engine.run_turn(game.game_id, TurnRequest(commands=[]))

    assert response.state.turn == 1
    assert response.state.week == 33
    assert response.state.resources.budget == 335000000
    assert response.state.stations[0].living_population != before_living
    assert "정책 없이" in response.state.event_log[-1]


def test_turn_applies_distinct_policies_to_multiple_districts() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()
    first, second = game.state.stations[:2]
    engine.hire_teams(game.game_id, HireTeamRequest(count=3))

    response = engine.run_turn(
        game.game_id,
        TurnRequest(
            commands=[
                StationCommand(station_code=first.code, policies=[PolicyType.LARVICIDE]),
                StationCommand(station_code=second.code, policies=[PolicyType.FOGGING]),
            ]
        ),
    )

    updated_first = next(s for s in response.state.stations if s.code == first.code)
    updated_second = next(s for s in response.state.stations if s.code == second.code)
    assert updated_first.last_actions == [PolicyType.LARVICIDE]
    assert updated_second.last_actions == [PolicyType.FOGGING]
    assert "2개 역세권" in response.state.event_log[-1]
