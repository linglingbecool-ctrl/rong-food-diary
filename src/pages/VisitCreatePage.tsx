import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { VisitForm } from "../components/forms/VisitForm";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import {
  createVisitFromForm,
  getVisitDraft,
  getVisitDraftId,
} from "../db/repositories";
import type { VisitFormValues } from "../types/models";
import { createEmptyVisitFormValues } from "../utils/visitForm";

type PageState =
  | { status: "loading" }
  | { status: "ready"; values: VisitFormValues }
  | { status: "error"; message: string };

export function VisitCreatePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const draftId = getVisitDraftId("create");

  useEffect(() => {
    let isMounted = true;

    async function loadDraft() {
      try {
        const draft = await getVisitDraft(draftId);
        if (isMounted) {
          setState({
            status: "ready",
            values: draft?.formData ?? createEmptyVisitFormValues(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "草稿读取失败";
        if (isMounted) {
          setState({ status: "error", message });
        }
      }
    }

    void loadDraft();

    return () => {
      isMounted = false;
    };
  }, [draftId]);

  async function handleSubmit(values: VisitFormValues) {
    const detail = await createVisitFromForm(values);
    navigate(`/visits/${detail.visit.id}`, { replace: true });
  }

  return (
    <div>
      <PageHeader
        eyebrow="VISIT"
        title="记录这一顿"
        description="先写餐厅，再记菜品，最后留下这顿饭的整体评价。"
      />
      {state.status === "loading" ? <LoadingState label="正在读取未完成草稿" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <VisitForm
          mode="create"
          initialValues={state.values}
          draftId={draftId}
          submitLabel="保存探店"
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
