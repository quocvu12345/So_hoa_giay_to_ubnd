"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RotateCw, Scissors, Trash2 } from "lucide-react";
import { discardDocument } from "@/app/actions/intake";
import { applyClassification, confirmReview, loadDocumentTypes, retryPage } from "@/app/actions/review";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Chip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { useServerEvent } from "@/lib/events/server-events";
import { useServerAction } from "@/lib/use-server-action";
import { ExtractNowButton } from "@/features/intake/extract-now-button";
import { progressLabel, type LiveProgress } from "@/features/intake/inbox-live";
import { PageViewer, type Highlight } from "./page-viewer";
import { regionTarget } from "./source-region";
import {
  buildFieldEdits,
  buildMetaPayload,
  draftStorageKey,
  draftsEqual,
  initialDraft,
  mergeDraft,
  orderFields,
  parseDraft,
  pendingAttention,
  serializeDraft,
  validateDraft,
  validateField,
  type DocumentTypeInfo,
  type ReviewData,
  type ReviewDraft,
  type ReviewErrors,
  type ReviewField,
} from "./review-state";

export type GroupOption = { code: string; title: string };

type Props = {
  data: ReviewData;
  groups: GroupOption[];
  /** Loại giấy tờ của nhóm đang chọn (đã xác nhận hoặc gợi ý của AI). */
  types: DocumentTypeInfo[];
  canExtract: boolean;
  /** Số PDF khác đã đọc xong đang chờ trong hộp tiếp nhận, để người dùng biết còn bao nhiêu việc. */
  othersReady: number;
};

const AUTOSAVE_MS = 5000;
const FORM_SUGGESTIONS = ["Công văn", "Quyết định", "Tờ trình", "Kế hoạch", "Báo cáo", "Thông báo", "Biên bản", "Nghị quyết", "Giấy chứng nhận", "Hợp đồng", "Đơn", "Giấy mời"];
const META_KEYS = ["title", "documentForm", "documentNumber", "issuedOn", "note"] as const;

/**
 * Bước 2 · Đối chiếu (FE-23): bản gốc bên trái, thông tin bên phải. Trường cần xem lên đầu và phải được đánh dấu đã kiểm.
 * - Nháp tự lưu mỗi 5 giây vào sessionStorage (giữ khi hết phiên đăng nhập hoặc tải lại trang); rời trang khi còn thay đổi thì hỏi lại trong trang.
 * - Ctrl+Enter xác nhận và sang bước xếp hồ sơ.
 * - Một lần bấm xác nhận gửi lần lượt: loại giấy tờ (nếu chưa) → trường → đầu văn bản → đánh dấu đã đối chiếu.
 */
export function ReviewScreen({ data: serverData, groups, types: initialTypes, canExtract, othersReady }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(serverData);
  const baseline = useMemo(() => initialDraft(data), [data]);
  const [draft, setDraft] = useState<ReviewDraft>(baseline);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [olderScan, setOlderScan] = useState<{ label: string; fileId: string; page: number } | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [newerData, setNewerData] = useState<ReviewData | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [live, setLive] = useState<LiveProgress | null>(null);

  const doc = data.document;
  const docId = doc.id;
  const dirty = !draftsEqual(draft, baseline);
  const ordered = useMemo(() => orderFields(data.fields), [data.fields]);
  const attention = data.fields.filter((f) => f.attention).length;
  const pending = pendingAttention(data, draft);
  const savedType = doc.classification?.documentTypeCode ?? null;
  const suggestion = data.suggestion;
  const suggested = useMemo(
    () => (suggestion?.workGroupCode && suggestion.documentTypeCode ? { workGroupCode: suggestion.workGroupCode, documentTypeCode: suggestion.documentTypeCode } : null),
    [suggestion],
  );
  const effectiveType = savedType ?? suggested?.documentTypeCode ?? null;
  const jobActive = data.job?.status === "queued" || data.job?.status === "running";
  const pageCount = doc.file?.pageCount ?? 1;
  const canEdit = data.canEdit;

  const confirmAction = useServerAction(confirmReview, { toastErrors: false });
  const classifyAction = useServerAction(applyClassification);
  const typesAction = useServerAction(loadDocumentTypes);
  const discardAction = useServerAction(discardDocument);
  const retryAction = useServerAction(retryPage);

  // ---- dữ liệu máy chủ đổi (sau router.refresh, AI đọc xong) ----
  const [seen, setSeen] = useState(serverData);
  if (seen !== serverData) {
    setSeen(serverData);
    if (!dirty) {
      setData(serverData);
      setDraft(initialDraft(serverData));
    } else {
      setNewerData(serverData);
    }
  }

  // ---- nháp trong sessionStorage ----
  const storageKey = draftStorageKey(docId);
  const latest = useRef({ draft, dirty, version: doc.version });
  useEffect(() => {
    latest.current = { draft, dirty, version: doc.version };
  });

  useEffect(() => {
    try {
      const restored = parseDraft(sessionStorage.getItem(storageKey), serverData.document.version);
      if (restored && !draftsEqual(restored.draft, initialDraft(serverData))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage chỉ có ở trình duyệt; đọc ở lần render đầu sẽ lệch với HTML máy chủ gửi về
        setDraft(mergeDraft(initialDraft(serverData), restored.draft));
        setRestoredAt(restored.savedAt);
      }
    } catch {
      /* Không đọc được bộ nhớ phiên thì làm việc không có nháp. */
    }
    // Chỉ chạy một lần khi mở màn: dữ liệu máy chủ đổi về sau đã có nhánh riêng ở trên.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushDraft = useCallback(() => {
    try {
      const { draft: current, dirty: isDirty, version } = latest.current;
      if (isDirty) sessionStorage.setItem(storageKey, serializeDraft(version, current));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Bỏ qua. */
    }
  }, [storageKey]);

  useEffect(() => {
    const timer = setInterval(flushDraft, AUTOSAVE_MS);
    const onHide = () => document.visibilityState === "hidden" && flushDraft();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      flushDraft();
    };
  }, [flushDraft]);

  // ---- rời trang khi còn thay đổi chưa lưu ----
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // ---- tiến độ AI đọc giấy tờ này ----
  useServerEvent("job.progress", (event) => {
    if (event.documentId !== docId || event.processed == null) return;
    setLive({ processed: event.processed, pageCount: event.pageCount ?? null });
  });
  const onJobEnd = (event: { documentId: string | null }) => {
    if (event.documentId !== docId) return;
    setLive(null);
    router.refresh();
  };
  useServerEvent("job.completed", onJobEnd);
  useServerEvent("job.failed", onJobEnd);
  useServerEvent("job.cancelled", onJobEnd);

  // ---- đổi loại giấy tờ ----
  const [picker, setPicker] = useState({ open: !effectiveType, group: doc.classification?.workGroupCode ?? data.suggestion?.workGroupCode ?? "", type: effectiveType ?? "" });
  const [types, setTypes] = useState(initialTypes);
  const pickedDiffers = picker.type !== "" && picker.type !== effectiveType;

  async function onPickGroup(group: string) {
    setPicker((p) => ({ ...p, group, type: "" }));
    setTypes([]);
    if (!group) return;
    const outcome = await typesAction.run(group);
    if (outcome.ok) setTypes(outcome.data);
  }

  async function onApplyClassification(group: string, type: string) {
    const outcome = await classifyAction.run(docId, group, type);
    if (!outcome.ok) return;
    const next = outcome.data;
    setData(next);
    // Bộ trường đổi theo loại: lấy lại từ dữ liệu mới nhưng giữ phần đầu văn bản người dùng đã sửa.
    const fresh = initialDraft(next);
    setDraft((current) => ({ fields: fresh.fields, meta: current.meta }));
    setErrors({});
    setPicker({ open: false, group, type });
    toast.success(`Đã chọn loại “${next.document.classification?.documentTypeName ?? type}”. Kiểm tra lại các trường bên dưới.`);
  }

  // ---- sửa trường ----
  function setField(code: string, value: string) {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [code]: { value, confirmed: true } } }));
    setErrors((current) => (current[code] ? { ...current, [code]: "" } : current));
  }
  function setConfirmed(code: string, confirmed: boolean) {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [code]: { ...current.fields[code], confirmed } } }));
  }
  function setMeta(key: (typeof META_KEYS)[number], value: string) {
    setDraft((current) => ({ ...current, meta: { ...current.meta, [key]: value } }));
    setErrors((current) => (current[`meta.${key}`] ? { ...current, [`meta.${key}`]: "" } : current));
  }
  /** Bấm vào trường: nhảy tới trang nguồn và làm nổi vùng chứa giá trị (BE-114). Trường không có vùng thì bỏ khung cũ, không để khung của trường khác. */
  function jumpTo(field: ReviewField) {
    const { region, page: target, olderScanId } = regionTarget(field, doc.file?.id);
    if (target && target >= 1 && target <= pageCount && !olderScanId) setPage(target);
    setHighlight(region && region.page <= pageCount ? { region, label: field.label } : null);
    // BE-126: vùng của lần đọc cũ nằm trên bản quét đã được thay: nói rõ thay vì im lặng không có khung.
    setOlderScan(olderScanId ? { label: field.label, fileId: olderScanId, page: target ?? 1 } : null);
  }

  // ---- xác nhận ----
  const blockedReason = !canEdit
    ? (data.lockedReason ?? "Giấy tờ này không sửa được ở bước hiện tại.")
    : jobActive
      ? "AI đang đọc giấy tờ này. Chờ đọc xong rồi xác nhận."
      : !effectiveType
        ? "Chọn loại giấy tờ trước khi xác nhận."
        : pickedDiffers
          ? "Bạn đã chọn loại khác. Bấm “Áp dụng loại này” trước khi xác nhận."
          : pending.length > 0
            ? `Còn ${pending.length} trường cần xem: đánh dấu “đã kiểm” sau khi đối chiếu với bản gốc.`
            : null;

  const onConfirm = useCallback(async () => {
    if (blockedReason) {
      document.getElementById("trang-thai-xac-nhan")?.focus();
      return;
    }
    const found = validateDraft(data, draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = Object.keys(found)[0];
      document.getElementById(fieldDomId(docId, first))?.focus();
      return;
    }
    setErrors({});
    const outcome = await confirmAction.run({
      documentId: docId,
      classification: savedType ? undefined : (suggested ?? undefined),
      fields: buildFieldEdits(data, draft),
      meta: buildMetaPayload(draft.meta),
    });
    if (outcome.ok) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Bỏ qua. */
      }
      latest.current = { ...latest.current, dirty: false };
      toast.success("Đã đối chiếu xong. Xếp giấy tờ vào hồ sơ.");
      router.push(routes.intakeFile(docId));
      return;
    }
    const entries = Object.entries(outcome.fieldErrors ?? {});
    const mapped: ReviewErrors = {};
    for (const [key, messages] of entries) if ((META_KEYS as readonly string[]).includes(key)) mapped[`meta.${key}`] = messages[0];
    if (Object.keys(mapped).length > 0) {
      setErrors(mapped);
      document.getElementById(fieldDomId(docId, Object.keys(mapped)[0]))?.focus();
    }
    // Lỗi không gắn được vào ô nào (lỗi phiên bản, thiếu điều kiện xác nhận, lỗi máy chủ): báo bằng toast kèm lời giải thích của API.
    if (Object.keys(mapped).length < entries.length || entries.length === 0) toast.error(outcome.message, outcome.errorId);
    if (outcome.status === 409) router.refresh();
  }, [blockedReason, data, draft, docId, savedType, suggested, confirmAction, storageKey, toast, router]);

  // Ctrl+Enter ở bất cứ đâu trong màn.
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void confirmRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onDiscard() {
    const outcome = await discardAction.run(docId);
    if (!outcome.ok) return;
    latest.current = { ...latest.current, dirty: false };
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Bỏ qua. */
    }
    toast.success(`Đã bỏ “${doc.file?.name ?? doc.title}”. Hoàn tác được trong 30 ngày ở thẻ Đã bỏ của hộp tiếp nhận.`);
    router.push(routes.intake);
  }

  function discardDraft() {
    setDraft(baseline);
    setRestoredAt(null);
    setErrors({});
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Bỏ qua. */
    }
  }

  function loadNewer() {
    if (!newerData) return;
    setData(newerData);
    setDraft(initialDraft(newerData));
    setNewerData(null);
    discardDraft();
  }

  const reviewedAt = doc.metadataStatus === "header_checked" && doc.metadataReviewedAt ? new Date(doc.metadataReviewedAt) : null;

  return (
    <div className="grid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="grid gap-0.5">
          <h1 className="text-xl font-bold break-all">{doc.file?.name ?? doc.title}</h1>
          <p className="text-[13px] text-muted">
            {doc.file?.pageCount ?? "?"} trang · {othersReady > 0 ? `còn ${othersReady} PDF đã đọc xong trong hộp tiếp nhận` : "không còn PDF nào khác đã đọc xong"}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canExtract && !jobActive && data.job?.status !== "failed" && <ExtractNowButton scope="document" id={docId} force={data.job?.status === "completed"} />}
          <ButtonLink size="sm" href={routes.intakeSplit(docId)}>
            <Scissors aria-hidden className="size-4" /> Tách thành nhiều văn bản
          </ButtonLink>
        </div>
      </div>

      {(restoredAt || newerData) && (
        <div className="grid gap-2 border-b border-line bg-warn-soft px-4 py-2 text-[13px] sm:px-6" role="status">
          {restoredAt && (
            <p className="flex flex-wrap items-center gap-2">
              Đã khôi phục bản nháp chưa lưu từ {new Date(restoredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
              <Button size="sm" variant="ghost" onClick={discardDraft}>Bỏ nháp, dùng dữ liệu đã lưu</Button>
            </p>
          )}
          {newerData && (
            <p className="flex flex-wrap items-center gap-2">
              Dữ liệu trên máy chủ vừa đổi (AI đọc xong hoặc người khác sửa). Thay đổi của bạn chưa lưu được giữ nguyên.
              <Button size="sm" onClick={loadNewer}>Nạp dữ liệu mới, bỏ thay đổi của tôi</Button>
            </p>
          )}
        </div>
      )}

      <div className="grid min-h-[60vh] lg:grid-cols-2">
        <section aria-label="Bản gốc" className="grid content-start gap-3 border-b border-line bg-soft p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-auto lg:border-r lg:border-b-0">
          {doc.file ? (
            <>
              <PageViewer fileId={doc.file.id} pageCount={pageCount} page={page} onPageChange={setPage} highlight={highlight} />
              {olderScan && (
                <p role="status" className="text-xs text-muted">
                  Vùng chứa giá trị của “{olderScan.label}” nằm trên bản quét cũ (đã được thay), nên không vẽ khung lên bản hiện hành.{" "}
                  <Link href={`${routes.document(docId)}?trang=${olderScan.page}&tep=${olderScan.fileId}` as Route} className="text-primary hover:underline">Xem bản quét cũ</Link>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Giấy tờ này chưa có tệp để xem.</p>
          )}
          {data.job && !jobActive && data.job.status !== "failed" && (
            <div className="flex items-center gap-3 text-[13px] text-muted">
              <span>Đọc bằng OCR</span>
              <button
                type="button"
                disabled={retryAction.pending || !canEdit}
                onClick={async () => {
                  const outcome = await retryAction.run(data.job!.id, page);
                  if (outcome.ok) toast.info(`Đã gửi yêu cầu đọc lại trang ${page}. Kết quả cập nhật khi AI đọc xong.`);
                }}
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
              >
                <RotateCw aria-hidden className="size-3.5" /> Đọc lại trang {page}
              </button>
            </div>
          )}
        </section>

        <section aria-label="Thông tin giấy tờ" className="grid content-start gap-3 bg-surface p-4 sm:p-6">
          {!canEdit && (
            <p className="flex items-start gap-2 border border-warn bg-warn-soft p-3 text-sm text-warn" role="status">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" /> {data.lockedReason ?? "Giấy tờ này không sửa được ở bước hiện tại."}
            </p>
          )}

          {jobActive && (
            <p className="flex items-center gap-2 border border-line bg-accent-soft p-3 text-sm" role="status">
              <Loader2 aria-hidden className="size-4 animate-spin text-primary" />
              {live ? progressLabel(live) : data.job?.status === "running" ? "AI đang đọc giấy tờ này" : "Đang chờ tới lượt AI đọc"}. Trang này tự cập nhật khi đọc xong.
            </p>
          )}
          {data.job?.status === "failed" && (
            <div className="grid gap-2 border border-bad bg-bad-soft p-3 text-sm text-bad" role="alert">
              <p>AI đọc giấy tờ này bị lỗi{data.job.error ? `: ${data.job.error}` : ""}. Bạn vẫn có thể chọn loại và nhập tay, hoặc đọc lại.</p>
              {canExtract && <ExtractNowButton scope="document" id={docId} label="Đọc lại" variant="primary" className="justify-self-start" />}
            </div>
          )}

          <ClassificationCard
            data={data}
            groups={groups}
            types={types}
            picker={picker}
            setPicker={setPicker}
            pickedDiffers={pickedDiffers}
            canEdit={canEdit}
            pendingTypes={typesAction.pending}
            pendingApply={classifyAction.pending}
            onPickGroup={onPickGroup}
            onApply={() => onApplyClassification(picker.group, picker.type)}
            onAcceptSuggestion={() => data.suggestion?.workGroupCode && data.suggestion.documentTypeCode && onApplyClassification(data.suggestion.workGroupCode, data.suggestion.documentTypeCode)}
          />

          <fieldset disabled={!canEdit} className="grid gap-3 border border-line p-3">
            <legend className="px-1 text-sm font-bold text-heading">Thông tin đầu văn bản</legend>
            <p className="text-xs text-muted">
              Kiểm tra với bản gốc rồi xác nhận.
              {reviewedAt && <> Đã xác nhận{doc.metadataReviewedByName ? ` bởi ${doc.metadataReviewedByName}` : ""} lúc {reviewedAt.toLocaleString("vi-VN")}{doc.metadataReviewNote ? ` · ghi chú: ${doc.metadataReviewNote}` : ""}.</>}
            </p>
            <TextField id={fieldDomId(docId, "meta.title")} label="Tiêu đề, trích yếu" required value={draft.meta.title} onChange={(v) => setMeta("title", v)} error={errors["meta.title"]} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField id={fieldDomId(docId, "meta.documentForm")} label="Hình thức văn bản" required value={draft.meta.documentForm === "Chưa xác định" ? "" : draft.meta.documentForm} onChange={(v) => setMeta("documentForm", v)} error={errors["meta.documentForm"]} list="hinh-thuc-van-ban" />
              <TextField id={fieldDomId(docId, "meta.documentNumber")} label="Số, ký hiệu" value={draft.meta.documentNumber} onChange={(v) => setMeta("documentNumber", v)} error={errors["meta.documentNumber"]} />
            </div>
            <datalist id="hinh-thuc-van-ban">{FORM_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
            <TextField id={fieldDomId(docId, "meta.issuedOn")} label="Ngày ban hành" value={draft.meta.issuedOn} onChange={(v) => setMeta("issuedOn", v)} error={errors["meta.issuedOn"]} placeholder="dd/mm/yyyy" inputMode="numeric" hint="Ngày/tháng/năm. Để trống nếu văn bản không ghi ngày." />
            <div className="grid gap-1">
              <label htmlFor={fieldDomId(docId, "meta.note")} className="flex justify-between text-xs font-semibold text-ink">
                <span>Ghi chú khi xác nhận (tùy chọn)</span>
                <span className="font-normal text-muted tabular-nums">{draft.meta.note.length}/2000</span>
              </label>
              <textarea id={fieldDomId(docId, "meta.note")} rows={2} maxLength={2000} value={draft.meta.note} onChange={(e) => setMeta("note", e.target.value)} className="border border-line-strong bg-surface px-2 py-1.5 text-sm" />
              {errors["meta.note"] && <p className="text-xs text-bad">{errors["meta.note"]}</p>}
            </div>
          </fieldset>

          {attention > 0 && (
            <p className="flex items-center gap-2 text-sm font-semibold text-warn" role="status">
              <AlertTriangle aria-hidden className="size-4" /> {attention} trường cần bạn xem trước
            </p>
          )}

          {ordered.length === 0 ? (
            <p className="border border-dashed border-line-strong p-4 text-sm text-muted">
              {effectiveType ? "Loại giấy tờ này không có trường dữ liệu." : "Chưa có trường nào để đối chiếu vì chưa chọn loại giấy tờ."}
            </p>
          ) : (
            <fieldset disabled={!canEdit} className="grid gap-3">
              <legend className="sr-only">Trường dữ liệu của giấy tờ</legend>
              {ordered.map((field) => (
                <FieldRow
                  key={field.fieldCode}
                  id={fieldDomId(docId, field.fieldCode)}
                  field={field}
                  draft={draft.fields[field.fieldCode] ?? { value: "", confirmed: false }}
                  error={errors[field.fieldCode] || null}
                  onChange={(value) => setField(field.fieldCode, value)}
                  onConfirmed={(confirmed) => setConfirmed(field.fieldCode, confirmed)}
                  onFocus={() => jumpTo(field)}
                  onBlurValidate={(value) => {
                    const message = validateField(field, value);
                    setErrors((current) => ((current[field.fieldCode] ?? "") === (message ?? "") ? current : { ...current, [field.fieldCode]: message ?? "" }));
                  }}
                />
              ))}
            </fieldset>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
        <p id="trang-thai-xac-nhan" tabIndex={-1} role="status" className="max-w-prose text-[13px] text-muted outline-none">
          {blockedReason ? (
            <span className="font-semibold text-warn">{blockedReason}</span>
          ) : dirty ? (
            "Có thay đổi chưa xác nhận (đã lưu nháp trên trình duyệt)."
          ) : (
            "Đã sẵn sàng xác nhận."
          )}{" "}
          <kbd className="border border-line px-1">Ctrl</kbd>+<kbd className="border border-line px-1">Enter</kbd> để sang bước tiếp
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={onDiscard} disabled={discardAction.pending || !canEdit}>
            <Trash2 aria-hidden className="size-4" /> Bỏ PDF này
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} disabled={confirmAction.pending} aria-busy={confirmAction.pending} aria-disabled={Boolean(blockedReason)}>
            {confirmAction.pending ? "Đang lưu…" : "Xác nhận, xếp vào hồ sơ →"}
          </Button>
        </div>
      </div>

      <Dialog
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title="Rời trang khi còn thay đổi chưa lưu?"
        description="Bạn đã sửa nhưng chưa xác nhận. Bản nháp được giữ trong phiên làm việc này của trình duyệt, nhưng chưa ghi vào hệ thống."
        footer={
          <>
            <Button
              onClick={() => {
                const target = leaveTo;
                setLeaveTo(null);
                flushDraft();
                if (target) router.push(target as "/");
              }}
            >
              Rời trang
            </Button>
            <Button variant="primary" onClick={() => setLeaveTo(null)}>Ở lại và tiếp tục</Button>
          </>
        }
      />
    </div>
  );
}

function fieldDomId(documentId: string, key: string): string {
  return `f-${documentId.slice(0, 8)}-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  placeholder,
  hint,
  list,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  list?: string;
  inputMode?: "numeric" | "text" | "decimal";
}) {
  const hintId = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink">
        {label}
        {required && <span className="ml-1 text-bad" title="Bắt buộc">*</span>}
      </label>
      <input
        id={id}
        value={value}
        list={list}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        className={cn("h-9 border bg-surface px-2 text-sm", error ? "border-bad" : "border-line-strong")}
      />
      {(error || hint) && (
        <p id={hintId} className={cn("text-xs", error ? "text-bad" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

function FieldRow({
  id,
  field,
  draft,
  error,
  onChange,
  onConfirmed,
  onFocus,
  onBlurValidate,
}: {
  id: string;
  field: ReviewField;
  draft: { value: string; confirmed: boolean };
  error: string | null;
  onChange: (value: string) => void;
  onConfirmed: (confirmed: boolean) => void;
  onFocus: () => void;
  onBlurValidate: (value: string) => void;
}) {
  const noteId = useId();
  const page = field.sourcePages[0];
  const changedFromAi = field.suggestedValue !== null && draft.value !== field.suggestedValue;
  return (
    <div className={cn("grid gap-1.5 border p-3", field.attention ? "border-warn bg-warn-soft" : "border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label htmlFor={id} className="font-semibold text-ink">
          {field.label}
          {field.required && <span className="ml-1 text-bad" title="Trường quan trọng, bắt buộc xác nhận">*</span>}
        </label>
        <span className="text-muted">{page ? `Trang ${field.sourcePages.join(", ")}` : "Không thấy trong tài liệu"}</span>
      </div>

      {field.valueType === "boolean" ? (
        <select id={id} value={draft.value} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={noteId} className="h-9 border border-line-strong bg-surface px-2 text-sm">
          <option value="">Không rõ</option>
          <option value="Có">Có</option>
          <option value="Không">Không</option>
          {draft.value && !["Có", "Không"].includes(draft.value) && <option value={draft.value}>{draft.value}</option>}
        </select>
      ) : (
        <input
          id={id}
          value={draft.value}
          inputMode={field.valueType === "number" ? "decimal" : field.valueType === "date" ? "numeric" : undefined}
          placeholder={field.valueType === "date" ? "dd/mm/yyyy" : undefined}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlurValidate(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          className={cn("h-9 border bg-surface px-2 text-sm", error ? "border-bad" : "border-line-strong")}
        />
      )}

      <div id={noteId} className="grid gap-1">
        {field.attention && <p className="text-xs text-warn">{field.attention}</p>}
        {error && <p className="text-xs text-bad" role="alert">{error}</p>}
        {changedFromAi && field.suggestedValue && (
          <button type="button" onClick={() => onChange(field.suggestedValue ?? "")} className="justify-self-start text-xs text-primary hover:underline">
            Dùng lại giá trị AI đọc: “{field.suggestedValue}”
          </button>
        )}
      </div>

      {field.attention && (
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={draft.confirmed} onChange={(e) => onConfirmed(e.target.checked)} className="size-4 accent-primary" />
          Tôi đã kiểm trường này trên bản gốc
        </label>
      )}
    </div>
  );
}

function ClassificationCard({
  data,
  groups,
  types,
  picker,
  setPicker,
  pickedDiffers,
  canEdit,
  pendingTypes,
  pendingApply,
  onPickGroup,
  onApply,
  onAcceptSuggestion,
}: {
  data: ReviewData;
  groups: GroupOption[];
  types: DocumentTypeInfo[];
  picker: { open: boolean; group: string; type: string };
  setPicker: (updater: (current: { open: boolean; group: string; type: string }) => { open: boolean; group: string; type: string }) => void;
  pickedDiffers: boolean;
  canEdit: boolean;
  pendingTypes: boolean;
  pendingApply: boolean;
  onPickGroup: (group: string) => void;
  onApply: () => void;
  onAcceptSuggestion: () => void;
}) {
  const { document: doc, suggestion } = data;
  const saved = doc.classification;
  const groupSelectId = useId();
  const typeSelectId = useId();
  const suggestionUsable = Boolean(suggestion?.workGroupCode && suggestion.documentTypeCode);
  const groupOptions = groups.some((g) => g.code === picker.group) || !picker.group ? groups : [...groups, { code: picker.group, title: picker.group }];

  return (
    <div className="grid gap-2 border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {saved ? "Loại giấy tờ đã xác nhận" : "Gợi ý của AI · cần bạn xác nhận"}
          {/* Worker chạy HOSO_AI_PROFILE=fake (máy dev không có mô hình): gắn nhãn để không ai nhầm là kết quả AI thật. */}
          {!saved && suggestion?.modelKey === "fake" && <Chip tone="warn">AI giả lập</Chip>}
        </span>
        {saved ? (
          <Chip tone="ok"><CheckCircle2 aria-hidden className="size-3" /> Đã xác nhận</Chip>
        ) : suggestion && !suggestion.evidenceVerified ? (
          <Chip tone="warn">Chưa tìm thấy đoạn trích trong văn bản</Chip>
        ) : null}
      </div>

      {(saved || suggestionUsable) && (
        <div className="flex flex-wrap gap-2">
          <Chip tone="info">{saved ? saved.workGroupTitle : (suggestion?.workGroupTitle ?? suggestion?.workGroupCode)}</Chip>
          <Chip tone="info">{saved ? (saved.documentTypeName ?? saved.documentTypeCode) : (suggestion?.documentTypeName ?? suggestion?.documentTypeCode)}</Chip>
        </div>
      )}
      {!saved && !suggestionUsable && <p className="text-sm text-muted">AI chưa gợi ý được loại giấy tờ. Chọn nhóm và loại bên dưới.</p>}
      {!saved && suggestion?.mixedDocuments && (
        <p className="flex items-start gap-2 text-sm text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none" /> AI thấy tệp này có thể gồm nhiều văn bản. Cân nhắc <b>Tách thành nhiều văn bản</b> trước khi đối chiếu.
        </p>
      )}
      {!saved && suggestion?.reason && <p className="text-xs text-muted">Lý do: {suggestion.reason}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {!saved && suggestionUsable && !picker.open && (
            <Button size="sm" variant="primary" onClick={onAcceptSuggestion} disabled={pendingApply}>
              {pendingApply ? "Đang lưu…" : "Chấp nhận gợi ý"}
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-expanded={picker.open} onClick={() => setPicker((p) => ({ ...p, open: !p.open }))}>
            {picker.open ? "Thu gọn" : "Đổi loại giấy tờ"}
          </Button>
        </div>
      )}

      {picker.open && canEdit && (
        <div className="grid gap-2 border-t border-line pt-2">
          <div className="grid gap-1">
            <label htmlFor={groupSelectId} className="text-xs font-semibold">Nhóm hồ sơ</label>
            <select id={groupSelectId} value={picker.group} onChange={(e) => onPickGroup(e.target.value)} className="h-9 border border-line-strong bg-surface px-2 text-sm">
              <option value="">Chọn nhóm…</option>
              {groupOptions.map((g) => (
                <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor={typeSelectId} className="text-xs font-semibold">Loại giấy tờ</label>
            <select id={typeSelectId} value={picker.type} disabled={!picker.group || pendingTypes} onChange={(e) => setPicker((p) => ({ ...p, type: e.target.value }))} className="h-9 border border-line-strong bg-surface px-2 text-sm">
              <option value="">{pendingTypes ? "Đang tải…" : "Chọn loại…"}</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>
          {pickedDiffers && (
            <div className="grid gap-1">
              <p className="text-xs text-muted">Đổi loại thì bộ trường dữ liệu đổi theo; giá trị đã nhập ở loại cũ không được chuyển sang.</p>
              <Button size="sm" variant="primary" className="justify-self-start" onClick={onApply} disabled={pendingApply}>
                {pendingApply ? "Đang lưu…" : "Áp dụng loại này"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
