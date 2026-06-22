import { BarChart3, CalendarDays, MapPinned, PieChart as PieChartIcon, Star, Store, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import { ensureSeedData, getStatsData } from "../db/repositories";
import type { ChartDatum, MonthlyTrendDatum, StatsData } from "../types/models";

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: StatsData }
  | { status: "error"; message: string };

const chartColors = ["#e9783f", "#a8d8ea", "#f4b8c4", "#2c2a27", "#f2c66d", "#8ec5a6"];

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Store }) {
  return (
    <div className="rounded-2xl bg-white/78 p-4 shadow-soft">
      <Icon size={18} className="text-orange" aria-hidden="true" />
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ChartShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-white/82 p-4 shadow-soft">
      <div className="mb-4">
        <p className="text-xs font-semibold text-orange">CHART</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function NoChartData({ text }: { text: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl bg-cream/80 px-5 text-center text-sm leading-6 text-muted">
      {text}
    </div>
  );
}

function LegendList({ data }: { data: ChartDatum[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {data.map((item, index) => (
        <span key={item.name} className="rounded-pill bg-cream px-3 py-1 text-xs font-semibold text-muted">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
          {item.name} {item.value}
        </span>
      ))}
    </div>
  );
}

function MonthlyTrendChart({ data }: { data: MonthlyTrendDatum[] }) {
  if (data.length === 0) {
    return <NoChartData text="暂无月度趋势数据。" />;
  }

  const maxValue = Math.max(...data.map((item) => item.visits), 1);

  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <div className="flex h-52 items-end gap-3">
        {data.map((item) => {
          const height = Math.max(10, (item.visits / maxValue) * 100);
          return (
            <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold text-ink">{item.visits}</span>
              <div className="flex h-36 w-full items-end rounded-full bg-white/80 p-1">
                <div
                  className="w-full rounded-full bg-orange"
                  style={{ height: `${height}%` }}
                  aria-label={`${item.label} ${item.visits} 次探店`}
                />
              </div>
              <span className="w-full truncate text-center text-xs text-muted">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistributionChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <NoChartData text="暂无可计算的分布数据。" />;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <>
      <div className="space-y-3 rounded-2xl bg-cream/70 p-4">
        {data.map((item, index) => {
          const width = Math.max(8, (item.value / maxValue) * 100);
          return (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-ink">{item.name}</span>
                <span className="text-muted">{item.value}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, backgroundColor: chartColors[index % chartColors.length] }}
                  aria-label={`${item.name} ${item.value}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <LegendList data={data} />
    </>
  );
}

export function StatsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        await ensureSeedData();
        const data = await getStatsData();
        if (isMounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "统计数据读取失败";
        if (isMounted) {
          setState({ status: "error", message });
        }
      }
    }

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="STATS"
        title="探店统计"
        description="图表由 IndexedDB 中的真实探店记录实时计算。"
      />

      {state.status === "loading" ? <LoadingState label="正在计算统计数据" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}

      {state.status === "ready" ? (
        state.data.visitsCount === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="还没有统计数据"
            description="保存第一条探店记录后，趋势和分布图会自动生成。"
            action={<Link to="/visits/new" className={primaryButtonClassName}>记录第一顿</Link>}
          />
        ) : (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3">
              <StatCard icon={Store} label="餐厅" value={state.data.restaurantsCount} />
              <StatCard icon={CalendarDays} label="探店" value={state.data.visitsCount} />
              <StatCard icon={Star} label="平均评分" value={state.data.averageRating === undefined ? "-" : state.data.averageRating.toFixed(1)} />
              <StatCard icon={Wallet} label="平均人均" value={state.data.averageCost === undefined ? "-" : `¥${state.data.averageCost}`} />
            </section>

            {state.data.fewData ? (
              <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm leading-6 text-muted">
                当前探店记录少于 3 条，分布和趋势只能作为早期参考。
              </p>
            ) : null}

            <ChartShell title="月度探店趋势" subtitle="按探店日期聚合每月记录数。">
              <MonthlyTrendChart data={state.data.monthlyTrend} />
            </ChartShell>

            <ChartShell title="餐饮类型分布" subtitle="按探店记录关联的餐厅类型计算。">
              <DistributionChart data={state.data.categoryDistribution} />
            </ChartShell>

            <ChartShell title="行政区分布" subtitle="按探店记录关联的餐厅行政区计算。">
              <DistributionChart data={state.data.districtDistribution} />
            </ChartShell>

            <ChartShell title="复访意愿分布" subtitle="按每条探店记录的复访意愿计算。">
              <DistributionChart data={state.data.revisitDistribution} />
            </ChartShell>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/75 p-4 shadow-soft">
                <PieChartIcon size={18} className="text-orange" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-ink">真实分布</p>
                <p className="mt-1 text-xs leading-5 text-muted">不使用固定统计结果。</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4 shadow-soft">
                <MapPinned size={18} className="text-orange" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-ink">区域覆盖</p>
                <p className="mt-1 text-xs leading-5 text-muted">随记录变动实时更新。</p>
              </div>
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
