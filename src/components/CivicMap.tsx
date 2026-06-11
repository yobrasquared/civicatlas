"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { parseGeoid } from "../lib/states";

export type HoverInfo = { geoid: string; x: number; y: number };
export type MapHandle = {
  selectGeoid: (geoid: string | null) => void;
  selectSeat: (state: string, district: number) => string | null;
  flyToState: (abbr: string) => void;
};

type Props = {
  /** activity keyed by "CA-12" / "AK-0" style seat keys */
  activity: Record<string, number>;
  maxActivity: number;
  onSelect: (geoid: string | null) => void;
  onHover: (info: HoverInfo | null) => void;
};

type Feature = GeoJSON.Feature<GeoJSON.Geometry, { GEOID: string }>;

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
  { activity, maxActivity, onSelect, onHover },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const featuresRef = useRef<Feature[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const cbRef = useRef({ onSelect, onHover });
  cbRef.current = { onSelect, onHover };
  const activityRef = useRef({ activity, maxActivity });
  activityRef.current = { activity, maxActivity };

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
      try {
        map.fitBounds([-124.8, 24.4, -66.9, 49.4], { padding: nationalPadding(map), duration: 0 });
      } catch {
        /* tiny viewports: keep default view */
      }
      const res = await fetch("/data/districts.geojson");
      const geojson = (await res.json()) as GeoJSON.FeatureCollection;
      featuresRef.current = geojson.features as Feature[];

      map.addSource("districts", { type: "geojson", data: geojson, promoteId: "GEOID" });
      map.addSource("states", { type: "geojson", data: "/data/states.geojson" });

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
          paint: { "line-color": "rgba(203,213,225,0.35)", "line-width": 1.1 },
        },
        firstSymbol
      );

      readyRef.current = true;
      paintActivity();

      map.on("mousemove", "district-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const geoid = f.properties.GEOID as string;
        if (hoveredRef.current && hoveredRef.current !== geoid) {
          map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
        }
        hoveredRef.current = geoid;
        map.setFeatureState({ source: "districts", id: geoid }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
        cbRef.current.onHover({ geoid, x: e.point.x, y: e.point.y });
      });
      map.on("mouseleave", "district-fill", () => {
        if (hoveredRef.current) {
          map.setFeatureState({ source: "districts", id: hoveredRef.current }, { hover: false });
          hoveredRef.current = null;
        }
        map.getCanvas().style.cursor = "";
        cbRef.current.onHover(null);
      });
      map.on("click", "district-fill", (e) => {
        const f = e.features?.[0];
        if (f) cbRef.current.onSelect(f.properties.GEOID as string);
      });
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(paintActivity, [activity, maxActivity]);

  const applySelection = (geoid: string | null) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (selectedRef.current) {
      map.setFeatureState({ source: "districts", id: selectedRef.current }, { selected: false });
    }
    selectedRef.current = geoid;
    if (!geoid) return;
    map.setFeatureState({ source: "districts", id: geoid }, { selected: true });
    const f = featuresRef.current.find((x) => x.properties.GEOID === geoid);
    if (f) {
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
    selectSeat: (state: string, district: number) => {
      const f = featuresRef.current.find((x) => {
        const p = parseGeoid(x.properties.GEOID);
        return p?.state === state && p?.district === district;
      });
      if (!f) return null;
      applySelection(f.properties.GEOID);
      return f.properties.GEOID;
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
