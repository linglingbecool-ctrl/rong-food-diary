import { Dice5, Edit3, Heart, Plus, Save, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import {
  convertWishlistItemToVisit,
  deleteWishlistItem,
  ensureSeedData,
  getWishlistItems,
  upsertWishlistItem,
} from "../db/repositories";
import type {
  RestaurantCategory,
  RevisitStatus,
  WishlistConversionInput,
  WishlistInput,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from "../types/models";
import { restaurantCategories, todayInputValue } from "../utils/visitForm";

type PageState =
  | { status: "loading" }
  | { status: "ready"; items: WishlistItem[] }
  | { status: "error"; message: string };

type FormState = WishlistInput & { tagsText: string };

const priorities: WishlistPriority[] = ["高", "中", "低"];
const statuses: WishlistStatus[] = ["想吃", "已探店", "暂不考虑"];
const revisitStatuses: RevisitStatus[] = ["愿意复访", "看情况", "不再复访"];

const emptyForm: FormState = {
  restaurantName: "",
  branchName: "",
  category: "",
  address: "",
  district: "",
  businessArea: "",
  source: "",
  priority: "中",
  notes: "",
  tagsText: "",
  status: "想吃",
};

const emptyConversion: WishlistConversionInput = {
  visitDate: todayInputValue(),
  peopleCount: "1",
  totalCost: "",
  averageCost: "",
  overallRating: "4",
  revisitStatus: "愿意复访",
  summary: "",
  notes: "",
};

const inputClassName = "min-h-11 w-full rounded-2xl border border-line bg-white/85 px-3 text-sm text-ink outline-none focus:border-orange";

function formFromItem(item: WishlistItem): FormState {
  return {
    id: item.id,
    restaurantName: item.restaurantName,
    branchName: item.branchName ?? "",
    category: item.category ?? "",
    address: item.address ?? "",
    district: item.district ?? "",
    businessArea: item.businessArea ?? "",
    source: item.source ?? "",
    priority: item.priority,
    notes: item.notes ?? "",
    tagsText: item.tags.join("、"),
    status: item.status,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function statusClass(status: WishlistStatus) {
  if (status === "想吃") {
    return "bg-orange/12 text-orange";
  }
  if (status === "已探店") {
    return "bg-blue/25 text-ink";
  }
  return "bg-cream text-muted";
}

export function WishlistPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [randomPick, setRandomPick] = useState<WishlistItem | null>(null);
  const [convertingItem, setConvertingItem] = useState<WishlistItem | null>(null);
  const [conversion, setConversion] = useState<WishlistConversionInput>(emptyConversion);
  const [feedback, setFeedback] = useState<string>("");

  async function loadItems() {
    try {
      await ensureSeedData();
      const items = await getWishlistItems();
      setState({ status: "ready", items });
    } catch (error) {
      const message = error instanceof Error ? error.message : "想吃清单读取失败";
      setState({ status: "error", message });
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  const activeItems = useMemo(
    () => state.status === "ready" ? state.items.filter((item) => item.status === "想吃") : [],
    [state],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateConversion<K extends keyof WishlistConversionInput>(key: K, value: WishlistConversionInput[K]) {
    setConversion((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setForm(emptyForm);
    setIsFormOpen(true);
    setFeedback("");
  }

  function startEdit(item: WishlistItem) {
    setForm(formFromItem(item));
    setIsFormOpen(true);
    setFeedback("");
  }

  async function handleSave() {
    if (!form.restaurantName.trim()) {
      setFeedback("请填写餐厅名称");
      return;
    }
    await upsertWishlistItem(form);
    setForm(emptyForm);
    setIsFormOpen(false);
    setFeedback("已保存想吃餐厅");
    await loadItems();
  }

  async function handleDelete(item: WishlistItem) {
    await deleteWishlistItem(item.id);
    setFeedback("已删除");
    if (form.id === item.id) {
      setForm(emptyForm);
      setIsFormOpen(false);
    }
    await loadItems();
  }

  function handleRandomPick() {
    const item = activeItems[Math.floor(Math.random() * activeItems.length)];
    setRandomPick(item ?? null);
  }

  function startConvert(item: WishlistItem) {
    setConvertingItem(item);
    setConversion({
      ...emptyConversion,
      summary: `${item.restaurantName} 完成探店。`,
      notes: item.notes ?? "",
    });
    setFeedback("");
  }

  async function handleConvert() {
    if (!convertingItem) {
      return;
    }
    if (!conversion.visitDate || !conversion.overallRating.trim()) {
      setFeedback("请填写探店日期和评分");
      return;
    }
    const detail = await convertWishlistItemToVisit(convertingItem.id, conversion);
    setConvertingItem(null);
    setFeedback("已转为探店记录");
    await loadItems();
    navigate(`/visits/${detail.visit.id}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="WISHLIST"
        title="想吃清单"
        description="从 IndexedDB 读取、编辑和转换想吃餐厅。"
      />

      {state.status === "loading" ? <LoadingState label="正在读取想吃清单" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}

      {state.status === "ready" ? (
        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/78 p-3 shadow-soft">
              <Heart size={16} className="text-orange" aria-hidden="true" />
              <p className="mt-2 text-xl font-semibold text-ink">{state.items.length}</p>
              <p className="text-xs text-muted">总数</p>
            </div>
            <div className="rounded-2xl bg-white/78 p-3 shadow-soft">
              <UtensilsCrossed size={16} className="text-orange" aria-hidden="true" />
              <p className="mt-2 text-xl font-semibold text-ink">{activeItems.length}</p>
              <p className="text-xs text-muted">想吃</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-2xl bg-ink p-3 text-left text-white shadow-soft"
            >
              <Plus size={16} aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">新增</p>
            </button>
          </section>

          {feedback ? <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm text-muted">{feedback}</p> : null}

          <section className="rounded-card bg-white/80 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange">RANDOM</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">随机选店</h2>
              </div>
              <button
                type="button"
                onClick={handleRandomPick}
                disabled={activeItems.length === 0}
                className={`${primaryButtonClassName} min-h-10 px-4`}
              >
                <Dice5 size={17} aria-hidden="true" />
                抽一家
              </button>
            </div>
            {randomPick ? (
              <div className="mt-4 rounded-2xl bg-cream p-4">
                <p className="text-sm font-semibold text-ink">{randomPick.restaurantName}</p>
                <p className="mt-1 text-xs text-muted">{[randomPick.category, randomPick.district, randomPick.businessArea].filter(Boolean).join(" · ") || "未填写分类区域"}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">随机范围只包含状态为“想吃”的餐厅。</p>
            )}
          </section>

          {isFormOpen ? (
            <section className="rounded-card bg-white/84 p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">{form.id ? "编辑想吃餐厅" : "新增想吃餐厅"}</h2>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-full bg-cream p-2 text-muted">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-3">
                <Field label="餐厅名称">
                  <input value={form.restaurantName} onChange={(event) => updateForm("restaurantName", event.target.value)} className={inputClassName} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="分店">
                    <input value={form.branchName ?? ""} onChange={(event) => updateForm("branchName", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="餐饮类型">
                    <select value={form.category ?? ""} onChange={(event) => updateForm("category", event.target.value as RestaurantCategory | "")} className={inputClassName}>
                      <option value="">未定</option>
                      {restaurantCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </Field>
                  <Field label="行政区">
                    <input value={form.district ?? ""} onChange={(event) => updateForm("district", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="商圈">
                    <input value={form.businessArea ?? ""} onChange={(event) => updateForm("businessArea", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="优先级">
                    <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value as WishlistPriority)} className={inputClassName}>
                      {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </Field>
                  <Field label="状态">
                    <select value={form.status ?? "想吃"} onChange={(event) => updateForm("status", event.target.value as WishlistStatus)} className={inputClassName}>
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="地址">
                  <input value={form.address ?? ""} onChange={(event) => updateForm("address", event.target.value)} className={inputClassName} />
                </Field>
                <Field label="来源">
                  <input value={form.source ?? ""} onChange={(event) => updateForm("source", event.target.value)} className={inputClassName} />
                </Field>
                <Field label="标签">
                  <input value={form.tagsText} onChange={(event) => updateForm("tagsText", event.target.value)} className={inputClassName} placeholder="用顿号或逗号分隔" />
                </Field>
                <Field label="备注">
                  <textarea value={form.notes ?? ""} onChange={(event) => updateForm("notes", event.target.value)} className={`${inputClassName} min-h-24 py-3`} />
                </Field>
                <button type="button" onClick={handleSave} className={`${primaryButtonClassName} w-full gap-2`}>
                  <Save size={17} aria-hidden="true" />
                  保存
                </button>
              </div>
            </section>
          ) : null}

          {convertingItem ? (
            <section className="rounded-card bg-white/84 p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-orange">CONVERT</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">转为探店记录</h2>
                </div>
                <button type="button" onClick={() => setConvertingItem(null)} className="rounded-full bg-cream p-2 text-muted">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <p className="mb-4 rounded-2xl bg-cream p-3 text-sm font-semibold text-ink">{convertingItem.restaurantName}</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="探店日期">
                    <input type="date" value={conversion.visitDate} onChange={(event) => updateConversion("visitDate", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="综合评分">
                    <input inputMode="decimal" value={conversion.overallRating} onChange={(event) => updateConversion("overallRating", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="用餐人数">
                    <input inputMode="numeric" value={conversion.peopleCount} onChange={(event) => updateConversion("peopleCount", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="复访意愿">
                    <select value={conversion.revisitStatus} onChange={(event) => updateConversion("revisitStatus", event.target.value as RevisitStatus)} className={inputClassName}>
                      {revisitStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </Field>
                  <Field label="总消费">
                    <input inputMode="numeric" value={conversion.totalCost ?? ""} onChange={(event) => updateConversion("totalCost", event.target.value)} className={inputClassName} />
                  </Field>
                  <Field label="人均消费">
                    <input inputMode="numeric" value={conversion.averageCost ?? ""} onChange={(event) => updateConversion("averageCost", event.target.value)} className={inputClassName} />
                  </Field>
                </div>
                <Field label="一句话评价">
                  <input value={conversion.summary} onChange={(event) => updateConversion("summary", event.target.value)} className={inputClassName} />
                </Field>
                <Field label="详细笔记">
                  <textarea value={conversion.notes ?? ""} onChange={(event) => updateConversion("notes", event.target.value)} className={`${inputClassName} min-h-24 py-3`} />
                </Field>
                <button type="button" onClick={handleConvert} className={`${primaryButtonClassName} w-full gap-2`}>
                  <UtensilsCrossed size={17} aria-hidden="true" />
                  生成探店记录
                </button>
              </div>
            </section>
          ) : null}

          {state.items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="还没有想吃餐厅"
              description="新增一条餐厅后，可以随机选择或转为探店记录。"
              action={<button type="button" onClick={startCreate} className={primaryButtonClassName}>新增第一条</button>}
            />
          ) : (
            <section className="space-y-3">
              {state.items.length < 3 ? (
                <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm leading-6 text-muted">想吃清单较少时，随机结果会比较集中。</p>
              ) : null}
              {state.items.map((item) => (
                <article key={item.id} className="rounded-card bg-white/82 p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-orange">{item.category ?? "未定类型"}</p>
                      <h2 className="mt-1 text-xl font-semibold text-ink">{item.restaurantName}</h2>
                      <p className="mt-1 text-xs text-muted">{[item.branchName, item.district, item.businessArea].filter(Boolean).join(" · ") || "未填写区域"}</p>
                    </div>
                    <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                  </div>
                  {item.notes ? <p className="mt-3 text-sm leading-6 text-ink">{item.notes}</p> : null}
                  {item.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.tags.map((tag) => <span key={tag} className="rounded-pill bg-cream px-3 py-1 text-xs font-semibold text-muted">{tag}</span>)}
                    </div>
                  ) : null}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => startEdit(item)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-pill bg-cream px-3 text-xs font-semibold text-muted">
                      <Edit3 size={14} aria-hidden="true" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => startConvert(item)}
                      disabled={item.status === "已探店"}
                      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-pill bg-ink px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <UtensilsCrossed size={14} aria-hidden="true" />
                      转探店
                    </button>
                    <button type="button" onClick={() => handleDelete(item)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-pill bg-orange/12 px-3 text-xs font-semibold text-orange">
                      <Trash2 size={14} aria-hidden="true" />
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
