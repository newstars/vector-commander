from pathlib import Path

from app.simulation.game import GameEngine
from app.simulation.schemas import DistrictCommand, HireTeamRequest, PolicyType, TurnRequest


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


def test_turn_applies_policy_costs_and_changes_state() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()
    target = game.state.districts[0]
    engine.hire_teams(game.game_id, HireTeamRequest(count=3))

    response = engine.run_turn(
        game.game_id,
        TurnRequest(
            commands=[
                DistrictCommand(
                    district_code=target.code,
                    policies=[PolicyType.LARVICIDE, PolicyType.SOURCE_REDUCTION],
                )
            ]
        ),
    )

    updated = next(d for d in response.state.districts if d.code == target.code)
    assert response.state.turn == 1
    assert response.state.resources.budget == 85000000
    assert updated.larvae < target.larvae
    assert response.deltas
    assert response.movements


def test_turn_advances_without_policy_commands() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()

    before_floating = game.state.districts[0].floating_population
    response = engine.run_turn(game.game_id, TurnRequest(commands=[]))

    assert response.state.turn == 1
    assert response.state.week == 33
    assert response.state.resources.budget == 335000000
    assert response.state.districts[0].floating_population != before_floating
    assert "정책 없이" in response.state.event_log[-1]


def test_turn_applies_distinct_policies_to_multiple_districts() -> None:
    engine = GameEngine(GEOJSON, CONFIG)
    game = engine.new_game()
    first, second = game.state.districts[:2]
    engine.hire_teams(game.game_id, HireTeamRequest(count=3))

    response = engine.run_turn(
        game.game_id,
        TurnRequest(
            commands=[
                DistrictCommand(district_code=first.code, policies=[PolicyType.LARVICIDE]),
                DistrictCommand(district_code=second.code, policies=[PolicyType.FOGGING]),
            ]
        ),
    )

    updated_first = next(d for d in response.state.districts if d.code == first.code)
    updated_second = next(d for d in response.state.districts if d.code == second.code)
    assert updated_first.last_actions == [PolicyType.LARVICIDE]
    assert updated_second.last_actions == [PolicyType.FOGGING]
    assert "2개 지역" in response.state.event_log[-1]
