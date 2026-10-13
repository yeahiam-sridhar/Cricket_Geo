"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Coordinates, GuessResponse, RevealPhase } from "@/types/game";
import { soundController } from "@/lib/audio";
import { CRICKET_STADIUMS_GEOJSON } from "@/lib/cricket-stadiums";
import {
  getRawGeodesicPoints,
  getRevealCameraPlan,
  splitCoordsAtAntimeridian,
  toMapLibreLngLat,
} from "@/lib/geo";

interface CricketGlobeMapProps {
  selectedGuess: Coordinates | null;
  onSubmitGuess: (coords: Coordinates) => void;
  revealData: GuessResponse | null;
  isSubmitting: boolean;
  isResultMode?: boolean;
  onRevealPhaseChange?: (phase: RevealPhase) => void;
  onRevealAnimationComplete?: () => void;
}

type CameraFocusMode = "answer" | "guess" | "overview";

export default function CricketGlobeMap({
  selectedGuess,
  onSubmitGuess,
  revealData,
  isSubmitting,
  isResultMode = false,
  onRevealPhaseChange,
  onRevealAnimationComplete,
}: CricketGlobeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  const guessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const answerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const distanceMarkerRef = useRef<maplibregl.Marker | null>(null);

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const isMapInteractionLockedRef = useRef(false);
  const onSubmitGuessRef = useRef(onSubmitGuess);
  const isSubmittingRef = useRef<boolean>(isSubmitting);
  const revealDataRef = useRef<GuessResponse | null>(revealData);
  const onRevealPhaseChangeRef = useRef(onRevealPhaseChange);
  const onRevealAnimationCompleteRef = useRef(onRevealAnimationComplete);
  const animFrameRef = useRef<number | null>(null);
  const revealRunRef = useRef(0);
  const revealAudioKeyRef = useRef<string | null>(null);

  const [focusMode, setFocusMode] = useState<CameraFocusMode>("overview");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);
  const [showSlowNetworkFallback, setShowSlowNetworkFallback] = useState(false);

  useEffect(() => {
    if (!isSubmitting) {
      setShowSlowNetworkFallback(false);
      return;
    }
    // Subtle fallback only after an appropriate delay (>2.0s) for unusually slow network
    const timer = setTimeout(() => {
      setShowSlowNetworkFallback(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSubmitting]);


  useEffect(() => {
    onSubmitGuessRef.current = onSubmitGuess;
    isSubmittingRef.current = isSubmitting;
    revealDataRef.current = revealData;
    onRevealPhaseChangeRef.current = onRevealPhaseChange;
    onRevealAnimationCompleteRef.current = onRevealAnimationComplete;
  }, [
    isSubmitting,
    onSubmitGuess,
    revealData,
    onRevealPhaseChange,
    onRevealAnimationComplete,
  ]);

  // 1. Initialize MapLibre 3D Globe with Multi-Tier Geographic Labels
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const initialZoom = isMobile ? 1.3 : 1.75;

    const globeStyle: maplibregl.StyleSpecification = {
      version: 8,
      projection: {
        type: "globe",
      },
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Tiles © Esri",
        },
        openmaptiles: {
          type: "vector",
          url: "https://tiles.openfreemap.org/planet",
          attribution: "© OpenStreetMap contributors · OpenFreeMap",
        },
        "cricket-stadiums": {
          type: "geojson",
          data: CRICKET_STADIUMS_GEOJSON as any,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#020408",
          },
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite",
          minzoom: 0,
          maxzoom: 20,
        },
        // State & Province Boundary lines (zoom 3.5+)
        {
          id: "boundary-state",
          type: "line",
          source: "openmaptiles",
          "source-layer": "boundary",
          minzoom: 3.5,
          filter: [
            "all",
            ["==", ["get", "admin_level"], 4],
            ["!=", ["get", "maritime"], 1],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "rgba(255, 255, 255, 0.45)",
            "line-dasharray": [2, 2],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0.6,
              8,
              1.2,
            ],
          },
        },
        // Country Boundary lines (zoom 0+)
        {
          id: "boundary-country",
          type: "line",
          source: "openmaptiles",
          "source-layer": "boundary",
          filter: [
            "all",
            ["==", ["get", "admin_level"], 2],
            ["!=", ["get", "maritime"], 1],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "rgba(255, 255, 255, 0.85)",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              0.6,
              4,
              1.1,
              8,
              1.8,
            ],
          },
        },
        // Level 1: Country Names (Full English Name prioritized, zoom 0-7)
        {
          id: "label-country",
          type: "symbol",
          source: "openmaptiles",
          "source-layer": "place",
          maxzoom: 8,
          filter: ["==", ["get", "class"], "country"],
          layout: {
            "text-field": [
              "coalesce",
              ["get", "name:en"],
              ["get", "name"],
              ["get", "iso_a2"],
            ],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              10,
              3,
              12,
              5,
              15,
              7,
              18,
            ],
            "text-letter-spacing": 0.06,
            "text-max-width": 8,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(2, 4, 8, 0.9)",
            "text-halo-width": 2.0,
          },
        },
        // Level 2: State & Province Labels (e.g. Maharashtra, Tamil Nadu, Queensland, zoom 4-10)
        {
          id: "label-state",
          type: "symbol",
          source: "openmaptiles",
          "source-layer": "place",
          minzoom: 3.8,
          maxzoom: 10,
          filter: ["in", ["get", "class"], ["literal", ["state", "province"]]],
          layout: {
            "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              9.5,
              6,
              12,
              9,
              14,
            ],
            "text-letter-spacing": 0.05,
            "text-max-width": 8,
          },
          paint: {
            "text-color": "rgba(226, 232, 240, 0.9)",
            "text-halo-color": "rgba(2, 4, 8, 0.85)",
            "text-halo-width": 1.6,
          },
        },
        // Level 3: City Labels (zoom 5.5+)
        {
          id: "label-city",
          type: "symbol",
          source: "openmaptiles",
          "source-layer": "place",
          minzoom: 5.5,
          filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
          layout: {
            "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6,
              9.5,
              9,
              12,
              13,
              15,
            ],
            "text-max-width": 9,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0, 0, 0, 0.95)",
            "text-halo-width": 1.8,
          },
        },
        // Level 4: Iconic Cricket Grounds & Stadiums (zoom 7.0+)
        {
          id: "label-stadiums",
          type: "symbol",
          source: "cricket-stadiums",
          minzoom: 7.0,
          layout: {
            "text-field": ["concat", "🏏 ", ["get", "name"]],
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7.5,
              10,
              10,
              12,
              14,
              14.5,
            ],
            "text-variable-anchor": ["top", "bottom", "left", "right"],
            "text-radial-offset": 0.6,
            "text-justify": "auto",
            "text-max-width": 10,
          },
          paint: {
            "text-color": "#38bdf8",
            "text-halo-color": "#020408",
            "text-halo-width": 2.2,
          },
        },
      ],
      sky: {
        "atmosphere-blend": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.95,
          4,
          0.6,
          7,
          0.1,
        ],
      },
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: globeStyle,
      center: [20, 20],
      zoom: initialZoom,
      minZoom: 1.0,
      maxZoom: 18,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: false,
      touchZoomRotate: true,
      clickTolerance: 14,
    });
    map.once("load", () => setIsMapLoaded(true));

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: false,
      }),
      "top-right"
    );

    const canvas = map.getCanvas();
    const onPointerDown = (e: PointerEvent) => {
      pointerDownRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    // ONE-TAP GAMEPLAY:
    // A deliberate tap locks the guess and triggers audio
    // Supports touch tolerance (up to 16px shift) for mobile touchscreens while strictly rejecting drag gestures
    map.on("click", (e) => {
      if (
        revealDataRef.current ||
        isSubmittingRef.current ||
        isMapInteractionLockedRef.current
      ) {
        return;
      }
      if (!pointerDownRef.current) return;

      const orig = e.originalEvent as MouseEvent | PointerEvent;
      const dist = Math.hypot(
        orig.clientX - pointerDownRef.current.x,
        orig.clientY - pointerDownRef.current.y
      );
      const elapsed = Date.now() - pointerDownRef.current.time;

      const isTouch =
        (orig instanceof PointerEvent && orig.pointerType === "touch") ||
        ("touches" in orig);
      const maxAllowedDist = isTouch ? 16 : 8;
      const maxAllowedTime = isTouch ? 450 : 400;

      if (dist > maxAllowedDist || elapsed > maxAllowedTime) {
        return;
      }

      if (!e.lngLat || isNaN(e.lngLat.lat) || isNaN(e.lngLat.lng)) {
        return;
      }

      const coords: Coordinates = {
        latitude: Math.round(e.lngLat.lat * 100000) / 100000,
        longitude: Math.round(e.lngLat.lng * 100000) / 100000,
      };

      // Immediately lock map interaction to prevent double tap
      isMapInteractionLockedRef.current = true;

      // Play crisp guess confirmation sound on deliberate tap
      soundController.playGuessConfirm();
      onSubmitGuessRef.current(coords);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const onWindowResize = () => map.resize();
    window.addEventListener("resize", onWindowResize);

    mapInstanceRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      revealRunRef.current += 1;
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Player's Guess Marker on the Globe
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    if (selectedGuess) {
      if (!guessMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "cricket-guess-marker cursor-pointer select-none marker-drop";
        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="relative flex items-center justify-center">
              <span class="pin-ripple ring-1 bg-emerald-500/40"></span>
              <span class="pin-ripple ring-2 bg-emerald-500/25"></span>
              <span class="pin-ripple ring-3 bg-emerald-500/15"></span>
              <span class="relative flex items-center justify-center w-7 h-7 bg-emerald-500 border-2 border-white rounded-full shadow-2xl text-slate-950 font-black text-xs z-10">
                📍
              </span>
            </div>
            <div class="mt-1 px-2.5 py-0.5 bg-slate-950/90 text-emerald-300 border border-emerald-500/60 rounded-full text-[10px] font-bold shadow-xl whitespace-nowrap z-10">
              Your Guess
            </div>
          </div>
        `;

        guessMarkerRef.current = new maplibregl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat(toMapLibreLngLat(selectedGuess))
          .addTo(map);
      } else {
        guessMarkerRef.current.setLngLat(toMapLibreLngLat(selectedGuess));
      }

      // Smooth non-blocking camera ease toward player's guess to provide instant visual responsiveness
      if (!revealDataRef.current) {
        map.easeTo({
          center: toMapLibreLngLat(selectedGuess),
          duration: 500,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: false,
        });
      }
    } else {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.remove();
        guessMarkerRef.current = null;
      }
    }
  }, [isMapLoaded, selectedGuess]);

  // 3. Distance-aware guess-to-answer reveal
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    const runId = ++revealRunRef.current;
    const isCurrentRun = () => revealRunRef.current === runId;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const cleanRevealVisuals = () => {
      answerMarkerRef.current?.remove();
      answerMarkerRef.current = null;
      distanceMarkerRef.current?.remove();
      distanceMarkerRef.current = null;
      if (map.getLayer("arc-laser")) map.removeLayer("arc-laser");
      if (map.getLayer("arc-glow")) map.removeLayer("arc-glow");
      if (map.getLayer("arc-line")) map.removeLayer("arc-line");
      if (map.getSource("arc-source")) map.removeSource("arc-source");
    };

    if (!revealData) {
      revealAudioKeyRef.current = null;
      setIsRevealAnimating(false);
      cleanRevealVisuals();
      map.stop();
      const isMobile =
        typeof window !== "undefined" && window.innerWidth < 640;
      const resetView = {
        center: [20, 20] as [number, number],
        zoom: isMobile ? 1.4 : 1.75,
        pitch: 0,
        bearing: 0,
      };
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const currentCenter = map.getCenter();
      const requiresReset =
        Math.abs(currentCenter.lng - 20) > 1e-5 ||
        Math.abs(currentCenter.lat - 20) > 1e-5 ||
        Math.abs(map.getZoom() - resetView.zoom) > 1e-5;
      if (prefersReducedMotion || !requiresReset) {
        isMapInteractionLockedRef.current = false;
        map.jumpTo(resetView);
      } else {
        isMapInteractionLockedRef.current = true;
        map.once("moveend", () => {
          if (isCurrentRun()) isMapInteractionLockedRef.current = false;
        });
        map.easeTo({
          ...resetView,
          duration: 850,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      }
      return () => {
        if (isCurrentRun()) revealRunRef.current += 1;
      };
    }

    cleanRevealVisuals();
    map.stop();
    isMapInteractionLockedRef.current = true;
    setIsRevealAnimating(true);

    const guessLngLat = toMapLibreLngLat(revealData.guess);
    const answerLngLat = toMapLibreLngLat(revealData.answer);
    const plan = getRevealCameraPlan(
      revealData.distanceMiles,
      revealData.answer
    );
    const pointCount =
      plan.band === "short"
        ? 32
        : plan.band === "regional"
          ? 64
          : plan.band === "continental"
            ? 96
            : 128;
    const rawPoints = getRawGeodesicPoints(
      guessLngLat,
      answerLngLat,
      pointCount
    );
    const midPoint = rawPoints[Math.floor(rawPoints.length / 2)];
    const fullSegments = splitCoordsAtAntimeridian(rawPoints);
    const initialSegments = splitCoordsAtAntimeridian(rawPoints.slice(0, 2));
    const audioKey = `${revealData.questionId}:${guessLngLat.join(",")}:${answerLngLat.join(",")}`;

    if (process.env.NODE_ENV !== "production") {
      console.debug("[CricketGeo reveal coordinates]", {
        questionId: revealData.questionId,
        guessCoordinates: revealData.guess,
        answerCoordinates: revealData.answer,
        distanceMiles: revealData.distanceMiles,
        finalCameraTarget: plan.cameraTarget,
      });
    }
    if (revealAudioKeyRef.current !== audioKey) {
      soundController.playGlobeWhoosh();
      revealAudioKeyRef.current = audioKey;
    }

    const answerEl = document.createElement("div");
    answerEl.className =
      "cricket-answer-marker cursor-pointer select-none marker-drop";
    answerEl.innerHTML = `
      <div class="relative flex flex-col items-center">
        <div class="relative flex items-center justify-center">
          <span class="target-radar-ring ring-1"></span>
          <span class="target-radar-ring ring-2"></span>
          <span class="pin-ripple ring-1 bg-blue-500/50"></span>
          <span class="pin-ripple ring-2 bg-blue-500/30"></span>
          <span class="relative flex items-center justify-center w-8 h-8 bg-blue-600 border-2 border-white rounded-full shadow-2xl text-white font-bold text-sm z-10">
            🏏
          </span>
        </div>
        <div class="mt-1 px-3 py-1 bg-slate-950/95 text-blue-300 border border-blue-500/80 rounded-full text-xs font-bold shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-10">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span>${revealData.answer.name}</span>
        </div>
      </div>
    `;
    answerMarkerRef.current = new maplibregl.Marker({
      element: answerEl,
      anchor: "bottom",
    })
      .setLngLat(answerLngLat)
      .addTo(map);

    map.addSource("arc-source", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiLineString",
              coordinates: initialSegments,
            },
          },
        ],
      },
    });
    map.addLayer({
      id: "arc-glow",
      type: "line",
      source: "arc-source",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f43f5e",
        "line-width": 8,
        "line-opacity": 0.55,
        "line-blur": 4,
      },
    });
    map.addLayer({
      id: "arc-line",
      type: "line",
      source: "arc-source",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ef4444",
        "line-width": 3.8,
        "line-opacity": 0.95,
      },
    });
    map.addLayer({
      id: "arc-laser",
      type: "line",
      source: "arc-source",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.4,
        "line-opacity": 0.9,
      },
    });

    const distEl = document.createElement("div");
    distEl.className = "cricket-distance-badge select-none marker-drop";
    distEl.innerHTML = `
      <div class="px-3 py-1 bg-slate-950/90 backdrop-blur-md text-slate-100 border border-slate-700/80 rounded-full text-xs font-bold shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
        <span class="text-rose-400 font-mono">📏 ${revealData.distanceMiles.toLocaleString()} mi</span>
      </div>
    `;
    distanceMarkerRef.current = new maplibregl.Marker({
      element: distEl,
      anchor: "center",
    })
      .setLngLat(midPoint)
      .addTo(map);

    const emitPhase = (phase: RevealPhase) => {
      if (isCurrentRun()) onRevealPhaseChangeRef.current?.(phase);
    };
    const setRouteData = (coordinates: [number, number][][]) => {
      const source = map.getSource("arc-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "MultiLineString", coordinates },
          },
        ],
      });
    };
    const moveCamera = (
      center: [number, number],
      zoom: number,
      duration: number,
      onMoveEnd: () => void,
      pitch = 0,
      bearing = 0
    ) => {
      if (!isCurrentRun()) return;
      if (duration === 0) {
        map.jumpTo({ center, zoom, pitch, bearing });
        onMoveEnd();
        return;
      }
      map.once("moveend", onMoveEnd);
      map.easeTo({
        center,
        zoom,
        pitch,
        bearing,
        duration,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    };
    const finishReveal = () => {
      if (!isCurrentRun()) return;
      setIsRevealAnimating(false);
      isMapInteractionLockedRef.current = false;
      emitPhase("score-presentation");
      onRevealAnimationCompleteRef.current?.();
    };
    const moveToLocalCloseUp = () => {
      if (!isCurrentRun()) return;
      emitPhase("local-close-up");
      const isMobile =
        typeof window !== "undefined" && window.innerWidth < 640;
      const stadiumPitch = isMobile ? 24 : 34;
      const stadiumBearing = -10;
      moveCamera(
        answerLngLat,
        isMobile ? plan.localZoom - 0.5 : plan.localZoom,
        460,
        finishReveal,
        stadiumPitch,
        stadiumBearing
      );
    };
    const travelToAnswer = () => {
      if (!isCurrentRun()) return;
      emitPhase("camera-travels");
      const travelZoom =
        plan.band === "short" ? 5.2 : plan.band === "regional" ? 4.4 : 2.4;
      moveCamera(
        toMapLibreLngLat(plan.cameraTarget),
        travelZoom,
        plan.answerDuration,
        moveToLocalCloseUp
      );
    };
    const revealRoute = () => {
      if (!isCurrentRun()) return;
      emitPhase("route-revealed");
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        setRouteData(fullSegments);
        travelToAnswer();
        return;
      }

      const startTime = performance.now();
      const animateArc = (currentTime: number) => {
        if (!isCurrentRun()) return;
        const progress = Math.min(
          1,
          (currentTime - startTime) / plan.routeDuration
        );
        const count = Math.max(
          2,
          Math.floor(progress * (rawPoints.length - 1)) + 1
        );
        setRouteData(splitCoordsAtAntimeridian(rawPoints.slice(0, count)));
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateArc);
        } else {
          animFrameRef.current = null;
          setRouteData(fullSegments);
          travelToAnswer();
        }
      };
      animFrameRef.current = requestAnimationFrame(animateArc);
    };

    emitPhase("globe-rotates");
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setRouteData(fullSegments);
      map.jumpTo({
        center: answerLngLat,
        zoom: window.innerWidth < 640 ? plan.localZoom - 0.5 : plan.localZoom,
        pitch: 0,
        bearing: 0,
      });
      emitPhase("route-revealed");
      emitPhase("camera-travels");
      emitPhase("local-close-up");
      finishReveal();
    } else if (plan.band === "short") {
      revealRoute();
    } else {
      moveCamera(midPoint, plan.waypointZoom, plan.waypointDuration, revealRoute);
    }

    return () => {
      if (isCurrentRun()) revealRunRef.current += 1;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      map.stop();
    };
  }, [isMapLoaded, revealData]);

  // 4. Manual Camera Controls in Result Mode
  const handleFlyTo = useCallback(
    (mode: CameraFocusMode) => {
      const map = mapInstanceRef.current;
      if (!map || !revealData) return;
      setFocusMode(mode);

      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      const answerLngLat = toMapLibreLngLat(revealData.answer);
      const guessLngLat = toMapLibreLngLat(revealData.guess);

      map.stop();
      soundController.playButton();

      if (mode === "answer") {
        map.easeTo({
          center: answerLngLat,
          zoom: isMobile ? 7.5 : 8.0,
          pitch: isMobile ? 24 : 34,
          bearing: -10,
          duration: 850,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      } else if (mode === "guess") {
        map.easeTo({
          center: guessLngLat,
          zoom: isMobile ? 5.5 : 6.5,
          pitch: 15,
          bearing: 0,
          duration: 800,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      } else if (mode === "overview") {
        const mid = getRawGeodesicPoints(guessLngLat, answerLngLat, 2)[1];

        let targetZoom = 1.75;
        if (revealData.distanceMiles < 150) targetZoom = 4.6;
        else if (revealData.distanceMiles < 600) targetZoom = 3.6;
        else if (revealData.distanceMiles < 2000) targetZoom = 2.4;
        else targetZoom = 1.6;

        map.easeTo({
          center: mid,
          zoom: isMobile ? Math.max(1.1, targetZoom - 0.3) : targetZoom,
          pitch: 0,
          bearing: 0,
          duration: 800,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
      }
    },
    [revealData]
  );

  return (
    <div className="relative w-full h-full bg-[#020408] overflow-hidden select-none">
      <div
        ref={mapContainerRef}
        className="w-full h-full min-h-0 z-0 cursor-grab active:cursor-grabbing"
      />

      {/* Floating instruction before guess */}
      {!revealData && !isSubmitting && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-200 text-xs px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 select-none">
          <span>🌐</span>
          <span>Rotate globe & tap where it happened</span>
        </div>
      )}

      {/* Subtle non-blocking fallback only if network latency is unusually high (>2.0s) */}
      {showSlowNetworkFallback && !revealData && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-slate-950/80 backdrop-blur-md border border-white/10 text-slate-300 text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 select-none animate-in fade-in duration-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-medium text-slate-400">Verifying score...</span>
        </div>
      )}


      {/* Result Mode: Floating Camera Focus Controls */}
      {revealData && !isRevealAnimating && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-2xl">
          <button
            type="button"
            onClick={() => handleFlyTo("answer")}
            title="Focus on correct cricket venue"
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${focusMode === "answer"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <span>🏏</span>
            <span className="hidden sm:inline">Venue</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlyTo("guess")}
            title="Focus on your guess"
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${focusMode === "guess"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <span>📍</span>
            <span className="hidden sm:inline">Guess</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlyTo("overview")}
            title="View both locations on the globe"
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${focusMode === "overview"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <span>🌐</span>
            <span className="hidden sm:inline">Both</span>
          </button>
        </div>
      )}
    </div>
  );
}
