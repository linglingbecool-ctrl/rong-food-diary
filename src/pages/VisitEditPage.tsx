import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { VisitForm } from "../components/forms/VisitForm";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import {
  getVisitDetail,
  getVisitDraft,
  getVisitDraftId,
  updateVisitFromForm,
} from "../db/repositories";
import type { VisitFormValues } from "../types/models";
import { formValuesFromVisitDetail } from "../utils/visitForm";

type PageState =
  | { status: "loading" }
  | { status: "ready"; values: VisitFormValues; draftId: string; visitId: string }
  | { status: "notFound" }
  | { status: "error"; message: string };

export function VisitEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function loadVisit() {
      if (!id) {
        setState({ status: "notFound" });
        return;
      }

      try {
        const detail = await getVisitDetail(id);
        if (!detail) {
          if (isMounted) {
            setState({ status: "notFound" });
          }
          return;
        }

        const draftId = getVisitDraftId("edit", id);
        const draft = await getVisitDraft(draftId);
        if (isMounted) {
          setState({
            status: "ready",
            values: draft?.formData ?? formValuesFromVisitDetail(detail),
            draftId,
            visitId: id,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "探店记录读取失败";
        if (isMounted) {
          setState({ status: "error", message });
        }
      }
    }

    void loadVisit();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleSubmit(values: VisitFormValues) {
    if (!id) {
      throw new Error("缺少探店记录编号");
    }
    const detail = await updateVisitFromForm(id, values);
    navigate(`/visits/${detail.visit.id}`, { replace: true });
  }

  return (
    <div>
      <PageHeader eyebrow="EDIT" title="编辑探店" description={`记录编号：${id ?? "未知"}`} />
      {state.status === "loading" ? <LoadingState label="正在加载探店记录" /> : null}
      {state.status === "notFound" ? <ErrorState title="没有找到记录" message="这条探店记录可能已经被删除。" /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <VisitForm
          mode="edit"
          initialValues={state.values}
          draftId={state.draftId}
          visitId={state.visitId}
          submitLabel="保存修改"
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
