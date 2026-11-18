/**
 * SEC-04. Luật ESLint riêng của dự án (docs/05-bao-mat.md): chặn từ lúc viết những lỗi bảo mật mà kiểm thử khó bắt.
 *  - hoso/no-server-only-in-client: tệp "use client" không được import mô-đun chỉ chạy ở máy chủ (server-only, next/headers, *-data, client API phía
 *    máy chủ, phiên). Nếu lọt sang trình duyệt, bí mật hoặc mã gọi API nội bộ bị đóng gói vào gói JS gửi cho người dùng. `import type` được phép (bị xóa khi biên dịch).
 *  - hoso/server-action-guard: mọi hàm async được xuất từ tệp "use server" phải đi qua `runAction` (kiểm phiên, bắt lỗi API, ghi log) hoặc tự kiểm phiên bằng
 *    getSession/pageSession/requireSession. Server Action là điểm vào công khai: ai biết địa chỉ cũng gọi được, nên không được bỏ sót bước kiểm phiên.
 * Hàm cố ý không cần phiên (đăng xuất, xóa cookie) ghi miễn tại chỗ bằng `// eslint-disable-next-line hoso/server-action-guard -- <lý do>` để người duyệt thấy.
 * Cấm `dangerouslySetInnerHTML` và `eval` cấu hình ở eslint.config.mjs bằng luật có sẵn (react/no-danger, no-eval, no-implied-eval, no-new-func).
 */

const directive = (program, name) => program.body.some((node) => node.type === "ExpressionStatement" && node.directive === name);

const SERVER_ONLY_IMPORTS = [
  /^server-only$/,
  /^next\/headers$/,
  /-data$/,                              // features/**/xxx-data.ts: đều `import "server-only"`
  /^@\/lib\/api\/server$/,
  /^@\/lib\/auth\/(session|page-guard)$/,
  /^@\/lib\/actions$/,
  /^@\/lib\/log$/,
];

const noServerOnlyInClient = {
  meta: {
    type: "problem",
    schema: [],
    messages: { forbidden: 'Tệp "use client" không được import "{{source}}": mô-đun này chỉ chạy ở máy chủ. Chuyển việc cần làm sang Server Component hoặc Server Action, hoặc dùng `import type`.' },
  },
  create(context) {
    let client = false;
    return {
      Program(node) {
        client = directive(node, "use client");
      },
      ImportDeclaration(node) {
        if (!client || node.importKind === "type") return;
        if (node.specifiers.length > 0 && node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type")) return;
        const source = String(node.source.value);
        if (SERVER_ONLY_IMPORTS.some((re) => re.test(source))) context.report({ node, messageId: "forbidden", data: { source } });
      },
    };
  },
};

// Chốt chặn hợp lệ: bọc runAction, tự kiểm phiên, hoặc chỉ chạy khi HOSO_MOCK=1 (serverEnv().mock; môi trường production cấm bật mock).
const GUARD = /\b(runAction|getSession|requireSession|pageSession)\s*\(|\bserverEnv\(\)\.mock\b/;

const serverActionGuard = {
  meta: {
    type: "problem",
    schema: [],
    messages: { unguarded: 'Server Action "{{name}}" phải gọi runAction(...) hoặc tự kiểm phiên (getSession, pageSession, requireSession). Server Action là điểm vào công khai.' },
  },
  create(context) {
    let server = false;
    return {
      Program(node) {
        server = directive(node, "use server");
      },
      ExportNamedDeclaration(node) {
        if (!server || !node.declaration) return;
        const declaration = node.declaration;
        const fn = declaration.type === "FunctionDeclaration" ? declaration : null;
        if (!fn || !fn.async) return;
        if (!GUARD.test(context.sourceCode.getText(fn.body))) context.report({ node: fn, messageId: "unguarded", data: { name: fn.id?.name ?? "(không tên)" } });
      },
    };
  },
};

const plugin = { rules: { "no-server-only-in-client": noServerOnlyInClient, "server-action-guard": serverActionGuard } };

export default plugin;
