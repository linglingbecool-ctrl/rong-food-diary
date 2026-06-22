import type { AMapNamespace, MapProviderConfig } from "./types";

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
      serviceHost?: string;
    };
  }
}

let amapLoadPromise: Promise<AMapNamespace> | null = null;

function buildAmapScriptUrl(apiKey: string) {
  const params = new URLSearchParams({
    v: "2.0",
    key: apiKey,
  });
  return `https://webapi.amap.com/maps?${params.toString()}`;
}

export function loadAmapJsApi(config: MapProviderConfig): Promise<AMapNamespace> {
  const apiKey = config.apiKey.trim();

  if (!apiKey) {
    return Promise.reject(new Error("未配置 VITE_AMAP_KEY，地图功能暂不可用。"));
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("当前运行环境不支持浏览器地图。"));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (config.securityCode?.trim()) {
    window._AMapSecurityConfig = {
      ...window._AMapSecurityConfig,
      securityJsCode: config.securityCode.trim(),
    };
  }

  if (amapLoadPromise) {
    return amapLoadPromise;
  }

  amapLoadPromise = new Promise<AMapNamespace>((resolve, reject) => {
    const existingScript = document.getElementById("amap-jsapi-v2") as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");
    let timeoutId: number | undefined;

    function cleanup() {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    }

    function handleLoad() {
      cleanup();
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        amapLoadPromise = null;
        reject(new Error("高德地图脚本已加载，但 AMap 对象不可用。"));
      }
    }

    function handleError() {
      cleanup();
      amapLoadPromise = null;
      reject(new Error("高德地图脚本加载失败。"));
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    timeoutId = window.setTimeout(() => {
      cleanup();
      amapLoadPromise = null;
      reject(new Error("高德地图脚本加载超时。"));
    }, 12000);

    if (!existingScript) {
      script.id = "amap-jsapi-v2";
      script.async = true;
      script.src = buildAmapScriptUrl(apiKey);
      document.head.appendChild(script);
    }
  });

  return amapLoadPromise;
}
