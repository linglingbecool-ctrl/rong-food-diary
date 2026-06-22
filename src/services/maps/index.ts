import { amapProvider } from "./amapProvider";
import type { MapProvider } from "./types";

export const CHENGDU_CENTER = {
  latitude: 30.5728,
  longitude: 104.0668,
};

export function getMapProvider(): MapProvider {
  return amapProvider;
}

export type {
  LocationPickerInstance,
  RestaurantMapInstance,
  RestaurantMapPoint,
} from "./types";
