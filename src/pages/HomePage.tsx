import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { BarChart3, CalendarDays, Dice5, Heart, MapPinned, Plus, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import { PhotoThumbnail } from "../components/photos/PhotoThumbnail";
import { ensureSeedData, getDashboardData } from "../db/repositories";
import type { DashboardData, RecentVisitItem } from "../types/models";

type HomeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

const quickLinks = [
  { label: "想吃清单", to: "/wishlist", icon: Heart },
  { label: "探店地图", to: "/map", icon: MapPinned },
  { label: "随机选一家", to: "/wishlist", icon: Dice5 },
  { label: "查看统计", to: "/stats", icon: BarChart3 },
];

function colorClass(colorToken: RecentVisitItem["restaurant"]["colorToken"]) {
  const classes = {
    orange: "from-orange/30 to-white",
    blue: "from-blue/45 to-white",
    pink: "from-pink/45 to-white",
  };
  return classes[colorToken];
}

function RecentVisitCard({ item }: { item: RecentVisitItem }) {
  const dateLabel = format(parseISO(item.visit.visitDate), "M月d日 EEE", { locale: zhCN });
  const branch = item.restaurant.branchName ? `· ${item.restaurant.branchName}` : "";

  return (
    <Link to={`/visits/${item.visit.id}`} className="block overflow-hidden rounded-card bg-white/82 shadow-soft transition hover:-translate-y-0.5">
      <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${colorClass(item.restaurant.colorToken)}`}>
        <PhotoThumbnail photoId={item.visit.photoIds[0]} alt={`${item.restaurant.name} 缩略图`} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/92 via-white/35 to-transparent" />
        <div className="relative flex h-full items-end justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-muted">{item.restaurant.category}</p>
            <h3 className="mt-1 text-xl font-semibold text-ink">
              {item.restaurant.name}
            </h3>
          </div>
          <span className="rounded-pill bg-white/80 px-3 py-1 text-sm font-semibold text-orange">
            {item.visit.overallRating.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{dateLabel}</span>
          <span>{item.restaurant.district}</span>
          <span>{branch}</span>
          {item.visit.averageCost ? <span>人均 ¥{item.visit.averageCost}</span> : null}
        </div>
        <p className="text-sm leading-6 text-ink">
          {item.visit.summary || "没有填写一句话评价。"}
        </p>
        {item.dishes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.dishes.slice(0, 3).map((dish) => (
              <span
                key={dish.id}
                className="rounded-pill bg-cream px-3 py-1 text-xs font-medium text-muted"
              >
                {dish.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function HomePage() {
  const [state, setState] = useState<HomeState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        await ensureSeedData();
        const data = await getDashboardData();
        if (isMounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "IndexedDB 数据读取失败";
          setState({ status: "error", message });
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const content = useMemo(() => {
    if (state.status === "loading") {
      return <LoadingState />;
    }

    if (state.status === "error") {
      return <ErrorState message={state.message} />;
    }

    const stats = [
      { label: "餐厅", value: state.data.restaurantsCount, icon: Store },
      { label: "探店", value: state.data.visitsCount, icon: CalendarDays },
      { label: "本月", value: state.data.thisMonthVisitsCount, icon: Plus },
      { label: "区域", value: state.data.litDistrictsCount, icon: MapPinned },
    ];

    return (
      <>
        <section className="grid grid-cols-4 gap-2">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-[18px] bg-white/80 p-3 shadow-soft">
                <Icon size={17} className="text-orange" aria-hidden="true" />
                <p className="mt-3 text-2xl font-semibold text-ink">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            );
          })}
        </section>

        <Link to="/visits/new" className={`${primaryButtonClassName} mt-5 w-full gap-2`}>
            <Plus size={18} aria-hidden="true" />
            记录这一顿
        </Link>

        <section className="mt-6 grid grid-cols-2 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-card bg-white/75 p-4 shadow-soft transition hover:-translate-y-0.5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-blue/18 text-ink">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-ink">{link.label}</span>
              </Link>
            );
          })}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-orange">RECENT</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">最近探店</h2>
            </div>
            <Link to="/restaurants" className="text-sm font-semibold text-muted">
              全部
            </Link>
          </div>
          {state.data.recentVisits.length === 0 ? (
            <EmptyState
              title="还没有探店记录"
              description="记录第一顿饭后，这里会显示最近探店。"
              action={
                <Link to="/visits/new" className={primaryButtonClassName}>
                  添加第一条
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {state.data.recentVisits.map((item) => (
                <RecentVisitCard key={item.visit.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </>
    );
  }, [state]);

  return (
    <div>
      <header className="mb-5 pt-1">
        <p className="text-sm font-semibold text-orange">蓉食记</p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">
          今天在成都吃什么？
        </h1>
      </header>
      {content}
    </div>
  );
}
