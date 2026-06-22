import type { Coordinates, EntityId } from "../../types/models";

export type { Coordinates } from "../../types/models";

export type ChengduMapCenter = {
  latitude: number;
  longitude: number;
};

export type RestaurantMapPoint = {
  id: EntityId;
  name: string;
  category: string;
  district?: string;
  coordinates: Coordinates;
  averageRating?: number;
  averageCost?: number;
  recentVisitDate?: string;
};

export type MapProviderConfig = {
  apiKey: string;
  securityCode?: string;
};

export type RestaurantMapOptions = {
  center: ChengduMapCenter;
  zoom?: number;
  points: RestaurantMapPoint[];
  selectedId?: EntityId;
  onSelect: (point: RestaurantMapPoint) => void;
};

export type RestaurantMapInstance = {
  updateMarkers: (points: RestaurantMapPoint[], selectedId?: EntityId) => void;
  destroy: () => void;
};

export type LocationPickerOptions = {
  center: ChengduMapCenter;
  zoom?: number;
  coordinates?: Coordinates;
  onChange: (coordinates: Coordinates) => void;
};

export type LocationPickerInstance = {
  setPosition: (coordinates?: Coordinates) => void;
  destroy: () => void;
};

export type MapProvider = {
  createRestaurantMap: (
    container: HTMLElement,
    config: MapProviderConfig,
    options: RestaurantMapOptions,
  ) => Promise<RestaurantMapInstance>;
  createLocationPicker: (
    container: HTMLElement,
    config: MapProviderConfig,
    options: LocationPickerOptions,
  ) => Promise<LocationPickerInstance>;
};

export type LngLatTuple = [number, number];

export type AMapLngLat = {
  getLng: () => number;
  getLat: () => number;
};

export type AMapEvent = {
  lnglat?: AMapLngLat;
  target?: {
    getPosition?: () => AMapLngLat;
  };
};

export type AMapMap = {
  add: (overlay: unknown | unknown[]) => void;
  remove: (overlay: unknown | unknown[]) => void;
  setCenter: (position: LngLatTuple) => void;
  setFitView: (
    overlays?: unknown[],
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number,
  ) => void;
  addControl?: (control: unknown) => void;
  on: (eventName: string, handler: (event: AMapEvent) => void) => void;
  destroy: () => void;
};

export type AMapMarker = {
  on: (eventName: string, handler: (event: AMapEvent) => void) => void;
  setMap: (map: AMapMap | null) => void;
  setPosition: (position: LngLatTuple) => void;
  getPosition?: () => AMapLngLat;
};

export type AMapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Scale?: new () => unknown;
};
