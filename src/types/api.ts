// TomTom Routing API v1 — response shapes.
// Only the fields we actually use are typed; extras are ignored.

export interface TomTomRouteResponse {
  routes: TomTomRoute[];
}

export interface TomTomRoute {
  summary: TomTomRouteSummary;
  legs: TomTomLeg[];
}

export interface TomTomRouteSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
  departureTime: string;
  arrivalTime: string;
}

export interface TomTomLeg {
  summary: TomTomRouteSummary;
  points: TomTomPoint[];
}

export interface TomTomPoint {
  latitude: number;
  longitude: number;
}
