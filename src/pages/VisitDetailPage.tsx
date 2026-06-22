import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, Edit3, MapPinned, Store, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import { PhotoGallery } from "../components/photos/PhotoThumbnail";
import { deleteVisit, getVisitDetail } from "../db/repositories";
import type { VisitDetailData } from "../types/models";

type PageState =
  | { status: "loading" }
  | { status: "ready"; detail: VisitDetailData }
  | { status: "notFound" }
  | { status: "error"; message: string };

function metaValue(value: string | number | undefined) {
  if (value === undefined || value === "") {
    return "未填写";
  }
  return value;
}

function RatingPill({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-[18px] bg-white/78 p-3 shadow-soft">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value === undefined ? "-" : value.toFixed(1)}</p>
    </div>
  );
}

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!id) {
        setState({ status: "notFound" });
        return;
      }

      try {
        const detail = await getVisitDetail(id);
        if (!isMounted) {
          return;
        }
        setState(detail ? { status: "ready", detail } : { status: "notFound" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "探店详情读取失败";
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

  async function handleDeleteConfirmed() {
    if (!id || state.status !== "ready") {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteVisit(id);
      navigate("/home", { replace: true });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <Link to="/home" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted">
        <ArrowLeft size={16} aria-hidden="true" />
        回到首页
      </Link>
      {state.status === "loading" ? <LoadingState label="正在读取探店详情" /> : null}
      {state.status === "notFound" ? <ErrorState title="没有找到记录" message="这条探店记录可能已经被删除。" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <article className="space-y-5">
          <PageHeader
            eyebrow={state.detail.restaurant.category}
            title={state.detail.restaurant.name}
            description={`${state.detail.restaurant.branchName ?? "无分店名"} · ${format(parseISO(state.detail.visit.visitDate), "yyyy年M月d日 EEEE", { locale: zhCN })}`}
          />

          <section className="overflow-hidden rounded-card bg-white/82 shadow-soft">
            <div className="bg-gradient-to-br from-orange/25 via-white to-blue/30 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-muted">一句话评价</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-9 text-ink">
                    {state.detail.visit.summary || "这次还没有写一句话评价。"}
                  </h2>
                </div>
                <span className="rounded-pill bg-ink px-4 py-2 text-lg font-semibold text-white">
                  {state.detail.visit.overallRating.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div>
                <p className="text-muted">人均消费</p>
                <p className="mt-1 font-semibold text-ink">¥{metaValue(state.detail.visit.averageCost)}</p>
              </div>
              <div>
                <p className="text-muted">总消费</p>
                <p className="mt-1 font-semibold text-ink">¥{metaValue(state.detail.visit.totalCost)}</p>
              </div>
              <div>
                <p className="text-muted">用餐人数</p>
                <p className="mt-1 font-semibold text-ink">{state.detail.visit.peopleCount} 人</p>
              </div>
              <div>
                <p className="text-muted">复访意愿</p>
                <p className="mt-1 font-semibold text-ink">{state.detail.visit.revisitStatus}</p>
              </div>
            </div>
          </section>

          <PhotoGallery photoIds={state.detail.visit.photoIds} altPrefix={state.detail.restaurant.name} />

          <section className="grid grid-cols-2 gap-3">
            <RatingPill label="口味" value={state.detail.visit.tasteRating} />
            <RatingPill label="环境" value={state.detail.visit.environmentRating} />
            <RatingPill label="服务" value={state.detail.visit.serviceRating} />
            <RatingPill label="性价比" value={state.detail.visit.valueRating} />
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Store size={20} aria-hidden="true" />
              餐厅信息
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">地址</dt>
                <dd className="mt-1 font-medium text-ink">{metaValue(state.detail.restaurant.address)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted">行政区</dt>
                  <dd className="mt-1 font-medium text-ink">{metaValue(state.detail.restaurant.district)}</dd>
                </div>
                <div>
                  <dt className="text-muted">商圈</dt>
                  <dd className="mt-1 font-medium text-ink">{metaValue(state.detail.restaurant.businessArea)}</dd>
                </div>
              </div>
            </dl>
            <Link
              to={`/restaurants/${state.detail.restaurant.id}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange"
            >
              <MapPinned size={16} aria-hidden="true" />
              查看餐厅详情
            </Link>
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">菜品</h2>
            {state.detail.dishes.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted">这次没有单独记录菜品。</p>
            ) : (
              <div className="mt-4 space-y-3">
                {state.detail.dishes.map((dish) => (
                  <div key={dish.id} className="rounded-[18px] bg-cream/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{dish.name}</h3>
                        <p className="mt-1 text-xs text-muted">
                          {dish.category ?? "未分类"} · {dish.recommendationStatus}
                        </p>
                      </div>
                      <span className="rounded-pill bg-white px-3 py-1 text-sm font-semibold text-orange">
                        {dish.rating === undefined ? "-" : dish.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">价格：{dish.price === undefined ? "未填写" : `¥${dish.price}`}</p>
                    {dish.notes ? <p className="mt-3 text-sm leading-6 text-ink">{dish.notes}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-card bg-white/78 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">详细笔记</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
              {state.detail.visit.notes || "没有填写详细笔记。"}
            </p>
            {state.detail.visit.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {state.detail.visit.tags.map((tag) => (
                  <span key={tag} className="rounded-pill bg-orange/12 px-3 py-1 text-xs font-semibold text-orange">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <footer className="flex gap-3">
            <Link to={`/visits/${state.detail.visit.id}/edit`} className={`${primaryButtonClassName} flex-1 gap-2`}>
              <Edit3 size={18} aria-hidden="true" />
              编辑
            </Link>
            <button
              type="button"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-pill border border-orange/30 bg-white/80 px-5 text-sm font-semibold text-orange shadow-soft"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
              删除
            </button>
          </footer>

          {isDeleteOpen ? (
            <div className="fixed inset-0 z-30 grid place-items-center bg-ink/35 px-5">
              <section className="w-full max-w-[360px] rounded-card bg-cream p-5 shadow-lift" role="dialog" aria-modal="true" aria-labelledby="delete-visit-title">
                <h2 id="delete-visit-title" className="text-lg font-semibold text-ink">
                  删除这次探店？
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  删除后会移除本次探店记录和对应菜品记录，操作不可恢复。
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="min-h-12 flex-1 rounded-pill border border-line bg-white px-5 text-sm font-semibold text-ink"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isDeleting}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="min-h-12 flex-1 rounded-pill bg-orange px-5 text-sm font-semibold text-white"
                    onClick={handleDeleteConfirmed}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "正在删除" : "确认删除"}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
