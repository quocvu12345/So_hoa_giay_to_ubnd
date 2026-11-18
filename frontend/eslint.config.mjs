import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import hoso from "./eslint-rules/hoso.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SEC-04 (docs/05-bao-mat.md): cấm mã chèn HTML/thực thi chuỗi và hai luật riêng của dự án (eslint-rules/hoso.mjs).
  {
    plugins: { hoso },
    rules: {
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "hoso/no-server-only-in-client": "error",
      "hoso/server-action-guard": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Thư mục build của máy chủ giả lập E2E (NEXT_DIST_DIR=.next-mock): mã sinh ra, không phải mã nguồn.
    ".next-mock/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
