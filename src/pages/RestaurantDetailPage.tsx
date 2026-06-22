import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, CalendarDays, MapPinned, Star, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { getRestaurantDetail } from "../db/repositories";
import type { RestaurantDetailData } from "../types/models";

type PageState =
  | { status: "loading" }
  | { status: "ready"; detail: RestaurantDetailData }
  | { status: "notFound" }
  | { status: "error"; message: string };

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!id) {
        setState({ status: "notFound" });
        return;
      }
      try {
        const detail = await getRestaurantDetail(id);
        if (isMounted) {
          setState(detail ? { status: "ready", detail } : { status: "notFound" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "餐厅详情读取失败";
        if (isMounted) {
          setState({ status: "error", message });
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div>
      <Link to="/home" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted">
        <ArrowLeft size={16} aria-hidden="true" />
        回到首页
      </Link>
      {state.status === "loading" ? <LoadingState label="正在读取餐厅详情" /> : null}
      {state.status === "notFound" ? <ErrorState title="没有找到餐厅" message="这家餐厅可能已经被删除。" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <article className="space-y-5">
          <PageHeader
            eyebrow={state.detail.restaurant.category}
            title={state.detail.restaurant.name}
            description={`${state.detail.restaurant.branchName ?? "无分店名"} · ${state.detail.restaurant.district ?? "未填写区域"}`}
          />

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/78 p-4 shadow-soft">
              <Star size={18} className="text-orange" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-ink">
                {state.detail.averageRating === undefined ? "-" : state.detail.averageRating.toFixed(1)}
              </p>
              <p className="text-xs text-muted">平均评分</p>
            </div>
            <div className="rounded-[18px] bg-white/78 p-4 shadow-soft">
              <Wallet size={18} className="text-orange" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-ink">
                {state.detail.averageCost === undefined ? "-" : `¥${state.detail.averageCost}`}
              </p>
              <p className="text-xs text-muted">平均消费</p>
            </div>
            <div className="rounded-[18px] bg-white/78 p-4 shadow-soft">
              <CalendarDays size={18} className="text-orange" aria-hidden="true" />
              <p className="mt-3 text-2xl font-semibold text-ink">{state.detail.visits.length}</p>
              <p className="text-xs text-muted">累计探店</p>
            </div>
            <div className="rounded-[18px] bg-white/78 p-4 shadow-soft">
              <MapPinned size={18} className="text-orange" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold text-ink">
                {state.detail.recentVisitDate
                  ? format(parseISO(state.detail.recentVisitDate), "M月d日", { locale: zhCN })
                  : "-"}
              </p>
              <p className="text-xs text-muted">最近探店</p>
            </div>
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">位置</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {state.detail.restaurant.address || "没有填写地址。"}
            </p>
            <div className="mt-4 rounded-[20px] bg-[linear-gradient(135deg,rgba(168,216,234,.45),rgba(244,184,196,.32))] p-5">
              <p className="text-sm font-semibold text-ink">坐标信息</p>
              <p className="mt-2 text-xs leading-5 text-muted">
                {state.detail.restaurant.latitude && state.detail.restaurant.longitude
                  ? `坐标：${state.detail.restaurant.latitude}, ${state.detail.restaurant.longitude}`
                  : "暂未保存坐标。"}
              </p>
            </div>
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">常用标签</h2>
            {state.detail.commonTags.length === 0 ? (
              <p className="mt-3 text-sm text-muted">还没有形成常用标签。</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {state.detail.commonTags.map((tag) => (
                  <span key={tag} className="rounded-pill bg-orange/12 px-3 py-1 text-xs font-semibold text-orange">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">历史探店</h2>
            {state.detail.visits.length === 0 ? (
              <EmptyState title="还没有探店记录" description="保存第一条探店后会出现在这里。" />
            ) : (
              <div className="mt-4 space-y-3">
                {state.detail.visits.map((item) => (
                  <Link
                    key={item.visit.id}
                    to={`/visits/${item.visit.id}`}
                    className="block rounded-[18px] bg-cream/80 p-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {format(parseISO(item.visit.visitDate), "yyyy年M月d日", { locale: zhCN })}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {item.visit.summary || "没有填写一句话评价。"}
                        </p>
                      </div>
                      <span className="rounded-pill bg-white px-3 py-1 text-sm font-semibold text-orange">
                        {item.visit.overallRating.toFixed(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </article>
      ) : null}
    </div>
  );
}
