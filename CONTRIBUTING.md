# Contributing

Contributions are welcome for simulation adapters, validated datasets,
gameplay balancing, tests, accessibility, and GIS visualization.

## Development Setup

1. Create a Python virtual environment in backend/.venv.
2. Install backend/requirements.txt.
3. Run the API on port 8000.
4. Install frontend packages with npm ci.
5. Run Next.js on port 3000.

Full commands are in the project README.

## Checks

Run these before opening a pull request:

    cd backend
    .venv/bin/python -m pytest -q

    cd ../frontend
    npm run lint
    npm run build

## Model and Data Changes

- Cite the source and license for new datasets.
- State whether parameters are measured, calibrated, inferred, or illustrative.
- Do not describe sample parameters as values from a referenced paper.
- Keep model-specific implementations behind SimulationAdapter.

## Pull Requests

Keep changes focused, describe gameplay or model behavior changes, and add
tests for simulation rules or API contracts.
