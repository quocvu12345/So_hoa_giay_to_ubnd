import { Stepper } from "@/components/ui/stepper";
import { routes } from "@/config/routes";

/** Khung chung của bước 2 và 3: thanh bước luôn nằm trên cùng để người dùng biết đang ở đâu. */
export default async function IntakeDocumentLayout({ children, params }: LayoutProps<"/tiep-nhan/[documentId]">) {
  const { documentId } = await params;
  return (
    <div className="grid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Stepper
          fallback={1}
          steps={[
            { href: routes.intakeUpload, label: "Nạp PDF", match: "/tai-len" },
            { href: routes.intakeReview(documentId), label: "Đối chiếu", match: "/doi-chieu" },
            { href: routes.intakeFile(documentId), label: "Xếp vào hồ sơ", match: "/xep-ho-so" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
