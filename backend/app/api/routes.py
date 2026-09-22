from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.simulation.game import GameEngine
from app.simulation.schemas import GameState, HireTeamRequest, NewGameResponse, TurnRequest, TurnResponse

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "seoul"
CONFIG_PATH = ROOT.parent / "shared" / "config" / "sample_scenario.json"

router = APIRouter()
engine = GameEngine(DATA_DIR / "municipalities.geojson", CONFIG_PATH)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/map/seoul")
def seoul_map() -> JSONResponse:
    return JSONResponse(engine.map_geojson)


@router.post("/game/new", response_model=NewGameResponse)
def new_game() -> NewGameResponse:
    return engine.new_game()


@router.get("/game/{game_id}", response_model=GameState)
def get_game(game_id: str) -> GameState:
    game = engine.get_game(game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("/game/{game_id}/teams", response_model=GameState)
def hire_teams(game_id: str, request: HireTeamRequest) -> GameState:
    try:
        return engine.hire_teams(game_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=exc.args[0]) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/game/{game_id}/turn", response_model=TurnResponse)
def run_turn(game_id: str, request: TurnRequest) -> TurnResponse:
    try:
        return engine.run_turn(game_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=exc.args[0]) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/research-notes")
def research_notes() -> dict[str, Any]:
    return {
        "caveat": "The model is structured from Jeon-Young Kang's published spatial ABM research, but it is not a verified copy of the original code or parameters.",
        "model_features": [
            "spatially explicit district states",
            "temperature and precipitation driven breeding pressure",
            "weekly mosquito life-cycle updates",
            "localized intervention effects",
            "neighbor diffusion between adjacent districts approximated from centroids",
        ],
        "adapter": "Replace SampleMosquitoAdapter with another SimulationAdapter implementation when validated code/data is available.",
    }
