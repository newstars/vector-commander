"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map, MapLayerMouseEvent } from "maplibre-gl";
import type {
  DistrictState,
  MovementFlow,
  PopulationMovementFlow,
  SeoulFeatureCollection
} from "../lib/types";

type Props = {
  geojson: SeoulFeatureCollection | null;
  districts: DistrictState[];
  focusedCode: string;
  selectedCodes: string[];
  movements: MovementFlow[];
  populationMovements: PopulationMovementFlow[];
  onSelect: (code: string) => void;
};

export function SeoulMap({
  geojson,
  districts,
  focusedCode,
  selectedCodes,
  movements,
  populationMovements,
  onSelect
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [showMosquitoRoutes, setShowMosquitoRoutes] = useState(true);
  const [showPopulationRoutes, setShowPopulationRoutes] = useState(true);
  const districtRisk = useMemo(
    () => Object.fromEntries(districts.map((district) => [district.code, district.infection_risk])),
    [districts]
  );
  const districtRiskRef = useRef(districtRisk);
  const focusedCodeRef = useRef(focusedCode);
  const selectedCodesRef = useRef(selectedCodes);

  useEffect(() => {
    districtRiskRef.current = districtRisk;
    focusedCodeRef.current = focusedCode;
    selectedCodesRef.current = selectedCodes;
  }, [districtRisk, focusedCode, selectedCodes]);

  useEffect(() => {
    if (!containerRef.current || !geojson || mapRef.current) return;

    const currentGeojson = geojson;
    const initialData = enrichGeojson(
      currentGeojson,
      districtRiskRef.current,
      focusedCodeRef.current,
      selectedCodesRef.current
    );
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          seoul: {
            type: "geojson",
            data: initialData
          }
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#111a18" }
          },
          {
            id: "district-fill",
            type: "fill",
            source: "seoul",
            paint: {
              "fill-color": [
                "interpolate",
                ["linear"],
                ["get", "risk"],
                0,
                "#d7f0d1",
                35,
                "#f4d35e",
                70,
                "#ee6c4d",
                100,
                "#9b2226"
              ],
              "fill-opacity": 0.9
            }
          },
          {
            id: "district-line",
            type: "line",
            source: "seoul",
            paint: {
              "line-color": [
                "case",
                ["get", "focused"],
                "#ffffff",
                ["get", "selected"],
                "#f4d35e",
                "#28423b"
              ],
              "line-width": [
                "case",
                ["get", "focused"],
                4,
                ["get", "selected"],
                3,
                1.5
              ]
            }
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
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 52, animate: false });
    }
    map.on("click", "district-fill", (event: MapLayerMouseEvent) => {
      const code = event.features?.[0]?.properties?.code;
      if (typeof code === "string") onSelect(code);
    });
    map.on("mouseenter", "district-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "district-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson, onSelect]);

  useEffect(() => {
    if (!geojson) return;
    const source = mapRef.current?.getSource("seoul") as GeoJSONSource | undefined;
    source?.setData(enrichGeojson(geojson, districtRisk, focusedCode, selectedCodes));
  }, [districtRisk, focusedCode, geojson, selectedCodes]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" />
      {geojson ? (
        <DistrictOverlay
          geojson={geojson}
          districts={districts}
          focusedCode={focusedCode}
          selectedCodes={selectedCodes}
          movements={movements}
          populationMovements={populationMovements}
          showMosquitoRoutes={showMosquitoRoutes}
          showPopulationRoutes={showPopulationRoutes}
          onSelect={onSelect}
        />
      ) : null}
      {!geojson ? <div className="map-loading">서울 작전 지도를 불러오는 중</div> : null}
      <div className="layer-controls" aria-label="지도 이동 경로 레이어">
        <button
          type="button"
          className={showMosquitoRoutes ? "layer-toggle mosquito active" : "layer-toggle mosquito"}
          aria-pressed={showMosquitoRoutes}
          onClick={() => setShowMosquitoRoutes((visible) => !visible)}
        >
          모기 이동
        </button>
        <button
          type="button"
          className={showPopulationRoutes ? "layer-toggle population active" : "layer-toggle population"}
          aria-pressed={showPopulationRoutes}
          onClick={() => setShowPopulationRoutes((visible) => !visible)}
        >
          생활인구 이동
        </button>
      </div>
      <div className="legend">
        <span>낮음</span>
        <div className="legend-bar" />
        <span>높음</span>
        {showMosquitoRoutes && movements.length ? <span className="movement-key">→ 모기</span> : null}
        {showPopulationRoutes && populationMovements.length ? <span className="population-key">→ 생활인구</span> : null}
      </div>
    </div>
  );
}

function DistrictOverlay({
  geojson,
  districts,
  focusedCode,
  selectedCodes,
  movements,
  populationMovements,
  showMosquitoRoutes,
  showPopulationRoutes,
  onSelect
}: {
  geojson: SeoulFeatureCollection;
  districts: DistrictState[];
  focusedCode: string;
  selectedCodes: string[];
  movements: MovementFlow[];
  populationMovements: PopulationMovementFlow[];
  showMosquitoRoutes: boolean;
  showPopulationRoutes: boolean;
  onSelect: (code: string) => void;
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
  const districtByCode = Object.fromEntries(districts.map((district) => [district.code, district]));

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
    <svg className="district-overlay" viewBox={`0 0 ${width} ${height}`} aria-label="서울 자치구 위험 지도">
      <defs>
        <marker id="movement-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#57d3ff" />
        </marker>
        <marker id="population-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6df2a2" />
        </marker>
      </defs>
      {geojson.features.map((feature) => {
        const district = districtByCode[feature.properties.code];
        const risk = district?.infection_risk ?? 0;
        return (
          <path
            key={feature.properties.code}
            d={geometryPath(feature)}
            fill={riskColor(risk)}
            className={[
              "district-shape",
              selectedCodes.includes(feature.properties.code) ? "selected" : "",
              feature.properties.code === focusedCode ? "focused" : ""
            ].filter(Boolean).join(" ")}
            fillRule="evenodd"
            onClick={() => onSelect(feature.properties.code)}
          >
            <title>{feature.properties.name} · 위험도 {risk.toFixed(1)}</title>
          </path>
        );
      })}
      {showPopulationRoutes ? (
        <g className="population-routes" aria-label="자치구 간 생활인구 이동 경로">
          {populationMovements.map((movement) => {
            const source = districtByCode[movement.from_code];
            const target = districtByCode[movement.to_code];
            if (!source || !target) return null;
            const [x1, y1] = project(source.centroid);
            const [x2, y2] = project(target.centroid);
            return (
              <line
                key={`${movement.from_code}-${movement.to_code}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="population-route"
                strokeWidth={Math.min(9, 2 + movement.estimated_people / 900)}
                markerEnd="url(#population-arrow)"
              >
                <title>{source.name} → {target.name} · 약 {movement.estimated_people.toLocaleString()}명</title>
              </line>
            );
          })}
        </g>
      ) : null}
      {showMosquitoRoutes ? (
        <g className="movement-routes" aria-label="자치구 간 모기 이동 경로">
          {movements.map((movement) => {
          const source = districtByCode[movement.from_code];
          const target = districtByCode[movement.to_code];
          if (!source || !target) return null;
          const [x1, y1] = project(source.centroid);
          const [x2, y2] = project(target.centroid);
          return (
            <line
              key={`${movement.from_code}-${movement.to_code}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="movement-route"
              strokeWidth={Math.min(8, 2 + movement.estimated_adults * 1.4)}
              markerEnd="url(#movement-arrow)"
            >
              <title>
                {source.name} → {target.name} · 약 {movement.estimated_adults.toFixed(1)}마리
              </title>
            </line>
          );
          })}
        </g>
      ) : null}
      {districts.map((district) => {
        const [x, y] = project(district.centroid);
        return (
          <text key={district.code} x={x} y={y} className="district-name">
            {district.name}
          </text>
        );
      })}
    </svg>
  );
}

function riskColor(risk: number): string {
  if (risk >= 70) return "#9b2226";
  if (risk >= 45) return "#ee6c4d";
  if (risk >= 25) return "#f4d35e";
  return "#d7f0d1";
}

function enrichGeojson(
  geojson: SeoulFeatureCollection,
  districtRisk: Record<string, number>,
  focusedCode: string,
  selectedCodes: string[]
): SeoulFeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        risk: districtRisk[feature.properties.code] ?? 0,
        selected: selectedCodes.includes(feature.properties.code),
        focused: feature.properties.code === focusedCode
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
