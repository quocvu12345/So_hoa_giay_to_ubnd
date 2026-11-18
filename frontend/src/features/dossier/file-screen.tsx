"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FolderPlus, Search } from "lucide-react";
import { createDossierInline, fileDocument, loadDossierComponents, searchDossiers, type Direction, type DossierComponents } from "@/app/actions/file-dossier";
import type { ProcedureSummary } from "@/app/actions/procedure";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Section } from "@/components/ui/blocks";
import { Chip, WorkflowChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { WORKFLOW_LABELS, type WorkflowState } from "@/lib/mock/data";
import { useServerAction } from "@/lib/use-server-action";
import type { DossierListItem } from "./dossier-data";
import { ProcedurePicker } from "./procedure-picker";

export type FileScreenProps = {
  document: {
    id: string;
    title: string;
    fileName: string;
    reviewStatus: string;
    groupCode: string | null;
    existing: { id: string; code: string; title: string }[];
  };
  suggestions: DossierListItem[];
  groups: { code: string; title: string }[];
};

const ACCEPTING = ["draft", "returned"];

function StatusChip({ item }: { item: Pick<DossierListItem, "status" | "statusLabel"> }) {
  return item.status in WORKFLOW_LABELS ? <WorkflowChip state={item.status as WorkflowState} /> : <Chip>{item.statusLabel}</Chip>;
}

/**
 * Bước 3 · Xếp vào hồ sơ (FE-24): chọn hồ sơ gợi ý hoặc tìm hồ sơ khác, hoặc tạo hồ sơ mới ngay tại đây.
 * "Lưu và mở PDF tiếp theo" chuyển thẳng sang đối chiếu PDF đã đọc xong kế tiếp, không quay về danh sách.
 */
export function FileScreen({ document: doc, suggestions, groups }: FileScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const searchId = useId();
  const directionId = useId();
  const [extra, setExtra] = useState<DossierListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(suggestions.find((s) => ACCEPTING.includes(s.status))?.id ?? null);
  const [direction, setDirection] = useState<Direction>("incoming");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DossierListItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  // Hồ sơ làm theo thủ tục: chọn giấy tờ này đáp ứng thành phần nào (FE-24). Cả thành phần đã tải lẫn lựa chọn đi kèm mã hồ sơ,
  // nên đổi hồ sơ là tự bỏ chúng (không cần đặt lại trạng thái trong effect).
  const [loaded, setLoaded] = useState<{ dossierId: string; data: DossierComponents | null } | null>(null);
  const [pick, setPick] = useState<{ dossierId: string; componentId: string } | null>(null);

  const search = useServerAction(searchDossiers);
  const file = useServerAction(fileDocument);

  // Tìm sau khi ngừng gõ 300 ms. Kết quả về muộn của lần gõ cũ bị bỏ để không ghi đè kết quả mới hơn.
  useEffect(() => {
    const text = query.trim();
    let stale = false;
    const timer = setTimeout(async () => {
      if (text.length < 2) {
        setResults(null);
        return;
      }
      const outcome = await search.run(text);
      if (!stale && outcome.ok) setResults(outcome.data);
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // `search.run` đổi theo mỗi lần render của hook; chỉ cần chạy lại khi câu hỏi đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Đổi hồ sơ được chọn thì tải lại thành phần của hồ sơ đó; kết quả về muộn của hồ sơ trước bị bỏ.
  useEffect(() => {
    if (!selected) return;
    let stale = false;
    loadDossierComponents(selected)
      .then((outcome) => {
        if (!stale && outcome.ok) setLoaded({ dossierId: selected, data: outcome.data });
      })
      .catch(() => {});       // chỉ là tiện ích: không tải được thì vẫn xếp được, không gán thành phần
    return () => {
      stale = true;
    };
  }, [selected]);

  const listed = new Map<string, DossierListItem>();
  for (const item of [...extra, ...suggestions, ...(results ?? [])]) listed.set(item.id, item);
  const choices = [...listed.values()];
  const selectedItem = selected ? listed.get(selected) : undefined;
  const components = loaded && loaded.dossierId === selected ? loaded.data : null;
  const componentId = pick && pick.dossierId === selected ? pick.componentId : "";

  async function save(openNext: boolean) {
    if (!selectedItem) return;
    const outcome = await file.run({ documentId: doc.id, dossierId: selectedItem.id, dossierCode: selectedItem.code, direction, openNext, procedureComponentId: componentId || null });
    if (!outcome.ok) return;
    toast.success(`Đã xếp “${doc.fileName}” vào hồ sơ ${selectedItem.code}.`);
    if (openNext && outcome.data.nextDocumentId) router.push(routes.intakeReview(outcome.data.nextDocumentId));
    else {
      if (openNext) toast.info("Không còn PDF nào đã đọc xong trong hộp tiếp nhận.");
      router.push(routes.intake);
    }
  }

  return (
    <>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <h1 className="text-xl font-bold break-all">Xếp “{doc.fileName}” vào hồ sơ</h1>
        <p className="text-[13px] text-muted">Gợi ý: hồ sơ cùng nhóm, đang chuẩn bị, trong phạm vi của bạn. Không thấy hồ sơ cần xếp thì tìm theo mã hoặc tên, hoặc tạo hồ sơ mới.</p>
      </div>

      <div className="grid gap-4 px-4 py-5 sm:px-6">
        {doc.reviewStatus !== "verified" && (
          <p className="flex flex-wrap items-center gap-2 border border-warn bg-warn-soft p-3 text-sm text-warn" role="status">
            <AlertTriangle aria-hidden className="size-4 flex-none" /> Giấy tờ này chưa đối chiếu xong. Hồ sơ chỉ nộp được khi mọi giấy tờ đã đối chiếu.
            <Link href={routes.intakeReview(doc.id)} className="font-semibold text-primary hover:underline">Quay lại đối chiếu</Link>
          </p>
        )}
        {doc.existing.length > 0 && (
          <p className="border border-line bg-soft p-3 text-sm" role="status">
            Giấy tờ này đã nằm trong: {doc.existing.map((d, i) => (
              <span key={d.id}>{i > 0 && ", "}<span className="font-mono">{d.code}</span> {d.title}</span>
            ))}. Có thể xếp thêm vào hồ sơ khác.
          </p>
        )}

        <Section title="Chọn hồ sơ" description={suggestions.length === 0 ? "Chưa có hồ sơ gợi ý cho nhóm này." : undefined}>
          <div className="flex items-center gap-2 border border-line px-3 focus-within:border-primary">
            <Search aria-hidden className="size-4 flex-none text-muted" />
            <label htmlFor={searchId} className="sr-only">Tìm hồ sơ khác theo mã hoặc tên</label>
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm hồ sơ khác theo mã hoặc tên…" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {search.pending ? "Đang tìm…" : results ? (results.length === 0 ? "Không có hồ sơ nào khớp trong phạm vi của bạn." : `${results.length} hồ sơ khớp.`) : ""}
          </p>

          {choices.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="sr-only">Chọn hồ sơ</legend>
              {choices.map((d) => {
                const ok = ACCEPTING.includes(d.status);
                return (
                  <label key={d.id} className={cn("flex flex-wrap items-center gap-3 border border-line p-3 has-checked:border-primary has-checked:bg-accent-soft", ok ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                    <input type="radio" name="dossier" value={d.id} checked={selected === d.id} disabled={!ok} onChange={() => setSelected(d.id)} className="accent-primary" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-mono text-xs text-muted">{d.code} · {d.workGroupCode} {d.workGroupTitle}</span>
                      <span className="font-semibold">{d.title}</span>
                      {!ok && <span className="text-xs text-warn">Hồ sơ đang ở bước “{d.statusLabel}”, không thêm giấy tờ được.</span>}
                    </span>
                    <span className="text-xs text-muted tabular-nums">{d.documentCount} giấy tờ</span>
                    <StatusChip item={d} />
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Chưa chọn được hồ sơ nào. Tìm hồ sơ khác ở ô trên hoặc tạo hồ sơ mới.</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label htmlFor={directionId} className="flex items-center gap-2">
              Chiều luân chuyển
              <select id={directionId} value={direction} onChange={(e) => setDirection(e.target.value as Direction)} className="h-9 border border-line-strong bg-surface px-2">
                <option value="incoming">Đến</option>
                <option value="outgoing">Đi</option>
                <option value="internal">Nội bộ</option>
              </select>
            </label>
            <Button size="sm" onClick={() => setCreating(true)}>
              <FolderPlus aria-hidden className="size-4" /> Tạo hồ sơ mới
            </Button>
          </div>

          {components && (
            <Select
              label={`Thành phần của thủ tục “${components.procedureName}”`}
              value={componentId}
              onChange={(e) => selected && setPick({ dossierId: selected, componentId: e.target.value })}
              hint="Hồ sơ này làm theo thủ tục. Chọn thành phần mà giấy tờ đang xếp đáp ứng để hồ sơ tính đủ thành phần; bỏ trống thì gán sau ở tab Giấy tờ."
              fieldClassName="max-w-xl"
            >
              <option value="">Chưa gán thành phần</option>
              {components.components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.required ? " · bắt buộc" : ""}{c.filled > 0 ? ` · đã có ${c.filled} giấy tờ` : ""}
                </option>
              ))}
            </Select>
          )}
        </Section>

        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href={routes.intakeReview(doc.id)}>← Quay lại đối chiếu</ButtonLink>
          <Button onClick={() => save(false)} disabled={!selectedItem || file.pending} aria-busy={file.pending}>Lưu</Button>
          <Button variant="primary" onClick={() => save(true)} disabled={!selectedItem || file.pending} aria-busy={file.pending}>
            {file.pending ? "Đang lưu…" : "Lưu và mở PDF tiếp theo"}
          </Button>
        </div>
      </div>

      <CreateDossierDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaultTitle={doc.title}
        defaultGroup={doc.groupCode ?? ""}
        groups={groups}
        onCreated={(created) => {
          setExtra((current) => [created, ...current]);
          setSelected(created.id);
          setCreating(false);
          toast.success(`Đã tạo hồ sơ ${created.code}. Bấm Lưu để xếp giấy tờ vào hồ sơ này.`);
        }}
      />
    </>
  );
}

function CreateDossierDialog({
  open,
  onClose,
  defaultTitle,
  defaultGroup,
  groups,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultTitle: string;
  defaultGroup: string;
  groups: { code: string; title: string }[];
  onCreated: (created: DossierListItem) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [group, setGroup] = useState(defaultGroup);
  const [notes, setNotes] = useState("");
  const [procedure, setProcedure] = useState<ProcedureSummary | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Hộp thoại modal làm phần còn lại của trang bị vô hiệu (kể cả vùng toast), nên lỗi hiện ngay trong hộp thoại.
  const create = useServerAction(createDossierInline, { toastErrors: false });
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    const found: Record<string, string> = {};
    if (title.trim().length < 5) found.title = "Tên hồ sơ cần ít nhất 5 ký tự.";
    if (!group) found.workGroupCode = "Chọn nhóm hồ sơ.";
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    const outcome = await create.run({ title, workGroupCode: group, notes, procedureId: procedure?.id ?? null });
    if (outcome.ok) {
      onCreated(outcome.data);
      return;
    }
    if (outcome.fieldErrors) setErrors(Object.fromEntries(Object.entries(outcome.fieldErrors).map(([k, v]) => [k, v[0]])));
    else setFailure(outcome.errorId ? `${outcome.message} (Mã lỗi: ${outcome.errorId})` : outcome.message);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo hồ sơ mới"
      description="Mã hồ sơ do hệ thống cấp. Tạo xong, hồ sơ được chọn sẵn để xếp giấy tờ này vào."
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={create.pending} aria-busy={create.pending}>{create.pending ? "Đang tạo…" : "Tạo hồ sơ"}</Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Tên hồ sơ" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <Select
          label="Nhóm hồ sơ"
          required
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          error={errors.workGroupCode}
          hint={groups.length === 0 ? "Phân công đang dùng không có nhóm hồ sơ nào để tạo." : "Chỉ hiện các nhóm thuộc đơn vị của phân công đang dùng."}
        >
          <option value="">Chọn nhóm…</option>
          {groups.map((g) => (
            <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
          ))}
        </Select>
        <ProcedurePicker value={procedure} onChange={setProcedure} />
        <Textarea label="Ghi chú (tùy chọn)" rows={2} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {failure && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{failure}</p>}
      </form>
    </Dialog>
  );
}
