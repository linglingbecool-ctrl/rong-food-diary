import { ArrowRight, MapPinned, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { PrimaryButton } from "../components/ui/PrimaryButton";
import { completeWelcome, getOrCreateSettings } from "../db/repositories";

type WelcomeStatus = "loading" | "ready" | "completed" | "error";

export function WelcomePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<WelcomeStatus>("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const settings = await getOrCreateSettings();
        if (!isMounted) {
          return;
        }
        setStatus(settings.hasCompletedWelcome ? "completed" : "ready");
      } catch {
        if (isMounted) {
          setStatus("error");
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStart() {
    setStatus("loading");
    await completeWelcome();
    navigate("/home", { replace: true });
  }

  if (status === "completed") {
    return <Navigate to="/home" replace />;
  }

  return (
    <main className="min-h-screen bg-[var(--surface-gradient)] px-5 py-8 text-ink">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-app flex-col justify-between overflow-hidden rounded-[30px] bg-cream/90 p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/80 px-4 py-2 text-sm font-semibold shadow-soft">
            <Sparkles size={16} aria-hidden="true" />
            Rong Food Diary
          </span>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-orange/15 text-orange">
            <MapPinned size={22} aria-hidden="true" />
          </span>
        </div>

        <div className="py-12">
          <div className="mb-8 grid h-56 place-items-center rounded-[28px] bg-white/65 p-5 shadow-soft">
            <div className="relative h-full w-full rounded-[24px] bg-[linear-gradient(135deg,rgba(168,216,234,.65),rgba(244,184,196,.55),rgba(233,120,63,.24))]">
              <span className="absolute left-8 top-7 h-8 w-8 rounded-full bg-ink shadow-soft" />
              <span className="absolute right-8 top-14 h-5 w-5 rounded-full bg-orange shadow-soft" />
              <span className="absolute bottom-9 left-14 h-6 w-6 rounded-full bg-white shadow-soft" />
              <div className="absolute bottom-7 right-7 rounded-3xl bg-cream/90 px-4 py-3 shadow-soft">
                <p className="text-xs font-semibold text-muted">成都探店地图</p>
                <p className="mt-1 text-lg font-semibold">8 家餐厅</p>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-orange">我的成都探店地图</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-tight">
            蓉食记
          </h1>
          <p className="mt-5 text-xl leading-8 text-ink">
            把每一顿饭，
            <br />
            留在成都地图上。
          </p>
        </div>

        <div>
          {status === "error" ? (
            <p className="mb-3 rounded-2xl bg-orange/10 px-4 py-3 text-sm text-muted">
              本地设置读取失败，可以稍后刷新页面重试。
            </p>
          ) : null}
          <PrimaryButton
            className="w-full gap-2"
            onClick={handleStart}
            disabled={status === "loading"}
          >
            {status === "loading" ? "正在准备" : "开始记录"}
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryButton>
        </div>
      </section>
    </main>
  );
}
