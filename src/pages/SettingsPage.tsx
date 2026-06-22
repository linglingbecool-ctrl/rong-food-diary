import { Database, Download, FileJson, RotateCcw, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { ErrorState } from "../components/ui/ErrorState";
import { PageHeader } from "../components/ui/PageHeader";
import { primaryButtonClassName } from "../components/ui/PrimaryButton";
import {
  clearAllData,
  createDataExportBundle,
  importDataBundle,
  restoreSampleData,
} from "../db/repositories";
import type { DataExportBundle, ImportMode, ImportResult } from "../types/models";

type BusyState = "idle" | "exporting" | "importing" | "clearing" | "restoring";

function downloadJson(bundle: DataExportBundle, prefix: string) {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = bundle.exportedAt.slice(0, 10);
  link.href = url;
  link.download = `${prefix}-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-cream/80 p-3">
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [clearConfirm, setClearConfirm] = useState("");

  async function handleExport() {
    setBusy("exporting");
    setError("");
    setMessage("");
    try {
      const bundle = await createDataExportBundle();
      downloadJson(bundle, "rong-food-diary-export");
      setMessage(`已导出版本 ${bundle.version} 数据，导出日期 ${bundle.exportedAt}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setBusy("importing");
    setError("");
    setMessage("");
    setImportResult(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSON 解析失败：文件不是有效 JSON");
      }
      const result = await importDataBundle(parsed, importMode);
      downloadJson(result.backup, "rong-food-diary-auto-backup");
      setImportResult(result);
      setMessage(`导入完成。已在导入前自动下载备份文件。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败");
    } finally {
      setBusy("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleClearAll() {
    if (clearConfirm !== "清空全部数据") {
      setError("二次确认未通过：请完整输入“清空全部数据”。");
      return;
    }
    setBusy("clearing");
    setError("");
    setMessage("");
    try {
      const backup = await createDataExportBundle();
      downloadJson(backup, "rong-food-diary-before-clear");
      await clearAllData();
      setClearConfirm("");
      setMessage("全部数据已清空，清空前备份已自动下载。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "清空失败");
    } finally {
      setBusy("idle");
    }
  }

  async function handleRestoreSample() {
    setBusy("restoring");
    setError("");
    setMessage("");
    try {
      const backup = await createDataExportBundle();
      downloadJson(backup, "rong-food-diary-before-restore-sample");
      await restoreSampleData();
      setMessage("已恢复示例数据，恢复前备份已自动下载。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "恢复示例数据失败");
    } finally {
      setBusy("idle");
    }
  }

  const isBusy = busy !== "idle";

  return (
    <div>
      <PageHeader
        eyebrow="SETTINGS"
        title="设置和数据管理"
        description="JSON 备份、导入校验、图片数据和本地 IndexedDB 管理。"
      />

      <div className="space-y-5">
        {error ? <ErrorState title="操作失败" message={error} /> : null}
        {message ? <p className="rounded-2xl bg-blue/20 px-4 py-3 text-sm leading-6 text-muted">{message}</p> : null}

        <section className="rounded-card bg-white/80 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue/20 text-ink">
              <FileJson size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">JSON 数据导出</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                导出文件包含版本号、导出日期、业务数据和 IndexedDB 中的图片数据。图片只写入下载文件，不写入 localStorage。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isBusy}
            className={`${primaryButtonClassName} mt-4 w-full gap-2`}
          >
            <Download size={17} aria-hidden="true" />
            {busy === "exporting" ? "正在导出" : "导出 JSON"}
          </button>
        </section>

        <section className="rounded-card bg-white/80 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/12 text-orange">
              <Upload size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">JSON 数据导入</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                导入前会自动生成备份。导入会验证应用标识、数据版本和核心表结构；损坏图片会跳过并报告。
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-pill bg-cream p-1">
            <button
              type="button"
              onClick={() => setImportMode("merge")}
              className={`min-h-10 rounded-pill text-sm font-semibold ${importMode === "merge" ? "bg-ink text-white" : "text-muted"}`}
            >
              合并导入
            </button>
            <button
              type="button"
              onClick={() => setImportMode("replace")}
              className={`min-h-10 rounded-pill text-sm font-semibold ${importMode === "replace" ? "bg-ink text-white" : "text-muted"}`}
            >
              覆盖导入
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              void handleImportFile(event.target.files?.[0]);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className={`${primaryButtonClassName} mt-4 w-full gap-2`}
          >
            <Upload size={17} aria-hidden="true" />
            {busy === "importing" ? "正在导入" : "选择 JSON 文件"}
          </button>

          {importResult ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <SummaryLine label="餐厅" value={importResult.imported.restaurants} />
                <SummaryLine label="探店" value={importResult.imported.visitRecords} />
                <SummaryLine label="菜品" value={importResult.imported.dishRecords} />
                <SummaryLine label="图片" value={importResult.imported.photos} />
              </div>
              {importResult.duplicates.length > 0 ? (
                <p className="rounded-2xl bg-cream px-4 py-3 text-sm leading-6 text-muted">
                  检测到重复数据，合并导入时已跳过：{importResult.duplicates.slice(0, 8).join("、")}
                  {importResult.duplicates.length > 8 ? " 等" : ""}
                </p>
              ) : null}
              {importResult.skippedPhotos.length > 0 ? (
                <p className="rounded-2xl bg-orange/10 px-4 py-3 text-sm leading-6 text-orange">
                  有图片未导入：{importResult.skippedPhotos.slice(0, 5).join("；")}
                  {importResult.skippedPhotos.length > 5 ? " 等" : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-card bg-white/80 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/12 text-orange">
              <ShieldAlert size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">危险操作</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                清空前会自动下载备份。二次确认通过后会删除 IndexedDB 中的餐厅、探店、菜品、图片、清单和设置。
              </p>
            </div>
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold text-muted">二次确认</span>
            <input
              value={clearConfirm}
              onChange={(event) => setClearConfirm(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-line bg-white/85 px-3 text-sm text-ink outline-none focus:border-orange"
              placeholder="输入：清空全部数据"
            />
          </label>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={isBusy}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-orange px-5 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={17} aria-hidden="true" />
            {busy === "clearing" ? "正在清空" : "清空全部数据"}
          </button>
        </section>

        <section className="rounded-card bg-white/80 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue/20 text-ink">
              <Database size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">恢复示例数据</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                用内置示例重新初始化应用。执行前同样会自动下载当前数据备份。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestoreSample}
            disabled={isBusy}
            className={`${primaryButtonClassName} mt-4 w-full gap-2`}
          >
            <RotateCcw size={17} aria-hidden="true" />
            {busy === "restoring" ? "正在恢复" : "恢复示例数据"}
          </button>
        </section>

        <section className="rounded-card bg-white/75 p-5 text-sm leading-6 text-muted shadow-soft">
          <p className="font-semibold text-ink">应用版本</p>
          <p className="mt-1">Rong Food Diary 0.1.0</p>
          <p className="mt-4 font-semibold text-ink">本地存储</p>
          <p className="mt-1">业务数据和图片 Blob 均保存在当前浏览器的 IndexedDB 中。</p>
        </section>
      </div>
    </div>
  );
}
