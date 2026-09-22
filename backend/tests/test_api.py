from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_game_turn_api() -> None:
    client = TestClient(app)
    new_game = client.post("/game/new").json()
    district = new_game["state"]["districts"][0]
    hire_response = client.post(
        f"/game/{new_game['game_id']}/teams",
        json={"count": 2},
    )
    assert hire_response.status_code == 200
    assert hire_response.json()["resources"]["teams"] == 2

    response = client.post(
        f"/game/{new_game['game_id']}/turn",
        json={
            "commands": [
                {
                    "district_code": district["code"],
                    "policies": ["fogging"],
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "advanced"
    assert payload["state"]["turn"] == 1
    assert payload["movements"]
