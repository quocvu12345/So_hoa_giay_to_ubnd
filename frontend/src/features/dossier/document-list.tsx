"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FilePlus2, FileText, Trash2 } from "lucide-react";
import { addDocuments, findDocuments, loadReadyInbox, placeDocuments, removeDocument, type Direction, type FoundDocument } from "@/app/actions/dossier";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/blocks";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import type { InboxItem } from "@/features/intake/inbox-data";
import { formatDate } from "@/lib/format";
import { useServerAction } from "@/lib/use-server-action";
import type { DossierDocument } from "./dossier-data";

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "incoming", label: "Đến" },
  { value: "outgoing", label: "Đi" },
  { value: "internal", label: "Nội bộ" },
];

/** Tình trạng đối chiếu của một giấy tờ trong hồ sơ, cùng cách tính với API (checklist). Luôn có chữ. */
export function reviewState(doc: Pick<DossierDocument, "reviewStatus" | "pendingFields" | "metadataStatus">): { tone: "ok" | "warn"; text: string } {
  if (doc.reviewStatus === "verified" && doc.pendingFields === 0 && doc.metadataStatus !== "needs_review") return { tone: "ok", text: "Đã đối chiếu" };
  if (doc.pendingFields > 0) return { tone: "warn", text: `${doc.pendingFields} trường chưa xác nhận` };
  if (doc.metadataStatus === "needs_review") return { tone: "warn", text: "Cần xác nhận lại đầu văn bản" };
  return { tone: "warn", text: "Chưa đối chiếu" };
}

/**
 * Giấy tờ trong hồ sơ (FE-29): theo thứ tự, đổi thứ tự bằng nút lên/xuống (dùng được bằng bàn phím), đổi chiều đến/đi/nội bộ,
 * gỡ (giấy tờ quay về hộp tiếp nhận), thêm từ hộp tiếp nhận. Chỉ sửa được ở bước Đang chuẩn bị / Yêu cầu bổ sung.
 * Hồ sơ làm theo thủ tục có thêm cột "Thành phần": gán giấy tờ vào thành phần của thủ tục (hoặc bỏ gán) để hồ sơ tính đủ thành phần.
 */
export type ComponentOption = { id: string; name: string; required: boolean };

export function DocumentList({ dossierId, documents, editable, components = [] }: { dossierId: string; documents: DossierDocument[]; editable: boolean; components?: ComponentOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const place = useServerAction(placeDocuments);
  const remove = useServerAction(removeDocument);
  const [adding, setAdding] = useState(false);
  const ordered = [...documents].sort((a, b) => a.position - b.position);

  async function move(index: number, delta: -1 | 1) {
    const a = ordered[index];
    const b = ordered[index + delta];
    if (!a || !b) return;
    const outcome = await place.run(dossierId, [
      { documentId: a.documentId, position: b.position },
      { documentId: b.documentId, position: a.position },
    ]);
    if (outcome.ok) router.refresh();
  }

  async function changeComponent(doc: DossierDocument, componentId: string) {
    const outcome = await place.run(dossierId, [componentId ? { documentId: doc.documentId, procedureComponentId: componentId } : { documentId: doc.documentId, clearComponent: true }]);
    if (outcome.ok) router.refresh();
  }

  async function changeDirection(doc: DossierDocument, direction: Direction) {
    const outcome = await place.run(dossierId, [{ documentId: doc.documentId, direction }]);
    if (outcome.ok) router.refresh();
  }

  async function onRemove(doc: DossierDocument) {
    const outcome = await remove.run(dossierId, doc.documentId);
    if (!outcome.ok) return;
    toast.success(`Đã gỡ “${doc.title}” khỏi hồ sơ. Giấy tờ về hộp tiếp nhận.`);
    router.refresh();
  }

  const busy = place.pending || remove.pending;

  return (
    <div className="grid gap-3">
      {editable && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setAdding(true)}>
            <FilePlus2 aria-hidden className="size-4" /> Thêm giấy tờ
          </Button>
        </div>
      )}

      {ordered.length === 0 ? (
        <EmptyState icon={FileText} title="Hồ sơ chưa có giấy tờ" action={editable ? <ButtonLink href={routes.intakeUpload}>Nạp PDF mới</ButtonLink> : undefined}>
          {editable ? "Thêm giấy tờ đã đọc xong từ hộp tiếp nhận, hoặc nạp PDF mới rồi xếp vào hồ sơ này." : "Hồ sơ này chưa có giấy tờ."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className={components.length > 0 ? "w-full min-w-[980px] text-sm" : "w-full min-w-[760px] text-sm"}>
            <caption className="sr-only">Giấy tờ trong hồ sơ theo thứ tự, {ordered.length} giấy tờ</caption>
            <thead className="bg-soft text-left text-[13px] text-heading">
              <tr>
                <th scope="col" className="w-12 px-3 py-2 font-semibold">STT</th>
                <th scope="col" className="px-3 py-2 font-semibold">Giấy tờ</th>
                <th scope="col" className="px-3 py-2 font-semibold">Số, ngày</th>
                <th scope="col" className="px-3 py-2 font-semibold">Chiều</th>
                {components.length > 0 && <th scope="col" className="px-3 py-2 font-semibold">Thành phần</th>}
                <th scope="col" className="px-3 py-2 font-semibold">Đối chiếu</th>
                {editable && <th scope="col" className="px-3 py-2 text-right font-semibold">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {ordered.map((doc, index) => {
                const state = reviewState(doc);
                return (
                  <tr key={doc.documentId} className="border-t border-line align-top">
                    <td className="px-3 py-2.5 tabular-nums">{doc.position}</td>
                    <td className="px-3 py-2.5">
                      <Link href={routes.document(doc.documentId)} className="font-semibold text-primary hover:underline">{doc.title}</Link>
                      <span className="block text-xs text-muted">{doc.documentForm}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {doc.documentNumber ?? "—"}
                      <span className="block text-xs text-muted">{formatDate(doc.issuedOn)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {editable ? (
                        <select
                          aria-label={`Chiều luân chuyển của ${doc.title}`}
                          value={doc.direction ?? ""}
                          disabled={busy}
                          onChange={(e) => e.target.value && void changeDirection(doc, e.target.value as Direction)}
                          className="h-8 border border-line-strong bg-surface px-1 text-[13px]"
                        >
                          {!doc.direction && <option value="">Chưa chọn</option>}
                          {DIRECTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      ) : (
                        (DIRECTIONS.find((d) => d.value === doc.direction)?.label ?? "—")
                      )}
                    </td>
                    {components.length > 0 && (
                      <td className="px-3 py-2.5">
                        {editable ? (
                          <select
                            aria-label={`Thành phần của thủ tục mà ${doc.title} đáp ứng`}
                            value={doc.procedureComponentId ?? ""}
                            disabled={busy}
                            onChange={(e) => void changeComponent(doc, e.target.value)}
                            className="h-8 max-w-56 border border-line-strong bg-surface px-1 text-[13px]"
                          >
                            <option value="">Chưa gán</option>
                            {components.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}{c.required ? " · bắt buộc" : ""}</option>
                            ))}
                          </select>
                        ) : (
                          (components.find((c) => c.id === doc.procedureComponentId)?.name ?? "Chưa gán")
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <Chip tone={state.tone}>{state.text}</Chip>
                      {state.tone !== "ok" && editable && (
                        <Link href={routes.intakeReview(doc.documentId)} className="mt-1 block text-xs font-semibold text-primary hover:underline">Đối chiếu</Link>
                      )}
                    </td>
                    {editable && (
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label={`Chuyển ${doc.title} lên trên`}>
                            <ArrowUp aria-hidden className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void move(index, 1)} disabled={busy || index === ordered.length - 1} aria-label={`Chuyển ${doc.title} xuống dưới`}>
                            <ArrowDown aria-hidden className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void onRemove(doc)} disabled={busy} aria-label={`Gỡ ${doc.title} khỏi hồ sơ`}>
                            <Trash2 aria-hidden className="size-4" /> Gỡ
                          </Button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">{busy ? "Đang lưu thay đổi" : ""}</p>

      {/* Chỉ dựng khi đang mở: mỗi lần mở là một lần tải mới và trạng thái (đã chọn, ô tìm) tự làm mới, không phải đặt lại bằng tay. */}
      {adding && <AddFromInboxDialog open onClose={() => setAdding(false)} dossierId={dossierId} existing={new Set(documents.map((d) => d.documentId))} />}
    </div>
  );
}

function AddFromInboxDialog({ open, onClose, dossierId, existing }: { open: boolean; onClose: () => void; dossierId: string; existing: Set<string> }) {
  const router = useRouter();
  const toast = useToast();
  const listId = useId();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const load = useServerAction(loadReadyInbox);
  // Hộp thoại modal làm vùng toast bị vô hiệu: lỗi hiện ngay trong hộp thoại.
  const add = useServerAction(addDocuments, { toastErrors: false });
  const [failure, setFailure] = useState<string | null>(null);
  // Giấy tờ ĐÃ CÓ (đã đối chiếu, nằm ở hồ sơ khác hoặc công khai): tìm bằng tra cứu rồi chọn chung với PDF trong hộp tiếp nhận (FE-29).
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundDocument[] | null>(null);
  const [known, setKnown] = useState<Map<string, FoundDocument>>(new Map());
  const [finding, setFinding] = useState(false);

  // Tìm sau khi ngừng gõ 300 ms; kết quả về muộn của lần gõ cũ bị bỏ để không ghi đè kết quả mới hơn.
  useEffect(() => {
    const text = query.trim();
    let stale = false;
    const timer = setTimeout(async () => {
      if (text.length < 2) {
        setFound(null);
        setFinding(false);
        return;
      }
      setFinding(true);
      const outcome = await findDocuments(text).catch(() => null);
      if (stale) return;
      setFinding(false);
      if (outcome?.ok) {
        setFound(outcome.data);
        setKnown((current) => new Map([...current, ...outcome.data.map((d): [string, FoundDocument] => [d.documentId, d])]));
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Tải danh sách PDF đã đọc xong đúng MỘT lần khi hộp thoại mở. (Trước đây gọi Server Action ngay trong lúc render nên lặp vô hạn, hàng trăm lần mỗi giây.)
  useEffect(() => {
    let stale = false;
    void load.run().then((outcome) => {
      if (!stale && outcome.ok) setItems(outcome.data);
    });
    return () => {
      stale = true;
    };
    // `load.run` đổi theo mỗi lần render của hook; chỉ cần chạy một lần khi hộp thoại được dựng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const available = (items ?? []).filter((i) => !existing.has(i.documentId));

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setFailure(null);
    const outcome = await add.run(dossierId, [...picked]);
    if (!outcome.ok) {
      setFailure(outcome.errorId ? `${outcome.message} (Mã lỗi: ${outcome.errorId})` : outcome.message);
      return;
    }
    const { added, failures } = outcome.data;
    if (failures.length > 0) {
      setFailure(`Đã thêm ${added}; ${failures.length} giấy tờ chưa thêm được: ${failures.map((f) => f.message).join(" ")}`);
      setPicked(new Set(failures.map((f) => f.documentId)));
    } else {
      toast.success(`Đã thêm ${added} giấy tờ vào hồ sơ.`);
      onClose();
    }
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thêm giấy tờ vào hồ sơ"
      description="Chọn PDF đã đọc xong trong hộp tiếp nhận, hoặc tìm giấy tờ đã có (đã đối chiếu, nằm ở hồ sơ khác hoặc văn bản công khai). Thêm xong, đối chiếu từng giấy tờ chưa đối chiếu."
      className="w-[min(40rem,calc(100vw-2rem))]"
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={picked.size === 0 || add.pending} aria-busy={add.pending}>
            {add.pending ? "Đang thêm…" : `Thêm ${picked.size || ""} giấy tờ`}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        {load.pending && <p className="text-sm text-muted" role="status">Đang tải danh sách…</p>}
        {items && available.length === 0 && <p className="border border-dashed border-line-strong p-4 text-sm text-muted">Không có PDF nào đã đọc xong để thêm. Nạp PDF ở màn Nạp PDF, đợi AI đọc xong rồi quay lại.</p>}
        {available.length > 0 && (
          <fieldset className="grid max-h-[50vh] gap-1.5 overflow-auto">
            <legend className="sr-only" id={listId}>Chọn giấy tờ cần thêm</legend>
            {available.map((item) => (
              <label key={item.documentId} className="flex cursor-pointer items-start gap-3 border border-line p-2.5 has-checked:border-primary has-checked:bg-accent-soft">
                <input type="checkbox" checked={picked.has(item.documentId)} onChange={() => toggle(item.documentId)} className="mt-1 size-4 accent-primary" />
                <span className="grid min-w-0 gap-0.5 text-sm">
                  <span className="font-semibold break-all">{item.fileName}</span>
                  <span className="text-xs text-muted">{item.suggestion ?? "Chưa có gợi ý"} · {item.pageCount ?? "?"} trang</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="mt-2 grid gap-2 border-t border-line pt-3">
          <Input
            label="Hoặc tìm giấy tờ đã có"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Số ký hiệu, trích yếu hoặc nội dung…"
            hint="Chỉ hiện giấy tờ bạn được xem. Giấy tờ đã nằm trong hồ sơ khác vẫn thêm được (dùng chung)."
          />
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {finding ? "Đang tìm…" : found ? (found.filter((d) => !existing.has(d.documentId)).length === 0 ? "Không có giấy tờ nào khớp, hoặc đã nằm trong hồ sơ này." : `${found.filter((d) => !existing.has(d.documentId)).length} giấy tờ khớp.`) : ""}
          </p>
          {found && found.some((d) => !existing.has(d.documentId)) && (
            <fieldset className="grid max-h-[30vh] gap-1.5 overflow-auto">
              <legend className="sr-only">Giấy tờ đã có, chọn để thêm</legend>
              {found.filter((d) => !existing.has(d.documentId)).map((doc) => (
                <label key={doc.documentId} className="flex cursor-pointer items-start gap-3 border border-line p-2.5 has-checked:border-primary has-checked:bg-accent-soft">
                  <input type="checkbox" checked={picked.has(doc.documentId)} onChange={() => toggle(doc.documentId)} className="mt-1 size-4 accent-primary" />
                  <span className="grid min-w-0 gap-0.5 text-sm">
                    <span className="font-semibold">{doc.title}</span>
                    <span className="text-xs text-muted">
                      {[doc.number, doc.subtitle, doc.issuedOn ? formatDate(doc.issuedOn) : null].filter(Boolean).join(" · ") || "Chưa có số ký hiệu"}
                      {doc.inDossiers.length > 0 && ` · đang ở hồ sơ ${doc.inDossiers.join(", ")}`}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {[...picked].some((id) => known.has(id) && !items?.some((i) => i.documentId === id)) && (
            <p className="text-xs text-muted">Đã chọn: {[...picked].filter((id) => known.has(id) && !items?.some((i) => i.documentId === id)).map((id) => known.get(id)!.title).join("; ")}</p>
          )}
        </div>
        {failure && <p role="alert" className="border border-bad bg-bad-soft p-2 text-sm text-bad">{failure}</p>}
      </div>
    </Dialog>
  );
}
