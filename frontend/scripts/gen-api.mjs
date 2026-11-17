// FE-06. Sinh src/api/schema.d.ts từ src/api/openapi.json (BE-11, xuất bằng backend/scripts/export-openapi.sh).
//
// .NET khai số nguyên là ["integer","string"] kèm pattern vì cho phép đọc số từ chuỗi khi NHẬN request.
// Phản hồi luôn là số thật, nên ở đây gỡ nhánh "string" để kiểu phía giao diện là number, không phải number | string.
import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const source = new URL("../src/api/openapi.json", import.meta.url);
const target = new URL("../src/api/schema.d.ts", import.meta.url);

/** Gỡ "string" khỏi mảng type số; bỏ pattern số đi kèm. */
function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) out[key] = normalize(value);
  if (Array.isArray(out.type) && out.type.includes("string") && out.type.some((t) => t === "integer" || t === "number")) {
    out.type = out.type.filter((t) => t !== "string");
    if (out.type.length === 1) out.type = out.type[0];
    if (typeof out.pattern === "string" && out.pattern.includes("\\d")) delete out.pattern;
  }
  return out;
}

const document = normalize(JSON.parse(await readFile(source, "utf8")));
const ast = await openapiTS(document);
const banner = "/* Tệp sinh tự động bởi `npm run gen:api` từ src/api/openapi.json. Không sửa tay. */\n\n";
await writeFile(target, banner + astToString(ast));
console.log("Đã sinh src/api/schema.d.ts");
