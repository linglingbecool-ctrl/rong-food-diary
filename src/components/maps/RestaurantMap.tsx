import { AlertTriangle, KeyRound, Loader2, MapPinned } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CHENGDU_CENTER, getMapProvider } from "../../services/maps";
import type { RestaurantMapInstance, RestaurantMapPoint } from "../../services/maps";

export type MapRenderStatus = "idle" | "loading" | "ready" | "missing-key" | "error";

type RestaurantMapProps = {
  points: RestaurantMapPoint[];
  selectedId?: string;
  onSelect: (point: RestaurantMapPoint) => void;
  onStatusChange?: (status: MapRenderStatus) => void;
};

function StatusPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
}) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-cream/95 px-5 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-orange shadow-soft">
          <Icon size={22} aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
        <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
      </div>
    </div>
  );
}

export function RestaurantMap({ points, selectedId, onSelect, onStatusChange }: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<RestaurantMapInstance | null>(null);
  const onSelectRef = useRef(onSelect);
  const onStatusChangeRef = useRef(onStatusChange);
  const [status, setStatus] = useState<MapRenderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const provider = useMemo(() => getMapProvider(), []);
  const apiKey = import.meta.env.VITE_AMAP_KEY?.trim() ?? "";
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim() || undefined;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    function updateStatus(nextStatus: MapRenderStatus) {
      setStatus(nextStatus);
      onStatusChangeRef.current?.(nextStatus);
    }

    if (!apiKey) {
      updateStatus("missing-key");
      return;
    }

    if (!containerRef.current) {
      return;
    }

    let isCancelled = false;
    updateStatus("loading");
    setErrorMessage("");

    provider
      .createRestaurantMap(
        containerRef.current,
        { apiKey, securityCode },
        {
          center: CHENGDU_CENTER,
          zoom: 11,
          points,
          selectedId,
          onSelect: (point) => onSelectRef.current(point),
        },
      )
      .then((instance) => {
        if (isCancelled) {
          instance.destroy();
          return;
        }
        mapRef.current = instance;
        updateStatus("ready");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "地图加载失败。");
        updateStatus("error");
      });

    return () => {
      isCancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [apiKey, provider, securityCode]);

  useEffect(() => {
    if (status === "ready") {
      mapRef.current?.updateMarkers(points, selectedId);
    }
  }, [points, selectedId, status]);

  return (
    <section className="overflow-hidden rounded-card bg-white/80 shadow-soft">
      <div className="relative h-[360px] min-h-[360px] bg-cream">
        <div ref={containerRef} className="h-full w-full" aria-label="蓉食记餐厅地图" />

        {status === "loading" || status === "idle" ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-cream/85 text-center">
            <div>
              <Loader2 className="mx-auto animate-spin text-orange" size={28} aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-ink">正在加载地图</p>
            </div>
          </div>
        ) : null}

        {status === "missing-key" ? (
          <StatusPanel
            icon={KeyRound}
            title="未配置高德地图密钥"
            description="请在 .env.local 中设置 VITE_AMAP_KEY。页面不会崩溃，下方会显示餐厅列表。"
          />
        ) : null}

        {status === "error" ? (
          <StatusPanel
            icon={AlertTriangle}
            title="地图暂时无法加载"
            description={errorMessage || "请检查网络、Key 类型和安全密钥配置。下方会显示餐厅列表。"}
          />
        ) : null}

        {status === "ready" && points.length === 0 ? (
          <StatusPanel
            icon={MapPinned}
            title="当前没有可显示的坐标"
            description="筛选结果中没有保存经纬度的餐厅。可以在新增或编辑探店记录时选择地图位置。"
          />
        ) : null}
      </div>
    </section>
  );
}
