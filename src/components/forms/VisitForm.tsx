import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearVisitDraft,
  deletePhotosIfUnused,
  saveProcessedPhoto,
  saveVisitDraft,
} from "../../db/repositories";
import type {
  DiningPurpose,
  MealPeriod,
  QueueWorthiness,
  RecommendationStatus,
  RestaurantCategory,
  RevisitStatus,
  VisitFormMode,
  VisitFormValues,
} from "../../types/models";
import { createEmptyDish, restaurantCategories } from "../../utils/visitForm";
import { acceptedImageTypes, maxOriginalImageBytes, processImageFile } from "../../utils/imageProcessing";
import { LocationPicker } from "../maps/LocationPicker";
import { PhotoThumbnail } from "../photos/PhotoThumbnail";
import { PrimaryButton, primaryButtonClassName } from "../ui/PrimaryButton";

type VisitFormProps = {
  mode: VisitFormMode;
  initialValues: VisitFormValues;
  draftId: string;
  visitId?: string;
  submitLabel: string;
  onSubmit: (values: VisitFormValues) => Promise<void>;
};

type FormErrors = Record<string, string>;
type SaveState = "idle" | "saving" | "saved" | "error";

const mealPeriods: MealPeriod[] = ["早餐", "午餐", "下午茶", "晚餐", "夜宵"];
const diningPurposes: DiningPurpose[] = [
  "一个人",
  "朋友聚餐",
  "家庭聚餐",
  "约会",
  "工作餐",
  "随便吃点",
];
const revisitStatuses: RevisitStatus[] = ["愿意复访", "看情况", "不再复访"];
const queueWorthinessOptions: QueueWorthiness[] = ["值得排队", "不用排队更好", "不值得排队"];
const recommendationStatuses: RecommendationStatus[] = ["必点", "推荐", "一般", "避雷"];

const stepTitles = ["餐厅与位置", "菜品记录", "综合评价"];

function trim(value: string) {
  return value.trim();
}

function isValidNumber(value: string, min?: number, max?: number) {
  if (!trim(value)) {
    return true;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  if (min !== undefined && parsed < min) {
    return false;
  }
  if (max !== undefined && parsed > max) {
    return false;
  }
  return true;
}

function validateStep(values: VisitFormValues, step: number): FormErrors {
  const errors: FormErrors = {};

  if (step === 1) {
    if (!trim(values.restaurant.name)) {
      errors["restaurant.name"] = "请填写餐厅名称";
    }
    if (!values.restaurant.category) {
      errors["restaurant.category"] = "请选择餐饮类型";
    }
    if (!values.visit.visitDate) {
      errors["visit.visitDate"] = "请选择探店日期";
    }
    if (!isValidNumber(values.visit.peopleCount, 1)) {
      errors["visit.peopleCount"] = "用餐人数需要是大于 0 的数字";
    }
    if (!isValidNumber(values.restaurant.latitude, -90, 90)) {
      errors["restaurant.latitude"] = "纬度需要在 -90 到 90 之间";
    }
    if (!isValidNumber(values.restaurant.longitude, -180, 180)) {
      errors["restaurant.longitude"] = "经度需要在 -180 到 180 之间";
    }
  }

  if (step === 2) {
    values.dishes.forEach((dish, index) => {
      if (!trim(dish.name)) {
        errors[`dish.${dish.localId}.name`] = `第 ${index + 1} 道菜请填写菜品名称`;
      }
      if (!isValidNumber(dish.price, 0)) {
        errors[`dish.${dish.localId}.price`] = `第 ${index + 1} 道菜价格需要是有效数字`;
      }
      if (!isValidNumber(dish.rating, 0, 5)) {
        errors[`dish.${dish.localId}.rating`] = `第 ${index + 1} 道菜评分需要在 0 到 5 之间`;
      }
    });
  }

  if (step === 3) {
    if (!trim(values.visit.overallRating)) {
      errors["visit.overallRating"] = "请填写综合评分";
    } else if (!isValidNumber(values.visit.overallRating, 0, 5)) {
      errors["visit.overallRating"] = "综合评分需要在 0 到 5 之间";
    }

    if (!isValidNumber(values.visit.totalCost, 0)) {
      errors["visit.totalCost"] = "总消费需要是有效数字";
    }
    if (!isValidNumber(values.visit.averageCost, 0)) {
      errors["visit.averageCost"] = "人均消费需要是有效数字";
    }

    [
      ["visit.tasteRating", values.visit.tasteRating, "口味评分"],
      ["visit.environmentRating", values.visit.environmentRating, "环境评分"],
      ["visit.serviceRating", values.visit.serviceRating, "服务评分"],
      ["visit.valueRating", values.visit.valueRating, "性价比评分"],
    ].forEach(([key, value, label]) => {
      if (!isValidNumber(value, 0, 5)) {
        errors[key] = `${label}需要在 0 到 5 之间`;
      }
    });
  }

  return errors;
}

function mergeErrors(values: VisitFormValues) {
  return {
    ...validateStep(values, 1),
    ...validateStep(values, 2),
    ...validateStep(values, 3),
  };
}

function firstErrorStep(errors: FormErrors) {
  const keys = Object.keys(errors);
  if (keys.some((key) => key.startsWith("restaurant.") || key === "visit.visitDate" || key === "visit.peopleCount")) {
    return 1;
  }
  if (keys.some((key) => key.startsWith("dish."))) {
    return 2;
  }
  return 3;
}

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-orange" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs leading-5 text-muted" aria-hidden="true">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-orange" aria-hidden="true">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const inputClassName =
  "min-h-12 w-full rounded-[18px] border border-line bg-white/90 px-4 text-sm text-ink outline-none transition placeholder:text-muted/65 focus:border-orange focus:ring-2 focus:ring-orange/20";

const textareaClassName =
  "min-h-28 w-full resize-none rounded-[18px] border border-line bg-white/90 px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted/65 focus:border-orange focus:ring-2 focus:ring-orange/20";

function errorSummary(errors: FormErrors) {
  return Object.values(errors).slice(0, 4);
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function coordinatesFromText(latitudeText: string, longitudeText: string) {
  const latitude = Number(latitudeText.trim());
  const longitude = Number(longitudeText.trim());

  if (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return { latitude, longitude };
  }

  return undefined;
}

export function VisitForm({
  mode,
  initialValues,
  draftId,
  visitId,
  submitLabel,
  onSubmit,
}: VisitFormProps) {
  const [values, setValues] = useState<VisitFormValues>(initialValues);
  const [step, setStep] = useState(initialValues.currentStep || 1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [draftState, setDraftState] = useState<SaveState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    setValues(initialValues);
    setStep(initialValues.currentStep || 1);
  }, [initialValues]);

  useEffect(() => {
    if (hasSubmittedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDraftState("saving");
      const dataToSave = { ...values, currentStep: step };
      saveVisitDraft(draftId, mode, dataToSave, visitId)
        .then(() => setDraftState("saved"))
        .catch(() => setDraftState("error"));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draftId, mode, step, values, visitId]);

  const summaryErrors = useMemo(() => errorSummary(errors), [errors]);
  const currentCoordinates = useMemo(
    () => coordinatesFromText(values.restaurant.latitude, values.restaurant.longitude),
    [values.restaurant.latitude, values.restaurant.longitude],
  );

  function updateRestaurantField<K extends keyof VisitFormValues["restaurant"]>(
    key: K,
    value: VisitFormValues["restaurant"][K],
  ) {
    setValues((current) => ({
      ...current,
      restaurant: { ...current.restaurant, [key]: value },
    }));
  }

  function updateVisitField<K extends keyof VisitFormValues["visit"]>(
    key: K,
    value: VisitFormValues["visit"][K],
  ) {
    setValues((current) => ({
      ...current,
      visit: { ...current.visit, [key]: value },
    }));
  }

  function updateDishField<K extends keyof VisitFormValues["dishes"][number]>(
    localId: string,
    key: K,
    value: VisitFormValues["dishes"][number][K],
  ) {
    setValues((current) => ({
      ...current,
      dishes: current.dishes.map((dish) =>
        dish.localId === localId ? { ...dish, [key]: value } : dish,
      ),
    }));
  }

  function addDish() {
    setValues((current) => ({
      ...current,
      dishes: [...current.dishes, createEmptyDish()],
    }));
  }

  function removeDish(localId: string) {
    const dish = values.dishes.find((item) => item.localId === localId);
    const label = dish?.name.trim() || "这道菜";
    if (!window.confirm(`确定删除「${label}」吗？`)) {
      return;
    }
    setValues((current) => ({
      ...current,
      dishes: current.dishes.filter((item) => item.localId !== localId),
    }));
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setPhotoError("");
    setIsProcessingPhoto(true);
    const savedPhotoIds: string[] = [];
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const processed = await processImageFile(file);
        const saved = await saveProcessedPhoto(processed);
        savedPhotoIds.push(saved.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "图片处理失败";
        failures.push(`${file.name}: ${message}`);
      }
    }

    if (savedPhotoIds.length > 0) {
      updateVisitField("photoIds", [...values.visit.photoIds, ...savedPhotoIds]);
    }
    if (failures.length > 0) {
      setPhotoError(failures.join("；"));
    }
    setIsProcessingPhoto(false);
  }

  function removePhoto(photoId: string) {
    updateVisitField("photoIds", values.visit.photoIds.filter((id) => id !== photoId));
    void deletePhotosIfUnused([photoId]);
  }

  function goNext() {
    const nextErrors = validateStep(values, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      const nextStep = Math.min(step + 1, 3);
      setStep(nextStep);
      setValues((current) => ({ ...current, currentStep: nextStep }));
    }
  }

  function goPrevious() {
    const previousStep = Math.max(step - 1, 1);
    setStep(previousStep);
    setValues((current) => ({ ...current, currentStep: previousStep }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = mergeErrors(values);
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      const targetStep = firstErrorStep(nextErrors);
      setStep(targetStep);
      setValues((current) => ({ ...current, currentStep: targetStep }));
      return;
    }

    setIsSubmitting(true);
    try {
      hasSubmittedRef.current = true;
      await onSubmit({ ...values, currentStep: step });
      await clearVisitDraft(draftId);
    } catch (error) {
      hasSubmittedRef.current = false;
      setSubmitError(error instanceof Error ? error.message : "保存失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className="rounded-card bg-white/78 p-4 shadow-soft">
        <div className="grid grid-cols-3 gap-2">
          {stepTitles.map((title, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === step;
            const isDone = stepNumber < step;
            return (
              <button
                key={title}
                type="button"
                className={[
                  "rounded-[16px] px-2 py-3 text-left text-xs transition",
                  isActive ? "bg-ink text-white" : "bg-cream text-muted",
                  isDone ? "text-ink" : "",
                ].join(" ")}
                onClick={() => {
                  setStep(stepNumber);
                  setValues((current) => ({ ...current, currentStep: stepNumber }));
                }}
              >
                <span className="block text-[11px] font-semibold">STEP {stepNumber}</span>
                <span className="mt-1 block font-semibold">{title}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {draftState === "saving" ? "正在自动保存草稿" : null}
          {draftState === "saved" ? "草稿已自动保存" : null}
          {draftState === "error" ? "草稿保存失败，请检查浏览器存储权限" : null}
          {draftState === "idle" ? "填写内容会自动保存为草稿" : null}
        </p>
      </section>

      {summaryErrors.length > 0 ? (
        <section className="rounded-card border border-orange/30 bg-orange/10 p-4" aria-live="polite">
          <p className="text-sm font-semibold text-ink">请先补全这些内容</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {summaryErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-card bg-white/78 p-4 shadow-soft">
          <Field label="餐厅名称" required error={errors["restaurant.name"]}>
            <input
              className={inputClassName}
              value={values.restaurant.name}
              onChange={(event) => updateRestaurantField("name", event.target.value)}
              placeholder="例如：蓉城巷子火锅"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="分店名称">
              <input
                className={inputClassName}
                value={values.restaurant.branchName}
                onChange={(event) => updateRestaurantField("branchName", event.target.value)}
                placeholder="玉林店"
              />
            </Field>
            <Field label="餐饮类型" required error={errors["restaurant.category"]}>
              <select
                className={inputClassName}
                value={values.restaurant.category}
                onChange={(event) =>
                  updateRestaurantField("category", event.target.value as RestaurantCategory | "")
                }
              >
                <option value="">请选择</option>
                {restaurantCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="地址">
            <input
              className={inputClassName}
              value={values.restaurant.address}
              onChange={(event) => updateRestaurantField("address", event.target.value)}
              placeholder="成都具体地址"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="行政区">
              <input
                className={inputClassName}
                value={values.restaurant.district}
                onChange={(event) => updateRestaurantField("district", event.target.value)}
                placeholder="武侯区"
              />
            </Field>
            <Field label="商圈">
              <input
                className={inputClassName}
                value={values.restaurant.businessArea}
                onChange={(event) => updateRestaurantField("businessArea", event.target.value)}
                placeholder="玉林"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="纬度" error={errors["restaurant.latitude"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.restaurant.latitude}
                onChange={(event) => updateRestaurantField("latitude", event.target.value)}
                placeholder="30.65"
              />
            </Field>
            <Field label="经度" error={errors["restaurant.longitude"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.restaurant.longitude}
                onChange={(event) => updateRestaurantField("longitude", event.target.value)}
                placeholder="104.08"
              />
            </Field>
          </div>
          <LocationPicker
            coordinates={currentCoordinates}
            onChange={(coordinates) => {
              updateRestaurantField("latitude", coordinates.latitude.toFixed(6));
              updateRestaurantField("longitude", coordinates.longitude.toFixed(6));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="探店日期" required error={errors["visit.visitDate"]}>
              <input
                className={inputClassName}
                type="date"
                value={values.visit.visitDate}
                onChange={(event) => updateVisitField("visitDate", event.target.value)}
              />
            </Field>
            <Field label="用餐时段">
              <select
                className={inputClassName}
                value={values.visit.mealPeriod}
                onChange={(event) => updateVisitField("mealPeriod", event.target.value as MealPeriod | "")}
              >
                <option value="">请选择</option>
                {mealPeriods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="用餐人数" error={errors["visit.peopleCount"]}>
              <input
                className={inputClassName}
                inputMode="numeric"
                value={values.visit.peopleCount}
                onChange={(event) => updateVisitField("peopleCount", event.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="聚餐类型">
              <select
                className={inputClassName}
                value={values.visit.diningPurpose}
                onChange={(event) =>
                  updateVisitField("diningPurpose", event.target.value as DiningPurpose | "")
                }
              >
                <option value="">请选择</option>
                {diningPurposes.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="同行人" hint="可用逗号或顿号分隔，例如：阿宁、小周">
            <input
              className={inputClassName}
              value={values.visit.companionsText}
              onChange={(event) => updateVisitField("companionsText", event.target.value)}
              placeholder="阿宁、小周"
            />
          </Field>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-card bg-white/78 p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">菜品记录</h2>
              <p className="mt-1 text-xs text-muted">可以不添加菜品；添加后菜品名称为必填。</p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-pill bg-ink px-4 text-sm font-semibold text-white"
              onClick={addDish}
            >
              <Plus size={16} aria-hidden="true" />
              加菜
            </button>
          </div>

          {values.dishes.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-line bg-cream/70 p-5 text-sm leading-6 text-muted">
              还没有添加菜品。只想记录整体体验的话，可以直接进入下一步。
            </div>
          ) : null}

          {values.dishes.map((dish, index) => (
            <article key={dish.localId} className="space-y-3 rounded-[20px] bg-cream/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">第 {index + 1} 道菜</h3>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white text-muted shadow-soft"
                  onClick={() => removeDish(dish.localId)}
                  aria-label={`删除第 ${index + 1} 道菜`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
              <Field label="菜品名称" required error={errors[`dish.${dish.localId}.name`]}>
                <input
                  className={inputClassName}
                  value={dish.name}
                  onChange={(event) => updateDishField(dish.localId, "name", event.target.value)}
                  placeholder="例如：鲜毛肚"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="菜品类别">
                  <input
                    className={inputClassName}
                    value={dish.category}
                    onChange={(event) => updateDishField(dish.localId, "category", event.target.value)}
                    placeholder="热菜"
                  />
                </Field>
                <Field label="价格" error={errors[`dish.${dish.localId}.price`]}>
                  <input
                    className={inputClassName}
                    inputMode="decimal"
                    value={dish.price}
                    onChange={(event) => updateDishField(dish.localId, "price", event.target.value)}
                    placeholder="48"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="评分" error={errors[`dish.${dish.localId}.rating`]}>
                  <input
                    className={inputClassName}
                    inputMode="decimal"
                    value={dish.rating}
                    onChange={(event) => updateDishField(dish.localId, "rating", event.target.value)}
                    placeholder="0-5"
                  />
                </Field>
                <Field label="推荐状态">
                  <select
                    className={inputClassName}
                    value={dish.recommendationStatus}
                    onChange={(event) =>
                      updateDishField(
                        dish.localId,
                        "recommendationStatus",
                        event.target.value as RecommendationStatus,
                      )
                    }
                  >
                    {recommendationStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="菜品评价">
                <textarea
                  className={textareaClassName}
                  value={dish.notes}
                  onChange={(event) => updateDishField(dish.localId, "notes", event.target.value)}
                  placeholder="口感、分量、下次还会不会点"
                />
              </Field>
            </article>
          ))}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-card bg-white/78 p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-3">
            <Field label="总消费" error={errors["visit.totalCost"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.totalCost}
                onChange={(event) => updateVisitField("totalCost", event.target.value)}
                placeholder="188"
              />
            </Field>
            <Field label="人均消费" error={errors["visit.averageCost"]} hint="留空时会按总消费和人数自动估算。">
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.averageCost}
                onChange={(event) => updateVisitField("averageCost", event.target.value)}
                placeholder="94"
              />
            </Field>
          </div>
          <Field label="综合评分" required error={errors["visit.overallRating"]}>
            <input
              className={inputClassName}
              inputMode="decimal"
              value={values.visit.overallRating}
              onChange={(event) => updateVisitField("overallRating", event.target.value)}
              placeholder="0-5"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="口味评分" error={errors["visit.tasteRating"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.tasteRating}
                onChange={(event) => updateVisitField("tasteRating", event.target.value)}
                placeholder="0-5"
              />
            </Field>
            <Field label="环境评分" error={errors["visit.environmentRating"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.environmentRating}
                onChange={(event) => updateVisitField("environmentRating", event.target.value)}
                placeholder="0-5"
              />
            </Field>
            <Field label="服务评分" error={errors["visit.serviceRating"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.serviceRating}
                onChange={(event) => updateVisitField("serviceRating", event.target.value)}
                placeholder="0-5"
              />
            </Field>
            <Field label="性价比评分" error={errors["visit.valueRating"]}>
              <input
                className={inputClassName}
                inputMode="decimal"
                value={values.visit.valueRating}
                onChange={(event) => updateVisitField("valueRating", event.target.value)}
                placeholder="0-5"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="复访意愿">
              <select
                className={inputClassName}
                value={values.visit.revisitStatus}
                onChange={(event) => updateVisitField("revisitStatus", event.target.value as RevisitStatus)}
              >
                {revisitStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="是否值得排队">
              <select
                className={inputClassName}
                value={values.visit.queueWorthiness}
                onChange={(event) =>
                  updateVisitField("queueWorthiness", event.target.value as QueueWorthiness | "")
                }
              >
                <option value="">请选择</option>
                {queueWorthinessOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="推荐人群" hint="例如：朋友聚餐、爱吃辣的人">
            <input
              className={inputClassName}
              value={values.visit.recommendedForText}
              onChange={(event) => updateVisitField("recommendedForText", event.target.value)}
              placeholder="朋友聚餐、爱吃辣的人"
            />
          </Field>
          <Field label="标签" hint="可用逗号或顿号分隔">
            <input
              className={inputClassName}
              value={values.visit.tagsText}
              onChange={(event) => updateVisitField("tagsText", event.target.value)}
              placeholder="牛油锅底、夜宵、安静"
            />
          </Field>
          <Field label="一句话评价">
            <input
              className={inputClassName}
              value={values.visit.summary}
              onChange={(event) => updateVisitField("summary", event.target.value)}
              placeholder="这家最值得记住的一点"
            />
          </Field>
          <Field label="详细笔记">
            <textarea
              className={textareaClassName}
              value={values.visit.notes}
              onChange={(event) => updateVisitField("notes", event.target.value)}
              placeholder="排队情况、点单建议、下次想试什么"
            />
          </Field>
          <section className="rounded-[20px] bg-cream/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">图片</h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  支持 JPG、PNG、WebP；单张原图不超过 {formatMegabytes(maxOriginalImageBytes)}，浏览器端压缩后保存。
                </p>
              </div>
              <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-pill bg-ink px-4 text-sm font-semibold text-white">
                <ImagePlus size={16} aria-hidden="true" />
                上传
                <input
                  type="file"
                  accept={acceptedImageTypes.join(",")}
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    void handlePhotoFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {isProcessingPhoto ? <p className="mt-3 text-sm text-muted">正在压缩图片并生成缩略图。</p> : null}
            {photoError ? <p className="mt-3 rounded-2xl bg-orange/10 px-4 py-3 text-sm leading-6 text-orange">{photoError}</p> : null}
            {values.visit.photoIds.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {values.visit.photoIds.map((photoId) => (
                  <div key={photoId} className="relative overflow-hidden rounded-[18px]">
                    <PhotoThumbnail photoId={photoId} alt="探店图片缩略图" className="aspect-square w-full" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photoId)}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-white"
                      aria-label="删除图片"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/70 px-4 py-3 text-sm text-muted">
                暂无图片。
              </p>
            )}
          </section>
        </section>
      ) : null}

      {submitError ? (
        <p className="rounded-[18px] bg-orange/10 px-4 py-3 text-sm font-medium text-orange">
          {submitError}
        </p>
      ) : null}

      <footer className="flex gap-3">
        {step > 1 ? (
          <button
            type="button"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-pill border border-line bg-white/80 px-5 text-sm font-semibold text-ink shadow-soft"
            onClick={goPrevious}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            上一步
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            className={`${primaryButtonClassName} flex-1 gap-2`}
            onClick={goNext}
          >
            下一步
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <PrimaryButton type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Save size={18} aria-hidden="true" />
                正在保存
              </>
            ) : (
              <>
                <Check size={18} aria-hidden="true" />
                {submitLabel}
              </>
            )}
          </PrimaryButton>
        )}
      </footer>
    </form>
  );
}
