import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, FilterX, MapPinned, Search, Star, Tags, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { RestaurantMap } from "../components/maps/RestaurantMap";
import type { MapRenderStatus } from "../components/maps/RestaurantMap";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import { ensureSeedData, getExplorerData } from "../db/repositories";
import type { ExplorerData, RestaurantListItem } from "../types/models";
import type { RestaurantMapPoint } from "../services/maps";

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: ExplorerData }
  | { status: "error"; message: string };

type FilterState = {
  query: string;
  district: string;
  category: string;
  tag: string;
};

const emptyFilters: FilterState = {
  query: "",
  district: "",
  category: "",
  tag: "",
};

const inputClassName =
  "min-h-11 w-full rounded-2xl border border-line bg-white/85 px-3 text-sm text-ink outline-none focus:border-orange";

function formatVisitDate(value: string | undefined) {
  if (!value) {
    return "未探店";
  }
  return format(parseISO(value), "yyyy年M月d日", { locale: zhCN });
}

function formatMoney(value: number | undefined) {
  return value === undefined ? "-" : `¥${value}`;
}

function formatRating(value: number | undefined) {
  return value === undefined ? "-" : value.toFixed(1);
}

function restaurantSearchText(item: RestaurantListItem) {
  return [
    item.restaurant.name,
    item.restaurant.branchName,
    item.restaurant.category,
    item.restaurant.district,
    item.restaurant.businessArea,
    item.restaurant.address,
    item.restaurant.source,
    ...item.tags,
    ...item.visits.flatMap((visit) => [
      visit.visit.summary,
      visit.visit.notes,
      ...visit.visit.tags,
      ...visit.dishes.map((dish) => dish.name),
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

function filterRestaurants(items: RestaurantListItem[], filters: FilterState) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const tagPool = new Set(item.tags);
    return (
      (!query || restaurantSearchText(item).includes(query)) &&
      (!filters.district || item.restaurant.district === filters.district) &&
      (!filters.category || item.restaurant.category === filters.category) &&
      (!filters.tag || tagPool.has(filters.tag))
    );
  });
}

function hasCoordinates(item: RestaurantListItem) {
  return (
    typeof item.restaurant.latitude === "number" &&
    Number.isFinite(item.restaurant.latitude) &&
    typeof item.restaurant.longitude === "number" &&
    Number.isFinite(item.restaurant.longitude)
  );
}

function toMapPoint(item: RestaurantListItem): RestaurantMapPoint {
  return {
    id: item.restaurant.id,
    name: item.restaurant.name,
    category: item.restaurant.category,
    district: item.restaurant.district,
    coordinates: {
      latitude: item.restaurant.latitude ?? 0,
      longitude: item.restaurant.longitude ?? 0,
    },
    averageRating: item.averageRating,
    averageCost: item.averageCost,
    recentVisitDate: item.recentVisitDate,
  };
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function SelectedRestaurantCard({ point }: { point: RestaurantMapPoint }) {
  return (
    <Link
      to={`/restaurants/${point.id}`}
      className="block rounded-card bg-white/85 p-4 shadow-soft transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-orange">{point.category}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{point.name}</h2>
          <p className="mt-1 text-xs text-muted">{point.district ?? "未填写区域"}</p>
        </div>
        <span className="rounded-pill bg-ink px-3 py-1 text-sm font-semibold text-white">
          详情
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-cream/80 p-3">
          <Star size={15} className="mx-auto text-orange" aria-hidden="true" />
          <p className="mt-1 text-sm font-semibold text-ink">{formatRating(point.averageRating)}</p>
          <p className="text-xs text-muted">评分</p>
        </div>
        <div className="rounded-2xl bg-cream/80 p-3">
          <Wallet size={15} className="mx-auto text-orange" aria-hidden="true" />
          <p className="mt-1 text-sm font-semibold text-ink">{formatMoney(point.averageCost)}</p>
          <p className="text-xs text-muted">人均</p>
        </div>
        <div className="rounded-2xl bg-cream/80 p-3">
          <CalendarDays size={15} className="mx-auto text-orange" aria-hidden="true" />
          <p className="mt-1 text-sm font-semibold text-ink">
            {formatVisitDate(point.recentVisitDate).replace(/^2026年/, "")}
          </p>
          <p className="text-xs text-muted">最近</p>
        </div>
      </div>
    </Link>
  );
}

function RestaurantFallbackList({ items }: { items: RestaurantListItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="没有匹配餐厅"
        description="当前筛选条件下没有餐厅记录。"
      />
    );
  }

  return (
    <section className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.restaurant.id}
          to={`/restaurants/${item.restaurant.id}`}
          className="block rounded-[20px] bg-white/82 p-4 shadow-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-orange">{item.restaurant.category}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{item.restaurant.name}</h3>
              <p className="mt-1 text-xs text-muted">
                {[item.restaurant.district, item.restaurant.businessArea].filter(Boolean).join(" · ") ||
                  "未填写区域"}
              </p>
            </div>
            <span className="rounded-pill bg-cream px-3 py-1 text-xs font-semibold text-muted">
              {hasCoordinates(item) ? "有坐标" : "无坐标"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
            <span className="rounded-pill bg-cream px-3 py-1">评分 {formatRating(item.averageRating)}</span>
            <span className="rounded-pill bg-cream px-3 py-1">人均 {formatMoney(item.averageCost)}</span>
            <span className="rounded-pill bg-cream px-3 py-1">{formatVisitDate(item.recentVisitDate)}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}

export function MapPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mapStatus, setMapStatus] = useState<MapRenderStatus>("idle");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        await ensureSeedData();
        const data = await getExplorerData();
        if (isMounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "地图数据读取失败";
        if (isMounted) {
          setState({ status: "error", message });
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRestaurants = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    return filterRestaurants(state.data.restaurants, filters);
  }, [filters, state]);

  const mapPoints = useMemo(
    () => filteredRestaurants.filter(hasCoordinates).map(toMapPoint),
    [filteredRestaurants],
  );

  const selectedPoint = useMemo(
    () => mapPoints.find((point) => point.id === selectedId),
    [mapPoints, selectedId],
  );

  useEffect(() => {
    if (selectedId && !selectedPoint) {
      setSelectedId(undefined);
    }
  }, [selectedId, selectedPoint]);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId(undefined);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSelectedId(undefined);
  }

  const shouldShowFallbackList = mapStatus === "missing-key" || mapStatus === "error";
  const totalCoordinateCount =
    state.status === "ready" ? state.data.restaurants.filter(hasCoordinates).length : 0;

  return (
    <div>
      <PageHeader
        eyebrow="MAP"
        title="探店地图"
        description="地图标记从 IndexedDB 中已有经纬度的餐厅实时生成。"
      />

      {state.status === "loading" ? <LoadingState label="正在读取地图数据" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}

      {state.status === "ready" ? (
        <div className="space-y-5">
          <section className="rounded-card bg-white/80 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange">FILTER</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">地图筛选</h2>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-10 items-center gap-1 rounded-pill bg-cream px-3 text-xs font-semibold text-muted"
              >
                <FilterX size={15} aria-hidden="true" />
                清空
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <FilterField label="关键词">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    value={filters.query}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    className={`${inputClassName} pl-9`}
                    placeholder="餐厅、地址、标签、评价"
                  />
                </div>
              </FilterField>

              <div className="grid grid-cols-2 gap-3">
                <FilterField label="行政区">
                  <select
                    value={filters.district}
                    onChange={(event) => updateFilter("district", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">全部区域</option>
                    {state.data.filters.districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="餐饮类型">
                  <select
                    value={filters.category}
                    onChange={(event) => updateFilter("category", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">全部类型</option>
                    {state.data.filters.categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>

              <FilterField label="标签">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => updateFilter("tag", "")}
                    className={`shrink-0 rounded-pill px-3 py-2 text-xs font-semibold ${
                      filters.tag === "" ? "bg-ink text-white" : "bg-cream text-muted"
                    }`}
                  >
                    全部
                  </button>
                  {state.data.filters.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => updateFilter("tag", tag)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-2 text-xs font-semibold ${
                        filters.tag === tag ? "bg-ink text-white" : "bg-cream text-muted"
                      }`}
                    >
                      <Tags size={13} aria-hidden="true" />
                      {tag}
                    </button>
                  ))}
                </div>
              </FilterField>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <MapPinned size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-lg font-semibold text-ink">{totalCoordinateCount}</p>
              <p className="text-xs text-muted">有坐标</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <Search size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-lg font-semibold text-ink">{filteredRestaurants.length}</p>
              <p className="text-xs text-muted">筛选餐厅</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <MapPinned size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-lg font-semibold text-ink">{mapPoints.length}</p>
              <p className="text-xs text-muted">地图标记</p>
            </div>
          </section>

          <RestaurantMap
            points={mapPoints}
            selectedId={selectedId}
            onSelect={(point) => setSelectedId(point.id)}
            onStatusChange={setMapStatus}
          />

          {selectedPoint ? (
            <SelectedRestaurantCard point={selectedPoint} />
          ) : mapPoints.length > 0 && mapStatus === "ready" ? (
            <p className="rounded-[18px] bg-white/72 px-4 py-3 text-sm leading-6 text-muted shadow-soft">
              点击地图标记查看餐厅评分、人均消费和最近探店时间。
            </p>
          ) : null}

          {shouldShowFallbackList ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">餐厅列表</h2>
                <Link to="/visits/new" className={primaryButtonClassName}>
                  新增探店
                </Link>
              </div>
              <RestaurantFallbackList items={filteredRestaurants} />
            </section>
          ) : null}

          {state.data.restaurants.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              title="还没有餐厅记录"
              description="新增第一条探店后，保存了经纬度的餐厅会出现在地图上。"
              action={
                <Link to="/visits/new" className={primaryButtonClassName}>
                  记录第一顿
                </Link>
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
