"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map } from "maplibre-gl";
import type {
  DistrictState,
  SeoulFeatureCollection,
  StationEdge,
  StationMosquitoFlow,
  StationMovementFlow,
  StationState
} from "../lib/types";

type Props = {
  geojson: SeoulFeatureCollection | null;
  districts: DistrictState[];
  stations: StationState[];
  edges: StationEdge[];
  passengerFlows: StationMovementFlow[];
  mosquitoFlows: StationMosquitoFlow[];
  focusedCode: string;
  selectedCodes: string[];
  onSelect: (code: string) => void;
};

export function SeoulMap({
  geojson,
  districts,
  stations,
  edges,
  passengerFlows,
  mosquitoFlows,
  focusedCode,
  selectedCodes,
  onSelect
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [showPassengers, setShowPassengers] = useState(true);
  const [showMosquitoes, setShowMosquitoes] = useState(true);
  const districtRisk = useMemo(
    () => Object.fromEntries(districts.map((district) => [district.code, district.infection_risk])),
    [districts]
  );
  const initialRiskRef = useRef(districtRisk);

  useEffect(() => {
    if (!containerRef.current || !geojson || mapRef.current) return;
    const currentGeojson = geojson;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          seoul: { type: "geojson", data: enrichGeojson(currentGeojson, initialRiskRef.current) }
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0b1412" }
          },
          {
            id: "district-fill",
            type: "fill",
            source: "seoul",
            paint: {
              "fill-color": "#20302b",
              "fill-opacity": 0.72
            }
          },
          {
            id: "district-line",
            type: "line",
            source: "seoul",
            paint: { "line-color": "#355048", "line-width": 1.2 }
          }
        ]
      },
      center: [126.978, 37.5665],
      zoom: 9.8,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    const bounds = geojsonBounds(currentGeojson);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 52, animate: false });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  useEffect(() => {
    if (!geojson) return;
    const source = mapRef.current?.getSource("seoul") as GeoJSONSource | undefined;
    source?.setData(enrichGeojson(geojson, districtRisk));
  }, [districtRisk, geojson]);

  return (
    <div className="map-wrap station-map-wrap">
      <div ref={containerRef} className="map" />
      {geojson ? (
        <StationOverlay
          geojson={geojson}
          districts={districts}
          stations={stations}
          edges={edges}
          passengerFlows={passengerFlows}
          mosquitoFlows={mosquitoFlows}
          focusedCode={focusedCode}
          selectedCodes={selectedCodes}
          showPassengers={showPassengers}
          showMosquitoes={showMosquitoes}
          onSelect={onSelect}
        />
      ) : null}
      {!geojson ? <div className="map-loading">서울 지하철 전술망을 불러오는 중</div> : null}
      <div className="layer-controls" aria-label="지도 이동 경로 레이어">
        <button
          type="button"
          className={showPassengers ? "layer-toggle population active" : "layer-toggle population"}
          aria-pressed={showPassengers}
          onClick={() => setShowPassengers((visible) => !visible)}
        >
          승객 흐름
        </button>
        <button
          type="button"
          className={showMosquitoes ? "layer-toggle mosquito active" : "layer-toggle mosquito"}
          aria-pressed={showMosquitoes}
          onClick={() => setShowMosquitoes((visible) => !visible)}
        >
          모기 확산
        </button>
      </div>
      <div className="legend station-legend">
        <span>역세권 위험</span>
        <div className="legend-bar" />
        <span>높음</span>
        {showPassengers ? <span className="population-key">→ 승객</span> : null}
        {showMosquitoes ? <span className="movement-key">→ 모기</span> : null}
      </div>
    </div>
  );
}

function StationOverlay({
  geojson,
  districts,
  stations,
  edges,
  passengerFlows,
  mosquitoFlows,
  focusedCode,
  selectedCodes,
  showPassengers,
  showMosquitoes,
  onSelect
}: Props & {
  geojson: SeoulFeatureCollection;
  showPassengers: boolean;
  showMosquitoes: boolean;
}) {
  const width = 1000;
  const height = 760;
  const padding = 42;
  const points: [number, number][] = [];

  function collect(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  }

  geojson.features.forEach((feature) => collect(feature.geometry.coordinates));
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const stationByCode = Object.fromEntries(stations.map((station) => [station.code, station]));

  function project([lng, lat]: [number, number]): [number, number] {
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * (width - padding * 2);
    const y = height - padding - ((lat - minLat) / (maxLat - minLat)) * (height - padding * 2);
    return [x, y];
  }

  function ringPath(ring: number[][]): string {
    return ring
      .map((coordinate, index) => {
        const [x, y] = project(coordinate as [number, number]);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";
  }

  function geometryPath(feature: SeoulFeatureCollection["features"][number]): string {
    if (feature.geometry.type === "Polygon") {
      return feature.geometry.coordinates.map(ringPath).join(" ");
    }
    return feature.geometry.coordinates.flatMap((polygon) => polygon.map(ringPath)).join(" ");
  }

  return (
    <svg className="district-overlay station-overlay" viewBox={`0 0 ${width} ${height}`} aria-label="서울 지하철 역세권 위험 지도">
      <defs>
        <marker id="passenger-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#6df2a2" />
        </marker>
        <marker id="station-mosquito-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#57d3ff" />
        </marker>
      </defs>

      <g className="district-base">
        {geojson.features.map((feature) => (
          <path
            key={feature.properties.code}
            d={geometryPath(feature)}
            className="district-shape station-district"
            fill="#1b2b27"
            fillRule="evenodd"
          />
        ))}
        {districts.map((district) => {
          const [x, y] = project(district.centroid);
          return <text key={district.code} x={x} y={y} className="district-name station-district-name">{district.name}</text>;
        })}
      </g>

      <g className="transit-network" aria-label="주요 지하철 연결망">
        {edges.map((edge, index) => {
          const source = stationByCode[edge.from_code];
          const target = stationByCode[edge.to_code];
          if (!source || !target) return null;
          const [x1, y1] = project(source.location);
          const [x2, y2] = project(target.location);
          return (
            <line
              key={`${edge.line}-${edge.from_code}-${edge.to_code}-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="transit-line"
              stroke={lineColor(edge.line)}
            />
          );
        })}
      </g>

      {showPassengers ? (
        <g aria-label="역간 승객 이동">
          {passengerFlows.map((flow, index) => {
            const source = stationByCode[flow.from_code];
            const target = stationByCode[flow.to_code];
            if (!source || !target) return null;
            const [x1, y1] = project(source.location);
            const [x2, y2] = project(target.location);
            return (
              <line
                key={`passenger-${flow.from_code}-${flow.to_code}-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="station-passenger-flow"
                strokeWidth={Math.min(7, 1.3 + flow.estimated_people / 7000)}
                markerEnd="url(#passenger-arrow)"
              >
                <title>{source.name} → {target.name} · 추정 {flow.estimated_people.toLocaleString()}명</title>
              </line>
            );
          })}
        </g>
      ) : null}

      {showMosquitoes ? (
        <g aria-label="역세권 간 모기 확산">
          {mosquitoFlows.map((flow, index) => {
            const source = stationByCode[flow.from_code];
            const target = stationByCode[flow.to_code];
            if (!source || !target) return null;
            const [x1, y1] = project(source.location);
            const [x2, y2] = project(target.location);
            return (
              <line
                key={`mosquito-${flow.from_code}-${flow.to_code}-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="station-mosquito-flow"
                strokeWidth={Math.min(5, 1.2 + flow.estimated_adults)}
                markerEnd="url(#station-mosquito-arrow)"
              >
                <title>{source.name} → {target.name} · 추정 {flow.estimated_adults.toFixed(1)}마리</title>
              </line>
            );
          })}
        </g>
      ) : null}

      <g className="station-nodes">
        {stations.map((station) => {
          const [x, y] = project(station.location);
          const selected = selectedCodes.includes(station.code);
          const focused = focusedCode === station.code;
          const radius = Math.min(15, 6 + station.daily_ridership / 26000);
          const showLabel = focused || selected || station.daily_ridership >= 95000;
          return (
            <g
              key={station.code}
              className={focused ? "station-node focused" : selected ? "station-node selected" : "station-node"}
              onClick={() => onSelect(station.code)}
            >
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={stationRiskColor(station.exposure_risk)}
              >
                <title>
                  {station.name}역 · 위험 {station.exposure_risk.toFixed(1)} · 일평균 {station.daily_ridership.toLocaleString()}명
                </title>
              </circle>
              {showLabel ? <text x={x} y={y - radius - 5} className="station-label">{station.name}</text> : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function stationRiskColor(risk: number): string {
  if (risk >= 78) return "#e63946";
  if (risk >= 62) return "#f77f00";
  if (risk >= 46) return "#f4d35e";
  return "#84d18f";
}

function lineColor(line: string): string {
  const colors: Record<string, string> = {
    "1호선": "#4f82c0",
    "2호선": "#4aa564",
    "3호선": "#d78745",
    "4호선": "#5aa6c8",
    "5호선": "#8d67b8",
    "6호선": "#a57b52",
    "7호선": "#788b3b",
    "8호선": "#d05d84",
    "9호선": "#b59b52"
  };
  return colors[line] ?? "#78948b";
}

function enrichGeojson(
  geojson: SeoulFeatureCollection,
  districtRisk: Record<string, number>
): SeoulFeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        risk: districtRisk[feature.properties.code] ?? 0
      }
    }))
  };
}

function geojsonBounds(geojson: SeoulFeatureCollection): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  function visit(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      bounds.extend([value[0], value[1]]);
      return;
    }
    value.forEach(visit);
  }
  geojson.features.forEach((feature) => visit(feature.geometry.coordinates));
  return bounds;
}
