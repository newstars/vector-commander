# Seoul GIS and Subway Data

municipalities.geojson contains simplified Seoul municipality boundaries
derived from the KOSTAT 2013 dataset published by the
[southkorea/seoul-maps](https://github.com/southkorea/seoul-maps) project.

- Original source: KOSTAT administrative division geodata for Census, 2013
- Upstream project: southkorea/seoul-maps
- Upstream contributor: Lucy Park
- License: Apache License 2.0

The boundary vintage is suitable for this software prototype. Replace it with
an authoritative current dataset before using the application for operational
planning.

## Subway station scenario data

subway_stations.json is a curated 53-station tactical network. Station
coordinates are based on the Seoul Metropolitan Government subway station
master dataset. Daily ridership is derived from the 2025 monthly station entry
and exit files published as Seoul Open Data OA-12914.

- Station master: https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036
- Ridership: https://data.seoul.go.kr/dataList/OA-12914/S/1/datasetView.do
- Public data license: Korea Open Government License Type 1 (attribution)

The JSON contains a curated major-station network rather than every station or
every intermediate stop. Coordinates and ridership are observed public data.
Habitat indices, activity types, network edge flows, station living population,
passenger OD, and infected arrivals are gameplay scenario estimates.
