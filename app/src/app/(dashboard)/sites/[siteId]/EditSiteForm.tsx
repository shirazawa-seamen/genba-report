"use client";

import { Input } from "@/components/ui/input";

export interface SiteEditDraft {
  name: string;
  siteNumber: string;
  address: string;
  companyId: string;
  startDate: string;
  endDate: string;
  siteColor: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface EditSiteFormProps {
  draft: SiteEditDraft;
  companyOptions: CompanyOption[];
  onChange: (next: SiteEditDraft) => void;
  error?: string | null;
}

export function EditSiteForm({
  draft,
  companyOptions,
  onChange,
  error,
}: EditSiteFormProps) {
  const presetColors = ["#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-gray-600">現場情報を編集</h3>
      </div>
      <div className="flex flex-col gap-4">
        <Input
          label="現場名"
          placeholder="例：○○ビル新築工事"
          value={draft.name}
          onChange={(event) =>
            onChange({ ...draft, name: event.target.value })
          }
          required
        />
        <Input
          label="現場番号"
          placeholder="例：S-2026-001"
          value={draft.siteNumber}
          onChange={(event) =>
            onChange({ ...draft, siteNumber: event.target.value })
          }
        />
        <Input
          label="住所"
          placeholder="例：東京都千代田区..."
          value={draft.address}
          onChange={(event) =>
            onChange({ ...draft, address: event.target.value })
          }
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-500">会社名</label>
          <div className="relative">
            <select
              value={draft.companyId}
              onChange={(event) =>
                onChange({ ...draft, companyId: event.target.value })
              }
              className="w-full min-h-[44px] appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[16px] text-gray-900 transition-all duration-150 focus:border-[#0EA5E9]/50 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/20"
            >
              <option value="">会社を選択してください</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-gray-500">現場カラー</span>
          <div className="flex flex-wrap gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...draft, siteColor: color })}
                className={`h-8 w-8 rounded-full border-2 ${draft.siteColor === color ? "border-gray-900" : "border-white shadow-sm"}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={draft.siteColor}
              onChange={(event) => onChange({ ...draft, siteColor: event.target.value })}
              className="h-8 w-10 rounded border border-gray-200 bg-white"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Input
            label="着工日"
            type="date"
            value={draft.startDate}
            onChange={(event) =>
              onChange({ ...draft, startDate: event.target.value })
            }
          />
          <Input
            label="完工予定日"
            type="date"
            value={draft.endDate}
            onChange={(event) =>
              onChange({ ...draft, endDate: event.target.value })
            }
          />
        </div>
        {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
