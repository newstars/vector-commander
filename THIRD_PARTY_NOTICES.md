# Third-Party Notices

## Seoul Administrative Boundaries

The file backend/data/seoul/municipalities.geojson is derived from the
KOSTAT 2013 Seoul municipality boundary data distributed by
[southkorea/seoul-maps](https://github.com/southkorea/seoul-maps).

Copyright belongs to the upstream contributors. The dataset is distributed
under the Apache License 2.0. See the upstream repository for its complete
copyright and license notice.

## Seoul Subway Station and Ridership Data

The observed station coordinates and 2025 average daily ridership represented
in backend/data/seoul/subway_stations.json are derived from Seoul Metropolitan
Government public datasets:

- Seoul subway station master (T Data Seoul, data id 1036)
- Seoul station entry and exit counts (Seoul Open Data OA-12914)

These public data are provided under the Korea Open Government License Type 1
(attribution). Vector Commander adds scenario-only classifications, habitat
indices, and a curated connection network; these additions are not official
Seoul statistics.

## Software Dependencies

Runtime and development dependencies are declared in:

- backend/requirements.txt
- frontend/package.json
- frontend/package-lock.json

Each dependency remains subject to its own license.
