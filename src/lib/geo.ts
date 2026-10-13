import { Coordinates } from "@/types/game";

const EARTH_RADIUS_MILES = 3958.7613;
const EARTH_RADIUS_KM = 6371.0088;

export type MapLibreLngLat = [longitude: number, latitude: number];

export function toMapLibreLngLat(
  coordinates: Coordinates
): MapLibreLngLat {
  return [coordinates.longitude, coordinates.latitude];
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

function toUnitVector(
  longitude: number,
  latitude: number
): [number, number, number] {
  const phi = toRad(latitude);
  const lambda = toRad(longitude);
  return [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
}

function fromUnitVector(
  vector: [number, number, number]
): MapLibreLngLat {
  const hyp = Math.hypot(vector[0], vector[1]);
  const latitude = toDeg(Math.atan2(vector[2], hyp));
  const longitude = toDeg(Math.atan2(vector[1], vector[0]));
  return [longitude, latitude];
}

function normalize(vector: [number, number, number]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 1e-9) return [0, 0, 1];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(
  first: [number, number, number],
  second: [number, number, number]
): [number, number, number] {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function interpolateSlerp(
  start: [number, number, number],
  end: [number, number, number],
  fraction: number
): [number, number, number] {
  let dot = start[0] * end[0] + start[1] * end[1] + start[2] * end[2];
  dot = Math.max(-1, Math.min(1, dot));

  if (dot > 0.999999) {
    return normalize([
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
      start[2] + (end[2] - start[2]) * fraction,
    ]);
  }

  if (dot < -0.999999) {
    const orthogonal: [number, number, number] =
      Math.abs(start[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const normal = normalize(cross(start, orthogonal));
    const angle = Math.PI * fraction;
    return [
      start[0] * Math.cos(angle) + normal[0] * Math.sin(angle),
      start[1] * Math.cos(angle) + normal[1] * Math.sin(angle),
      start[2] * Math.cos(angle) + normal[2] * Math.sin(angle),
    ];
  }

  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const startScale = Math.sin((1 - fraction) * angle) / sinAngle;
  const endScale = Math.sin(fraction * angle) / sinAngle;

  return [
    startScale * start[0] + endScale * end[0],
    startScale * start[1] + endScale * end[1],
    startScale * start[2] + endScale * end[2],
  ];
}

export function getRawGeodesicPoints(
  start: MapLibreLngLat,
  end: MapLibreLngLat,
  pointCount = 80
): MapLibreLngLat[] {
  const startVector = toUnitVector(start[0], start[1]);
  const endVector = toUnitVector(end[0], end[1]);

  return Array.from({ length: pointCount + 1 }, (_, index) => {
    if (index === 0) return [start[0], start[1]];
    if (index === pointCount) return [end[0], end[1]];
    return fromUnitVector(
      interpolateSlerp(startVector, endVector, index / pointCount)
    );
  });
}

export function splitCoordsAtAntimeridian(
  coordinates: MapLibreLngLat[]
): MapLibreLngLat[][] {
  if (coordinates.length === 0) return [];

  const segments: MapLibreLngLat[][] = [];
  let currentSegment: MapLibreLngLat[] = [coordinates[0]];

  for (let index = 1; index < coordinates.length; index++) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const longitudeDelta = current[0] - previous[0];

    if (Math.abs(longitudeDelta) > 180) {
      const fraction =
        (180 - Math.abs(previous[0])) / (360 - Math.abs(longitudeDelta));
      const splitLatitude =
        previous[1] +
        (current[1] - previous[1]) *
          Math.max(0, Math.min(1, fraction || 0.5));

      if (previous[0] > 0) {
        currentSegment.push([180, splitLatitude]);
        segments.push(currentSegment);
        currentSegment = [[-180, splitLatitude], current];
      } else {
        currentSegment.push([-180, splitLatitude]);
        segments.push(currentSegment);
        currentSegment = [[180, splitLatitude], current];
      }
    } else {
      currentSegment.push(current);
    }
  }

  segments.push(currentSegment);
  return segments;
}

/**
 * Calculates great-circle geodesic distance using the Haversine formula.
 *
 * d = 2 * R * arcsin(sqrt(sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLng/2)))
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): { miles: number; km: number } {
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLng = toRad(coord2.longitude - coord1.longitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const a = Math.max(0, Math.min(1, haversine));

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const miles = Math.round(EARTH_RADIUS_MILES * c * 10) / 10;
  const km = Math.round(EARTH_RADIUS_KM * c * 10) / 10;

  return { miles, km };
}

export type RevealDistanceBand =
  | "short"
  | "regional"
  | "continental"
  | "global";

export interface RevealCameraPlan {
  band: RevealDistanceBand;
  waypointZoom: number;
  waypointDuration: number;
  routeDuration: number;
  answerDuration: number;
  localZoom: number;
  cameraTarget: Coordinates;
}

export function getRevealCameraPlan(
  distanceMiles: number,
  answer: Coordinates
): RevealCameraPlan {
  if (!Number.isFinite(distanceMiles) || distanceMiles < 0) {
    throw new Error("Distance must be a finite, non-negative number of miles.");
  }

  if (distanceMiles < 60) {
    return {
      band: "short",
      waypointZoom: 5.2,
      waypointDuration: 0,
      routeDuration: 250,
      answerDuration: 450,
      localZoom: 8,
      cameraTarget: answer,
    };
  }
  if (distanceMiles < 1000) {
    return {
      band: "regional",
      waypointZoom: 3.2,
      waypointDuration: 400,
      routeDuration: 450,
      answerDuration: 650,
      localZoom: 8,
      cameraTarget: answer,
    };
  }
  if (distanceMiles < 5000) {
    return {
      band: "continental",
      waypointZoom: 1.8,
      waypointDuration: 700,
      routeDuration: 650,
      answerDuration: 950,
      localZoom: 8,
      cameraTarget: answer,
    };
  }
  return {
    band: "global",
    waypointZoom: 1.35,
    waypointDuration: 1000,
    routeDuration: 850,
    answerDuration: 1300,
    localZoom: 8,
    cameraTarget: answer,
  };
}
