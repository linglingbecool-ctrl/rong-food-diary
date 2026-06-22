import { loadAmapJsApi } from "./amapLoader";
import type {
  AMapMap,
  AMapMarker,
  AMapNamespace,
  ChengduMapCenter,
  Coordinates,
  LocationPickerInstance,
  LocationPickerOptions,
  MapProvider,
  MapProviderConfig,
  RestaurantMapInstance,
  RestaurantMapOptions,
  RestaurantMapPoint,
} from "./types";

function toLngLat(coordinates: Coordinates): [number, number] {
  return [coordinates.longitude, coordinates.latitude];
}

function centerToLngLat(center: ChengduMapCenter): [number, number] {
  return [center.longitude, center.latitude];
}

function eventToCoordinates(eventPosition: { getLng: () => number; getLat: () => number }): Coordinates {
  return {
    longitude: Number(eventPosition.getLng().toFixed(6)),
    latitude: Number(eventPosition.getLat().toFixed(6)),
  };
}

function markerContent(isSelected: boolean) {
  return `<span class="amap-restaurant-marker${isSelected ? " amap-restaurant-marker--selected" : ""}"></span>`;
}

function createMarker(
  AMap: AMapNamespace,
  map: AMapMap,
  point: RestaurantMapPoint,
  isSelected: boolean,
  onSelect: (point: RestaurantMapPoint) => void,
) {
  const marker = new AMap.Marker({
    position: toLngLat(point.coordinates),
    title: point.name,
    anchor: "bottom-center",
    content: markerContent(isSelected),
  });
  marker.on("click", () => {
    onSelect(point);
    map.setCenter(toLngLat(point.coordinates));
  });
  marker.setMap(map);
  return marker;
}

function fitPoints(map: AMapMap, points: RestaurantMapPoint[], markers: AMapMarker[], center: ChengduMapCenter) {
  if (points.length === 0) {
    map.setCenter(centerToLngLat(center));
    return;
  }

  if (points.length === 1) {
    map.setCenter(toLngLat(points[0].coordinates));
    return;
  }

  map.setFitView(markers, false, [52, 36, 56, 36], 15);
}

export const amapProvider: MapProvider = {
  async createRestaurantMap(
    container: HTMLElement,
    config: MapProviderConfig,
    options: RestaurantMapOptions,
  ): Promise<RestaurantMapInstance> {
    const AMap = await loadAmapJsApi(config);
    const map = new AMap.Map(container, {
      center: centerToLngLat(options.center),
      zoom: options.zoom ?? 11,
      viewMode: "2D",
      resizeEnable: true,
    });

    if (AMap.Scale && map.addControl) {
      map.addControl(new AMap.Scale());
    }

    let markers: AMapMarker[] = [];

    function updateMarkers(points: RestaurantMapPoint[], selectedId?: string) {
      if (markers.length > 0) {
        markers.forEach((marker) => marker.setMap(null));
        markers = [];
      }

      markers = points.map((point) =>
        createMarker(AMap, map, point, point.id === selectedId, options.onSelect),
      );
      fitPoints(map, points, markers, options.center);
    }

    updateMarkers(options.points, options.selectedId);

    return {
      updateMarkers,
      destroy() {
        markers.forEach((marker) => marker.setMap(null));
        markers = [];
        map.destroy();
      },
    };
  },

  async createLocationPicker(
    container: HTMLElement,
    config: MapProviderConfig,
    options: LocationPickerOptions,
  ): Promise<LocationPickerInstance> {
    const AMap = await loadAmapJsApi(config);
    const map = new AMap.Map(container, {
      center: options.coordinates ? toLngLat(options.coordinates) : centerToLngLat(options.center),
      zoom: options.zoom ?? 13,
      viewMode: "2D",
      resizeEnable: true,
    });

    let marker: AMapMarker | null = null;

    function ensureMarker(coordinates: Coordinates) {
      const position = toLngLat(coordinates);
      if (marker) {
        marker.setPosition(position);
      } else {
        marker = new AMap.Marker({
          position,
          anchor: "bottom-center",
          draggable: true,
          cursor: "move",
          content: '<span class="amap-picker-marker"></span>',
        });
        marker.on("dragend", (event) => {
          const positionFromEvent = event.lnglat ?? event.target?.getPosition?.() ?? marker?.getPosition?.();
          if (positionFromEvent) {
            options.onChange(eventToCoordinates(positionFromEvent));
          }
        });
        marker.setMap(map);
      }
      map.setCenter(position);
    }

    function setPosition(coordinates?: Coordinates) {
      if (!coordinates) {
        if (marker) {
          marker.setMap(null);
          marker = null;
        }
        return;
      }
      ensureMarker(coordinates);
    }

    map.on("click", (event) => {
      if (!event.lnglat) {
        return;
      }
      const coordinates = eventToCoordinates(event.lnglat);
      ensureMarker(coordinates);
      options.onChange(coordinates);
    });

    setPosition(options.coordinates);

    return {
      setPosition,
      destroy() {
        marker?.setMap(null);
        marker = null;
        map.destroy();
      },
    };
  },
};
