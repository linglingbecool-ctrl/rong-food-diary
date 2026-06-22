import { AlertTriangle, KeyRound, Loader2, MapPinned } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CHENGDU_CENTER, getMapProvider } from "../../services/maps";
import type { LocationPickerInstance } from "../../services/maps";
import type { Coordinates } from "../../types/models";

type PickerStatus = "idle" | "loading" | "ready" | "missing-key" | "error";

type LocationPickerProps = {
  coordinates?: Coordinates;
  onChange: (coordinates: Coordinates) => void;
};

function PickerFallback({
  status,
  errorMessage,
}: {
  status: PickerStatus;
  errorMessage: string;
}) {
  const isMissingKey = status === "missing-key";
  const Icon = isMissingKey ? KeyRound : AlertTriangle;
  return (
    <div className="rounded-[20px] border border-dashed border-line bg-cream/80 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-orange shadow-soft">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {isMissingKey ? "未配置地图密钥" : "地图选择器不可用"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {isMissingKey
              ? "设置 VITE_AMAP_KEY 后可在地图上点选位置；当前仍可手动填写经纬度。"
              : errorMessage || "当前仍可手动填写经纬度。"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LocationPicker({ coordinates, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<LocationPickerInstance | null>(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const provider = useMemo(() => getMapProvider(), []);
  const apiKey = import.meta.env.VITE_AMAP_KEY?.trim() ?? "";
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim() || undefined;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey) {
      setStatus("missing-key");
      return;
    }

    if (!containerRef.current) {
      return;
    }

    let isCancelled = false;
    setStatus("loading");
    setErrorMessage("");

    provider
      .createLocationPicker(
        containerRef.current,
        { apiKey, securityCode },
        {
          center: CHENGDU_CENTER,
          zoom: coordinates ? 15 : 12,
          coordinates,
          onChange: (nextCoordinates) => onChangeRef.current(nextCoordinates),
        },
      )
      .then((instance) => {
        if (isCancelled) {
          instance.destroy();
          return;
        }
        pickerRef.current = instance;
        setStatus("ready");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "地图选择器加载失败。");
        setStatus("error");
      });

    return () => {
      isCancelled = true;
      pickerRef.current?.destroy();
      pickerRef.current = null;
    };
  }, [apiKey, provider, securityCode]);

  useEffect(() => {
    if (status === "ready") {
      pickerRef.current?.setPosition(coordinates);
    }
  }, [coordinates, status]);

  if (status === "missing-key" || status === "error") {
    return <PickerFallback status={status} errorMessage={errorMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="relative h-56 min-h-56 bg-cream">
        <div ref={containerRef} className="h-full w-full" aria-label="选择餐厅位置" />
        {status === "loading" || status === "idle" ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-cream/85 text-center">
            <div>
              <Loader2 className="mx-auto animate-spin text-orange" size={24} aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-ink">正在加载位置选择器</p>
            </div>
          </div>
        ) : null}
        {status === "ready" && !coordinates ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-[16px] bg-white/90 px-3 py-2 text-xs font-semibold text-ink shadow-soft">
            <span className="inline-flex items-center gap-2">
              <MapPinned size={14} aria-hidden="true" />
              点击地图选择餐厅位置
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
