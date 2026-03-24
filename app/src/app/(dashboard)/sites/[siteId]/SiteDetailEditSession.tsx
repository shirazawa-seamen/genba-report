"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditSiteForm, type SiteEditDraft } from "./EditSiteForm";
import {
  deleteSite,
  saveSiteEditDraft,
} from "../actions";
import {
  ProcessManager,
  type SiteProcessDraftItem,
} from "@/components/sites/ProcessManager";
import {
  WorkPeriodManager,
  type WorkPeriodDraftItem,
} from "@/components/sites/WorkPeriodManager";
import {
  SetupCheckList,
  type SetupCheckDraft,
} from "@/components/sites/SetupCheckList";
import { MaterialManager } from "@/components/sites/MaterialManager";
import { DocumentManager } from "@/components/sites/DocumentManager";
import type { ProcessCategoryRecord } from "@/lib/processCategories";
import type { ProcessTemplateRecord } from "@/lib/processTemplateTypes";

interface SiteDetailEditSessionProps {
  siteId: string;
  initialSiteDraft: SiteEditDraft;
  companyOptions: { id: string; name: string }[];
  initialChecks: SetupCheckDraft;
  initialProcesses: SiteProcessDraftItem[];
  initialPeriods: WorkPeriodDraftItem[];
  processTemplates: ProcessTemplateRecord[];
  processCategories: ProcessCategoryRecord[];
}

export function SiteDetailEditSession({
  siteId,
  initialSiteDraft,
  companyOptions,
  initialChecks,
  initialProcesses,
  initialPeriods,
  processTemplates,
  processCategories,
}: SiteDetailEditSessionProps) {
  const router = useRouter();
  const [siteDraft, setSiteDraft] = useState(initialSiteDraft);
  const [checks, setChecks] = useState(initialChecks);
  const [processes, setProcesses] = useState(initialProcesses);
  const [periods, setPeriods] = useState(initialPeriods);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    startSaveTransition(async () => {
      const result = await saveSiteEditDraft({
        siteId,
        name: siteDraft.name,
        siteNumber: siteDraft.siteNumber,
        address: siteDraft.address,
        companyId: siteDraft.companyId || undefined,
        startDate: siteDraft.startDate,
        endDate: siteDraft.endDate,
        siteColor: siteDraft.siteColor,
        hasBlueprint: checks.has_blueprint,
        hasSpecification: checks.has_specification,
        hasPurchaseOrder: checks.has_purchase_order,
        hasSchedule: checks.has_schedule,
        isMonitor: false,
        processes: processes.map((process) => ({
          id: process.id.startsWith("draft-process-") ? undefined : process.id,
          category: process.category,
          name: process.name,
        })),
        workPeriods: periods.map((period) => ({
          id: period.id.startsWith("draft-period-") ? undefined : period.id,
          startDate: period.startDate,
          endDate: period.endDate,
        })),
      });

      if (!result.success) {
        setError(result.error ?? "保存に失敗しました");
        return;
      }

      router.replace(`/sites/${siteId}`);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteSite(siteId);
      if (!result.success) {
        setError(result.error ?? "削除に失敗しました");
        setShowDeleteConfirm(false);
        return;
      }
      router.push("/sites");
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-8">
        <EditSiteForm
          draft={siteDraft}
          companyOptions={companyOptions}
          onChange={setSiteDraft}
          error={error}
        />
      </div>

      <div className="mb-8">
        <ProcessManager
          siteId={siteId}
          processes={processes}
          onChange={setProcesses}
          canManage
          initialTemplates={processTemplates}
          categoryOptions={processCategories}
        />
      </div>

      <div className="mb-8">
        <WorkPeriodManager periods={periods} onChange={setPeriods} canManage />
      </div>

      <div className="mb-6">
        <SetupCheckList checks={checks} onChange={setChecks} />
      </div>

      <div className="mb-6">
        <MaterialManager siteId={siteId} canManage={false} />
      </div>

      <div className="mb-6">
        <DocumentManager siteId={siteId} canManage={false} />
      </div>

      {error ? (
        <p className="mb-4 text-[13px] text-red-400">{error}</p>
      ) : null}

      <div className="mb-8 flex gap-2.5">
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-1"
        >
          削除
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          loading={isSaving}
          className="flex-1"
        >
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>

      {showDeleteConfirm && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5">
              <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-[16px] font-bold text-gray-900">
                  現場を削除しますか？
                </h3>
                <p className="mb-6 text-[13px] text-gray-400">
                  この操作は取り消せません。
                </p>
                {error ? <p className="mb-4 text-[13px] text-red-400">{error}</p> : null}
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    loading={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? "削除中..." : "削除する"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
