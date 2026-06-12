"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FIPS_TO_ABBR, parseGeoid } from "../lib/states";

const ABBR_TO_FIPS = Object.fromEntries(Object.entries(FIPS_TO_ABBR).map(([f, a]) => [a, f]));

export type HoverInfo = { geoid: string; x: number; y: number };
export type ViewContext = { geoid: string | null; zoom: number };
export type MapHandle = {
  selectGeoid: (geoid: string | null, opts?: { fly?: boolean }) => void;
  findSeat: (state: string, district: number) => string | null;
  flyToState: (abbr: string) => void;
  flyNational: () => void;
  highlightState: (abbr: string | null) => void;
};

type Props = {
  /** activity keyed by "CA-12" / "AK-0" style seat keys */
  activity: Record<string, number>;
  maxActivity: number;
  onSelect: (geoid: string) => void;
  onHover: (info: HoverInfo | null) => void;
  /** fired after the user pans/zooms — reports the district under the visual center */
  onViewContext: (ctx: ViewContext) => void;
};

type Feature = GeoJSON.Feature<GeoJSON.Geometry, { GEOID: string }>;
type IndexedFeature = { feature: Feature; bbox: [number, number, number, number] };

function pointInRing(pt: [number, number], ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(pt: [number, number], geom: GeoJSON.Geometry): boolean {
  if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return false;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.some((poly) => pointInRing(pt, poly[0]) && !poly.slice(1).some((hole) => pointInRing(pt, hole)));
}

function normalizeLng(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function bboxOf(geom: GeoJSON.Geometry): [number, number, number, number] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const eat = (c: GeoJSON.Position) => {
    if (c[0] < minX) minX = c[0];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[1] > maxY) maxY = c[1];
  };
  const walk = (coords: unknown): void => {
    if (typeof (coords as GeoJSON.Position)[0] === "number") eat(coords as GeoJSON.Position);
    else (coords as unknown[]).forEach(walk);
  };
  if ("coordinates" in geom) walk(geom.coordinates);
  if (maxX - minX > 180) {
    // crosses the antimeridian (e.g. Alaska's Aleutians): shift eastern lngs west
    minX = 180; maxX = -180;
    const eatShifted = (c: GeoJSON.Position) => {
      const x = c[0] > 0 ? c[0] - 360 : c[0];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    };
    const walkShifted = (coords: unknown): void => {
      if (typeof (coords as GeoJSON.Position)[0] === "number") eatShifted(coords as GeoJSON.Position);
      else (coords as unknown[]).forEach(walkShifted);
    };
    if ("coordinates" in geom) walkShifted(geom.coordinates);
  }
  return [minX, minY, maxX, maxY];
}

/** Reserve space for the side dock on desktop, the bottom sheet on mobile. */
function fitPadding(map: maplibregl.Map) {
  const w = map.getContainer().clientWidth;
  const h = map.getContainer().clientHeight;
  return w < 768
    ? { top: 90, bottom: Math.min(300, Math.round(h * 0.4)), left: 24, right: 24 }
    : { top: 140, bottom: 60, left: 60, right: 480 };
}

/**
 * Padding for the zoomed-out national frame. Reserving the full 480px dock on
 * narrow viewports would force a zoom below minZoom and misplace the center,
 * so only reserve it when there is room.
 */
function nationalPadding(map: maplibregl.Map) {
  const w = map.getContainer().clientWidth;
  const h = map.getContainer().clientHeight;
  if (w < 768) return { top: 90, bottom: Math.min(300, Math.round(h * 0.4)), left: 24, right: 24 };
  if (w < 1100) return { top: 130, bottom: 60, left: 40, right: 40 };
  return { top: 140, bottom: 60, left: 60, right: 480 };
}

const CivicMap = forwardRef<MapHandle, Props>(function CivicMap(
  { activity, maxActivity, onSelect, onHover, onViewContext },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const featuresRef = useRef<Feature[]>([]);
  const indexedFeaturesRef = useRef<IndexedFeature[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const stateHighlightRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  // Set just before programmatic flights so the resulting moveend doesn't re-derive context.
  // Auto-disarms in case the flight produces no camera change (and thus no moveend).
  const suppressRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armSuppress = () => {
    suppressRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => (suppressRef.current = false), 1800);
  };
  const cbRef = useRef({ onSelect, onHover, onViewContext });
  cbRef.current = { onSelect, onHover, onViewContext };
  const activityRef = useRef({ activity, maxActivity });
  activityRef.current = { activity, maxActivity };

  const featureAtLngLat = (lng: number, lat: number) => {
    const x = normalizeLng(lng);
    const pt: [number, number] = [x, lat];
    return indexedFeaturesRef.current.find(({ feature, bbox }) => {
      const [minX, minY, maxX, maxY] = bbox;
      if (x < minX || x > maxX || lat < minY || lat > maxY) return false;
      return pointInGeometry(pt, feature.geometry);
    })?.feature;
  };

  const paintActivity = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { activity, maxActivity } = activityRef.current;
    for (const f of featuresRef.current) {
      const parsed = parseGeoid(f.properties.GEOID);
      const count = parsed ? activity[`${parsed.state}-${parsed.district}`] ?? 0 : 0;
      map.setFeatureState(
        { source: "districts", id: f.properties.GEOID },
        { activity: maxActivity > 0 ? count / maxActivity : 0, count }
      );
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [-96.5, 38.6],
      zoom: 3.6,
      minZoom: 2.8,
      maxZoom: 12,
      attributionControl: { compact: true },
      // lets users (and tests) capture the map canvas as an image
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __cmap?: maplibregl.Map }).__cmap = map;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.on("load", async () => {
      // frame the continental US for any viewport shape, leaving room for the panel/sheet
      armSuppress();
      try {
        map.fitBounds([-124.8, 24.4, -66.9, 49.4], { padding: nationalPadding(map), duration: 0 });
      } catch {
        /* tiny viewports: keep default view */
      }
      const res = await fetch("/data/districts.geojson");
      const geojson = (await res.json()) as GeoJSON.FeatureCollection;
      featuresRef.current = geojson.features as Feature[];
      indexedFeaturesRef.current = featuresRef.current.map((feature) => ({ feature, bbox: bboxOf(feature.geometry) }));

      map.addSource("districts", { type: "geojson", data: geojson, promoteId: "GEOID" });
      map.addSource("states", { type: "geojson", data: "/data/states.geojson", promoteId: "GEOID" });

      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;

      map.addLayer(
        {
          id: "district-fill",
          type: "fill",
          source: "districts",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["feature-state", "activity"], 0],
              0, "rgba(94,118,160,0.10)",
              0.15, "rgba(45,160,200,0.28)",
              0.45, "rgba(45,212,191,0.42)",
              1, "rgba(94,234,212,0.65)",
            ],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "selected"], false], 0.95,
              ["boolean", ["feature-state", "hover"], false], 0.9,
              0.62,
            ],
          },
        },
        firstSymbol
      );
      map.addLayer(
        {
          id: "district-line",
          type: "line",
          source: "districts",
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false], "#5eead4",
              ["boolean", ["feature-state", "hover"], false], "#7dd3fc",
              "rgba(148,163,184,0.25)",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false], 2.4,
              ["boolean", ["feature-state", "hover"], false], 1.6,
              0.5,
            ],
          },
        },
        firstSymbol
      );
      map.addLayer(
        {
          id: "state-line",
          type: "line",
          source: "states",
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "active"], false], "#5eead4",
              "rgba(203,213,225,0.35)",
            ],
            "line-width": ["case", ["boolean", ["feature-state", "active"], false], 2.2, 1.1],
          },
        },
        firstSymbol
      );

      readyRef.current = true;
      paintActivity();

      const clearHover = () => {
        if (hoveredRef.current) {
          map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
          hoveredRef.current = null;
        }
        map.getCanvas().style.cursor = "";
        cbRef.current.onHover(null);
      };

      const setHoverAtPoint = (point: maplibregl.Point, lng: number, lat: number) => {
        const f = featureAtLngLat(lng, lat);
        const rendered = f ? null : map.queryRenderedFeatures(point, { layers: ["district-fill"] })[0];
        const geoid = f?.properties.GEOID ?? (rendered?.properties.GEOID as string | undefined);
        if (!geoid) {
          clearHover();
          return;
        }
        if (hoveredRef.current && hoveredRef.current !== geoid) {
          map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
        }
        hoveredRef.current = geoid;
        map.setFeatureState({ source: "districts", id: geoid }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
        cbRef.current.onHover({ geoid, x: point.x, y: point.y });
      };

      const handleCanvasMove = (event: MouseEvent | PointerEvent) => {
        const rect = map.getCanvas().getBoundingClientRect();
        const point = new maplibregl.Point(event.clientX - rect.left, event.clientY - rect.top);
        const lngLat = map.unproject(point);
        setHoverAtPoint(point, lngLat.lng, lngLat.lat);
      };

      map.on("mousemove", "district-fill", (e) => {
        setHoverAtPoint(e.point, e.lngLat.lng, e.lngLat.lat);
      });
      map.on("mouseleave", "district-fill", clearHover);
      const canvas = map.getCanvas();
      canvas.addEventListener("mousemove", handleCanvasMove);
      canvas.addEventListener("pointermove", handleCanvasMove);
      canvas.addEventListener("mouseleave", clearHover);
      map.on("click", "district-fill", (e) => {
        const f = featureAtLngLat(e.lngLat.lng, e.lngLat.lat);
        const rendered = f ? null : e.features?.[0];
        const geoid = f?.properties.GEOID ?? (rendered?.properties.GEOID as string | undefined);
        if (geoid) cbRef.current.onSelect(geoid);
      });

      // After the camera settles, report the district under the visual center so
      // the panel can follow the map. Covers drag, wheel, pinch, +/- buttons and
      // keyboard — programmatic flights arm suppressRef and are skipped.
      const emitContext = () => {
        const w = map.getContainer().clientWidth;
        const h = map.getContainer().clientHeight;
        const cx = w >= 768 ? (w - 440) / 2 : w / 2;
        const cy = w < 768 ? Math.max(80, (h - 160) / 2) : h / 2;
        const feats = map.queryRenderedFeatures(
          [
            [cx - 30, cy - 30],
            [cx + 30, cy + 30],
          ],
          { layers: ["district-fill"] }
        );
        cbRef.current.onViewContext({
          geoid: (feats[0]?.properties.GEOID as string | undefined) ?? null,
          zoom: map.getZoom(),
        });
      };
      map.on("moveend", () => {
        if (suppressRef.current) {
          suppressRef.current = false;
          return;
        }
        emitContext();
      });
    });

    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      indexedFeaturesRef.current = [];
      readyRef.current = false;
    };
  }, []);

  useEffect(paintActivity, [activity, maxActivity]);

  const applySelection = (geoid: string | null, opts?: { fly?: boolean }) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (selectedRef.current && selectedRef.current !== geoid) {
      map.setFeatureState({ source: "districts", id: selectedRef.current }, { selected: false });
    }
    selectedRef.current = geoid;
    if (!geoid) return;
    map.setFeatureState({ source: "districts", id: geoid }, { selected: true });
    if (opts?.fly === false) return;
    const f = featuresRef.current.find((x) => x.properties.GEOID === geoid);
    if (f) {
      armSuppress();
      try {
        map.fitBounds(bboxOf(f.geometry), {
          padding: fitPadding(map),
          maxZoom: 8.5,
          duration: 1100,
          essential: true,
        });
      } catch {
        map.fitBounds(bboxOf(f.geometry), { maxZoom: 8.5, duration: 1100, essential: true });
      }
    }
  };

  useImperativeHandle(ref, () => ({
    selectGeoid: applySelection,
    findSeat: (state: string, district: number) => {
      const f = featuresRef.current.find((x) => {
        const p = parseGeoid(x.properties.GEOID);
        return p?.state === state && p?.district === district;
      });
      return f?.properties.GEOID ?? null;
    },
    highlightState: (abbr: string | null) => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const fips = abbr ? ABBR_TO_FIPS[abbr] : null;
      if (stateHighlightRef.current && stateHighlightRef.current !== fips) {
        map.setFeatureState({ source: "states", id: stateHighlightRef.current }, { active: false });
      }
      stateHighlightRef.current = fips ?? null;
      if (fips) map.setFeatureState({ source: "states", id: fips }, { active: true });
    },
    flyNational: () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      armSuppress();
      try {
        map.fitBounds([-124.8, 24.4, -66.9, 49.4], { padding: nationalPadding(map), duration: 900, essential: true });
      } catch {
        /* keep view */
      }
    },
    flyToState: (abbr: string) => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      let box: [number, number, number, number] | null = null;
      for (const f of featuresRef.current) {
        const parsed = parseGeoid(f.properties.GEOID);
        if (parsed?.state !== abbr) continue;
        const b = bboxOf(f.geometry);
        box = box
          ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])]
          : b;
      }
      if (box) {
        armSuppress();
        try {
          map.fitBounds(box, { padding: fitPadding(map), duration: 1200, essential: true });
        } catch {
          map.fitBounds(box, { duration: 1200, essential: true });
        }
      }
    },
  }));

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
});

export default CivicMap;
