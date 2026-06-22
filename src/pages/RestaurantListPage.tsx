import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarDays,
  Dice5,
  FilterX,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Tags,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import { PhotoThumbnail } from "../components/photos/PhotoThumbnail";
import { ensureSeedData, getExplorerData } from "../db/repositories";
import type { ExplorerData, RecentVisitItem, RestaurantListItem } from "../types/models";

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: ExplorerData }
  | { status: "error"; message: string };

type ViewMode = "restaurants" | "visits";
type SortMode = "recent-desc" | "recent-asc" | "rating-desc" | "rating-asc" | "cost-desc" | "cost-asc";

type FilterState = {
  query: string;
  district: string;
  category: string;
  tag: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  sort: SortMode;
};

const emptyFilters: FilterState = {
  query: "",
  district: "",
  category: "",
  tag: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  sort: "recent-desc",
};

function numberFromInput(value: string) {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? undefined : parsed;
}

function textIncludes(value: string | undefined, query: string) {
  return (value ?? "").toLowerCase().includes(query);
}

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

function compareOptionalNumber(left: number | undefined, right: number | undefined, direction: "asc" | "desc") {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return direction === "asc" ? left - right : right - left;
}

function matchesNumberRange(value: number | undefined, minText: string, maxText: string) {
  const min = numberFromInput(minText);
  const max = numberFromInput(maxText);
  if (min === undefined && max === undefined) {
    return true;
  }
  if (value === undefined) {
    return false;
  }
  return (min === undefined || value >= min) && (max === undefined || value <= max);
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
  ].join(" ").toLowerCase();
}

function visitSearchText(item: RecentVisitItem) {
  return [
    item.restaurant.name,
    item.restaurant.branchName,
    item.restaurant.category,
    item.restaurant.district,
    item.restaurant.businessArea,
    item.visit.summary,
    item.visit.notes,
    item.visit.revisitStatus,
    ...item.restaurant.tags,
    ...item.visit.tags,
    ...item.dishes.map((dish) => dish.name),
  ].join(" ").toLowerCase();
}

function filterRestaurants(items: RestaurantListItem[], filters: FilterState) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const tagPool = new Set(item.tags);
    return (
      (!query || restaurantSearchText(item).includes(query)) &&
      (!filters.district || item.restaurant.district === filters.district) &&
      (!filters.category || item.restaurant.category === filters.category) &&
      (!filters.tag || tagPool.has(filters.tag)) &&
      matchesNumberRange(item.averageCost, filters.minPrice, filters.maxPrice) &&
      matchesNumberRange(item.averageRating, filters.minRating, "")
    );
  });
}

function filterVisits(items: RecentVisitItem[], filters: FilterState) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const tagPool = new Set([...item.restaurant.tags, ...item.visit.tags]);
    return (
      (!query || visitSearchText(item).includes(query)) &&
      (!filters.district || item.restaurant.district === filters.district) &&
      (!filters.category || item.restaurant.category === filters.category) &&
      (!filters.tag || tagPool.has(filters.tag)) &&
      matchesNumberRange(item.visit.averageCost, filters.minPrice, filters.maxPrice) &&
      matchesNumberRange(item.visit.overallRating, filters.minRating, "")
    );
  });
}

function sortRestaurants(items: RestaurantListItem[], sort: SortMode) {
  return [...items].sort((left, right) => {
    if (sort === "recent-desc") {
      return (right.recentVisitDate ?? "").localeCompare(left.recentVisitDate ?? "") || right.visitsCount - left.visitsCount;
    }
    if (sort === "recent-asc") {
      return (left.recentVisitDate ?? "9999").localeCompare(right.recentVisitDate ?? "9999");
    }
    if (sort === "rating-desc") {
      return compareOptionalNumber(left.averageRating, right.averageRating, "desc");
    }
    if (sort === "rating-asc") {
      return compareOptionalNumber(left.averageRating, right.averageRating, "asc");
    }
    if (sort === "cost-desc") {
      return compareOptionalNumber(left.averageCost, right.averageCost, "desc");
    }
    return compareOptionalNumber(left.averageCost, right.averageCost, "asc");
  });
}

function sortVisits(items: RecentVisitItem[], sort: SortMode) {
  return [...items].sort((left, right) => {
    if (sort === "recent-desc") {
      return right.visit.visitDate.localeCompare(left.visit.visitDate) || right.visit.createdAt.localeCompare(left.visit.createdAt);
    }
    if (sort === "recent-asc") {
      return left.visit.visitDate.localeCompare(right.visit.visitDate) || left.visit.createdAt.localeCompare(right.visit.createdAt);
    }
    if (sort === "rating-desc") {
      return compareOptionalNumber(left.visit.overallRating, right.visit.overallRating, "desc");
    }
    if (sort === "rating-asc") {
      return compareOptionalNumber(left.visit.overallRating, right.visit.overallRating, "asc");
    }
    if (sort === "cost-desc") {
      return compareOptionalNumber(left.visit.averageCost, right.visit.averageCost, "desc");
    }
    return compareOptionalNumber(left.visit.averageCost, right.visit.averageCost, "asc");
  });
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "min-h-11 w-full rounded-2xl border border-line bg-white/85 px-3 text-sm text-ink outline-none focus:border-orange";

function RestaurantCard({ item }: { item: RestaurantListItem }) {
  const photoId = item.visits.find((visit) => visit.visit.photoIds.length > 0)?.visit.photoIds[0];

  return (
    <Link to={`/restaurants/${item.restaurant.id}`} className="block overflow-hidden rounded-card bg-white/82 shadow-soft transition hover:-translate-y-0.5">
      <PhotoThumbnail photoId={photoId} alt={`${item.restaurant.name} 缩略图`} className="h-32 w-full" />
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-orange">{item.restaurant.category}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{item.restaurant.name}</h2>
          <p className="mt-1 text-xs text-muted">
            {[item.restaurant.branchName, item.restaurant.district, item.restaurant.businessArea].filter(Boolean).join(" · ") || "未填写区域"}
          </p>
        </div>
        <span className="rounded-pill bg-cream px-3 py-1 text-sm font-semibold text-ink">{item.visitsCount} 次</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-cream/80 p-3">
          <p className="text-sm font-semibold text-ink">{formatRating(item.averageRating)}</p>
          <p className="text-xs text-muted">均分</p>
        </div>
        <div className="rounded-2xl bg-cream/80 p-3">
          <p className="text-sm font-semibold text-ink">{formatMoney(item.averageCost)}</p>
          <p className="text-xs text-muted">人均</p>
        </div>
        <div className="rounded-2xl bg-cream/80 p-3">
          <p className="text-sm font-semibold text-ink">{formatVisitDate(item.recentVisitDate).replace(/^2026年/, "")}</p>
          <p className="text-xs text-muted">最近</p>
        </div>
      </div>
      {item.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-pill bg-orange/12 px-3 py-1 text-xs font-semibold text-orange">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      </div>
    </Link>
  );
}

function VisitCard({ item }: { item: RecentVisitItem }) {
  return (
    <Link to={`/visits/${item.visit.id}`} className="block overflow-hidden rounded-card bg-white/82 shadow-soft transition hover:-translate-y-0.5">
      <PhotoThumbnail photoId={item.visit.photoIds[0]} alt={`${item.restaurant.name} 缩略图`} className="h-32 w-full" />
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-orange">{formatVisitDate(item.visit.visitDate)}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{item.restaurant.name}</h2>
          <p className="mt-1 text-xs text-muted">
            {[item.restaurant.category, item.restaurant.district, item.visit.mealPeriod].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="rounded-pill bg-ink px-3 py-1 text-sm font-semibold text-white">{item.visit.overallRating.toFixed(1)}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink">{item.visit.summary || "没有填写一句话评价。"}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted">
        <span className="rounded-pill bg-cream px-3 py-1">人均 {formatMoney(item.visit.averageCost)}</span>
        <span className="rounded-pill bg-cream px-3 py-1">{item.visit.revisitStatus}</span>
        {item.visit.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-pill bg-orange/12 px-3 py-1 text-orange">{tag}</span>
        ))}
      </div>
      </div>
    </Link>
  );
}

export function RestaurantListPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [viewMode, setViewMode] = useState<ViewMode>("restaurants");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [randomPick, setRandomPick] = useState<{ label: string; href: string } | null>(null);

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
        const message = error instanceof Error ? error.message : "餐厅和探店记录读取失败";
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

  const filtered = useMemo(() => {
    if (state.status !== "ready") {
      return { restaurants: [], visits: [] };
    }
    return {
      restaurants: sortRestaurants(filterRestaurants(state.data.restaurants, filters), filters.sort),
      visits: sortVisits(filterVisits(state.data.visits, filters), filters.sort),
    };
  }, [filters, state]);

  const activeCount = viewMode === "restaurants" ? filtered.restaurants.length : filtered.visits.length;
  const totalCount = state.status === "ready"
    ? viewMode === "restaurants"
      ? state.data.restaurants.length
      : state.data.visits.length
    : 0;

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setRandomPick(null);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setRandomPick(null);
  }

  function handleRandomPick() {
    if (viewMode === "restaurants") {
      const item = filtered.restaurants[Math.floor(Math.random() * filtered.restaurants.length)];
      setRandomPick(item ? { label: item.restaurant.name, href: `/restaurants/${item.restaurant.id}` } : null);
      return;
    }
    const item = filtered.visits[Math.floor(Math.random() * filtered.visits.length)];
    setRandomPick(item ? { label: item.restaurant.name, href: `/visits/${item.visit.id}` } : null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="EXPLORE"
        title="餐厅与探店"
        description="从浏览器 IndexedDB 读取真实记录，按餐厅归类多次探店。"
      />

      {state.status === "loading" ? <LoadingState label="正在读取 IndexedDB" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}

      {state.status === "ready" ? (
        <div className="space-y-5">
          <section className="rounded-card bg-white/80 p-4 shadow-soft">
            <div className="grid grid-cols-2 gap-2 rounded-pill bg-cream p-1">
              <button
                type="button"
                onClick={() => setViewMode("restaurants")}
                className={`min-h-10 rounded-pill text-sm font-semibold ${viewMode === "restaurants" ? "bg-ink text-white" : "text-muted"}`}
              >
                餐厅列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode("visits")}
                className={`min-h-10 rounded-pill text-sm font-semibold ${viewMode === "visits" ? "bg-ink text-white" : "text-muted"}`}
              >
                探店记录
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-cream/85 p-3">
                <Store size={16} className="text-orange" aria-hidden="true" />
                <p className="mt-2 text-xl font-semibold text-ink">{state.data.restaurants.length}</p>
                <p className="text-xs text-muted">餐厅</p>
              </div>
              <div className="rounded-2xl bg-cream/85 p-3">
                <CalendarDays size={16} className="text-orange" aria-hidden="true" />
                <p className="mt-2 text-xl font-semibold text-ink">{state.data.visits.length}</p>
                <p className="text-xs text-muted">探店</p>
              </div>
              <div className="rounded-2xl bg-cream/85 p-3">
                <SlidersHorizontal size={16} className="text-orange" aria-hidden="true" />
                <p className="mt-2 text-xl font-semibold text-ink">{activeCount}</p>
                <p className="text-xs text-muted">当前</p>
              </div>
            </div>
          </section>

          <section className="rounded-card bg-white/80 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange">FILTER</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">搜索与筛选</h2>
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
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input
                    value={filters.query}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    className={`${inputClassName} pl-9`}
                    placeholder="餐厅、菜品、标签、评价"
                  />
                </div>
              </FilterField>

              <div className="grid grid-cols-2 gap-3">
                <FilterField label="行政区">
                  <select value={filters.district} onChange={(event) => updateFilter("district", event.target.value)} className={inputClassName}>
                    <option value="">全部区域</option>
                    {state.data.filters.districts.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </FilterField>
                <FilterField label="餐饮类型">
                  <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className={inputClassName}>
                    <option value="">全部类型</option>
                    {state.data.filters.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </FilterField>
                <FilterField label="最低人均">
                  <input inputMode="numeric" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} className={inputClassName} placeholder="¥" />
                </FilterField>
                <FilterField label="最高人均">
                  <input inputMode="numeric" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} className={inputClassName} placeholder="¥" />
                </FilterField>
                <FilterField label="最低评分">
                  <input inputMode="decimal" value={filters.minRating} onChange={(event) => updateFilter("minRating", event.target.value)} className={inputClassName} placeholder="0-5" />
                </FilterField>
                <FilterField label="排序">
                  <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as SortMode)} className={inputClassName}>
                    <option value="recent-desc">探店时间晚到早</option>
                    <option value="recent-asc">探店时间早到晚</option>
                    <option value="rating-desc">评分高到低</option>
                    <option value="rating-asc">评分低到高</option>
                    <option value="cost-desc">人均高到低</option>
                    <option value="cost-asc">人均低到高</option>
                  </select>
                </FilterField>
              </div>

              <FilterField label="标签">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => updateFilter("tag", "")}
                    className={`shrink-0 rounded-pill px-3 py-2 text-xs font-semibold ${filters.tag === "" ? "bg-ink text-white" : "bg-cream text-muted"}`}
                  >
                    全部
                  </button>
                  {state.data.filters.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => updateFilter("tag", tag)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-2 text-xs font-semibold ${filters.tag === tag ? "bg-ink text-white" : "bg-cream text-muted"}`}
                    >
                      <Tags size={13} aria-hidden="true" />
                      {tag}
                    </button>
                  ))}
                </div>
              </FilterField>
            </div>
          </section>

          <section className="rounded-card bg-white/80 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange">RANDOM</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">随机选店</h2>
              </div>
              <button
                type="button"
                onClick={handleRandomPick}
                disabled={activeCount === 0}
                className={`${primaryButtonClassName} min-h-10 px-4`}
              >
                <Dice5 size={17} aria-hidden="true" />
                抽一家
              </button>
            </div>
            {randomPick ? (
              <Link to={randomPick.href} className="mt-4 block rounded-2xl bg-cream p-4 text-sm font-semibold text-ink">
                今天可以去：{randomPick.label}
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted">随机范围跟随当前筛选结果。</p>
            )}
          </section>

          {totalCount === 0 ? (
            <EmptyState
              icon={Store}
              title="还没有餐厅或探店记录"
              description="先保存第一条探店，列表、筛选和统计会自动从 IndexedDB 更新。"
              action={<Link to="/visits/new" className={primaryButtonClassName}>记录第一顿</Link>}
            />
          ) : activeCount === 0 ? (
            <EmptyState
              icon={Search}
              title="没有匹配结果"
              description="当前筛选条件下没有记录。可以清空筛选重新查看。"
              action={<button type="button" onClick={clearFilters} className={primaryButtonClassName}>清空筛选</button>}
            />
          ) : viewMode === "restaurants" ? (
            <section className="space-y-3">
              {filtered.restaurants.length < 3 ? (
                <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm leading-6 text-muted">当前餐厅较少，筛选结果会比较集中；继续记录后分类和排序会更有参考价值。</p>
              ) : null}
              {filtered.restaurants.map((item) => <RestaurantCard key={item.restaurant.id} item={item} />)}
            </section>
          ) : (
            <section className="space-y-3">
              {filtered.visits.length < 3 ? (
                <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm leading-6 text-muted">当前探店记录较少，趋势和标签判断需要更多真实记录支撑。</p>
              ) : null}
              {filtered.visits.map((item) => <VisitCard key={item.visit.id} item={item} />)}
            </section>
          )}

          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <CalendarDays size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-ink">时间排序</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <Star size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-ink">评分排序</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center shadow-soft">
              <Wallet size={16} className="mx-auto text-orange" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-ink">人均排序</p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
