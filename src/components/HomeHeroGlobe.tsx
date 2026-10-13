"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { soundController } from "@/lib/audio";
import { MapPin, Trophy, Sparkles, Navigation } from "lucide-react";

interface HistoricVenue {
  id: string;
  name: string;
  city: string;
  country: string;
  coordinates: [number, number]; // [lng, lat]
  highlight: string;
  year: string;
  flag: string;
}

const HISTORIC_VENUES: HistoricVenue[] = [
  {
    id: "lords",
    name: "Lord's Cricket Ground",
    city: "London",
    country: "England",
    coordinates: [-0.1729, 51.5296],
    highlight: "The Home of Cricket · 2019 World Cup Final Super Over",
    year: "Est. 1814",
    flag: "🇬🇧",
  },
  {
    id: "mcg",
    name: "Melbourne Cricket Ground",
    city: "Melbourne",
    country: "Australia",
    coordinates: [144.9834, -37.82],
    highlight: "Birthplace of Test Cricket · 1992 World Cup Final",
    year: "Est. 1853",
    flag: "🇦🇺",
  },
  {
    id: "eden",
    name: "Eden Gardens",
    city: "Kolkata",
    country: "India",
    coordinates: [88.3433, 22.5646],
    highlight: "The Colosseum of Cricket · 2001 Historic Test Miracle",
    year: "Est. 1864",
    flag: "🇮🇳",
  },
  {
    id: "wankhede",
    name: "Wankhede Stadium",
    city: "Mumbai",
    country: "India",
    coordinates: [72.8258, 18.9389],
    highlight: "Dhoni's iconic 2011 World Cup-winning six into the night sky",
    year: "Est. 1974",
    flag: "🇮🇳",
  },
  {
    id: "kensington",
    name: "Kensington Oval",
    city: "Bridgetown",
    country: "Barbados",
    coordinates: [-59.6231, 13.1042],
    highlight: "Caribbean Fortress · 2007 & 2024 ICC T20 World Cup Finals",
    year: "Est. 1882",
    flag: "🇧🇧",
  },
  {
    id: "galle",
    name: "Galle International Stadium",
    city: "Galle",
    country: "Sri Lanka",
    coordinates: [80.2158, 6.0326],
    highlight: "Picturesque 17th-century Dutch fort backdrop by the Indian Ocean",
    year: "Est. 1876",
    flag: "🇱🇰",
  },
  {
    id: "modi",
    name: "Narendra Modi Stadium",
    city: "Ahmedabad",
    country: "India",
    coordinates: [72.5973, 23.0924],
    highlight: "World's largest cricket colosseum with 132,000 capacity",
    year: "Est. 1982 / 2020",
    flag: "🇮🇳",
  },
  {
    id: "newlands",
    name: "Newlands Cricket Ground",
    city: "Cape Town",
    country: "South Africa",
    coordinates: [18.4682, -33.974],
    highlight: "Framed by the majestic Table Mountain · First African Test in 1889",
    year: "Est. 1888",
    flag: "🇿🇦",
  },
];

export default function HomeHeroGlobe() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const isInteractingRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  const [activeVenue, setActiveVenue] = useState<HistoricVenue>(HISTORIC_VENUES[0]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        projection: {
          type: "globe",
        },
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
        ],
      },
      center: [-0.1729, 30],
      zoom: isMobile ? 1.15 : 1.5,
      pitch: 18,
      bearing: 0,
      interactive: true,
      dragRotate: true,
      pitchWithRotate: true,
      maxZoom: 10,
      minZoom: 1.0,
      renderWorldCopies: false,
      attributionControl: false,
    });

    map.on("load", () => {
      setIsLoaded(true);

      // Add stadium markers with pulsing radar rings
      HISTORIC_VENUES.forEach((venue) => {
        const markerEl = document.createElement("div");
        markerEl.className = "group relative cursor-pointer select-none flex flex-col items-center";
        markerEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-7 h-7 rounded-full bg-emerald-400/30 animate-ping"></span>
            <span class="absolute w-5 h-5 rounded-full bg-emerald-500/50"></span>
            <div class="relative w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[11px] shadow-lg shadow-emerald-500/50 group-hover:scale-125 transition-transform duration-200">
              🏏
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-7 px-2 py-0.5 bg-slate-950/90 border border-emerald-500/60 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-xl pointer-events-none z-20">
            ${venue.name}
          </div>
        `;

        markerEl.addEventListener("click", (e) => {
          e.stopPropagation();
          soundController.playGuessConfirm();
          setActiveVenue(venue);
          isInteractingRef.current = true;
          map.easeTo({
            center: venue.coordinates,
            zoom: isMobile ? 4.5 : 5.5,
            pitch: 32,
            bearing: -12,
            duration: 1200,
            essential: true,
          });
          // Release lock after 4 seconds
          setTimeout(() => {
            isInteractingRef.current = false;
          }, 4000);
        });

        const marker = new maplibregl.Marker({
          element: markerEl,
          anchor: "center",
        })
          .setLngLat(venue.coordinates)
          .addTo(map);

        markersRef.current.push(marker);
      });

      // Smooth ambient globe auto-rotation when user is not dragging
      if (!prefersReducedMotion) {
        let lastTimestamp = performance.now();
        const spinGlobe = (now: number) => {
          const delta = (now - lastTimestamp) / 1000;
          lastTimestamp = now;

          if (!isInteractingRef.current && mapInstanceRef.current) {
            const currentCenter = map.getCenter();
            // Subtle slow spin (1.2 degrees per second)
            const nextLng = currentCenter.lng - 1.2 * delta;
            map.jumpTo({
              center: [((nextLng + 180) % 360) - 180, currentCenter.lat],
            });
          }
          animFrameRef.current = requestAnimationFrame(spinGlobe);
        };
        animFrameRef.current = requestAnimationFrame(spinGlobe);
      }
    });

    map.on("mousedown", () => {
      isInteractingRef.current = true;
    });
    map.on("touchstart", () => {
      isInteractingRef.current = true;
    });
    map.on("dragend", () => {
      setTimeout(() => {
        isInteractingRef.current = false;
      }, 3500);
    });

    mapInstanceRef.current = map;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleSelectVenue = (venue: HistoricVenue) => {
    setActiveVenue(venue);
    soundController.playGuessConfirm();
    if (mapInstanceRef.current) {
      isInteractingRef.current = true;
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      mapInstanceRef.current.easeTo({
        center: venue.coordinates,
        zoom: isMobile ? 4.5 : 5.5,
        pitch: 32,
        bearing: -12,
        duration: 1400,
        essential: true,
      });
      setTimeout(() => {
        isInteractingRef.current = false;
      }, 4000);
    }
  };

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-square max-h-[580px] rounded-3xl overflow-hidden border border-emerald-500/20 bg-slate-950 shadow-2xl shadow-emerald-950/40 select-none">
      {/* 3D Atmospheric Vignette & Glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl z-10 shadow-[inset_0_0_80px_rgba(2,6,12,0.85)]" />
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl z-10" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl z-10" />

      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#020408] flex items-center justify-center z-20">
          <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>INITIALIZING 3D WORLD ATLAS...</span>
          </div>
        </div>
      )}

      {/* Floating Interactive Stadium Pill Strip */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] font-mono text-emerald-300">
          <Navigation className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>Interactive 3D Globe · Drag & Rotate</span>
        </div>
      </div>

      {/* Selected Stadium Spotlight Card */}
      <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-auto">
        <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-sm shrink-0">
              {activeVenue.flag}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {activeVenue.name}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {activeVenue.city}, {activeVenue.country}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5 font-medium">
                {activeVenue.highlight}
              </p>
            </div>
          </div>

          {/* Stadium Selector Badges */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 scrollbar-none self-stretch sm:self-center">
            {HISTORIC_VENUES.slice(0, 5).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectVenue(v)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all shrink-0 cursor-pointer ${
                  activeVenue.id === v.id
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
              >
                {v.city}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
