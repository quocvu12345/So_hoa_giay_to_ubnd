import { RuleTester, type Rule } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { afterAll, describe, it } from "vitest";
import plugin from "../../eslint-rules/hoso.mjs";

// RuleTester cần describe/it của bộ chạy test đang dùng.
// Kiểu của RuleTester chưa khai báo các móc này, nhưng chạy thật thì cần.
Object.assign(RuleTester, { afterAll, describe, it });

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" } });

tester.run("hoso/no-server-only-in-client", plugin.rules["no-server-only-in-client"] as unknown as Rule.RuleModule, {
  valid: [
    { name: "Server Component import mô-đun máy chủ thoải mái", code: `import "server-only"; import { getInbox } from "@/features/intake/inbox-data"; export default function P() {}` },
    { name: "tệp use client import `import type` từ mô-đun máy chủ", code: `"use client"; import type { InboxItem } from "@/features/intake/inbox-data"; export const x = 1;` },
    { name: "tệp use client import type theo từng tên", code: `"use client"; import { type InboxItem } from "@/features/intake/inbox-data"; export const x = 1;` },
    { name: "tệp use client gọi Server Action (được phép)", code: `"use client"; import { discardDocument } from "@/app/actions/intake"; export const x = discardDocument;` },
    { name: "tệp use client import hàm thuần", code: `"use client"; import { parseViDate } from "@/lib/vi-date"; export const x = parseViDate;` },
  ],
  invalid: [
    { name: "server-only", code: `"use client"; import "server-only"; export const x = 1;`, errors: [{ messageId: "forbidden" }] },
    { name: "next/headers", code: `"use client"; import { cookies } from "next/headers"; export const x = cookies;`, errors: [{ messageId: "forbidden" }] },
    { name: "mô-đun *-data", code: `"use client"; import { getInbox } from "@/features/intake/inbox-data"; export const x = getInbox;`, errors: [{ messageId: "forbidden" }] },
    { name: "client API phía máy chủ", code: `"use client"; import { serverApi } from "@/lib/api/server"; export const x = serverApi;`, errors: [{ messageId: "forbidden" }] },
    { name: "phiên phía máy chủ", code: `"use client"; import { getSession } from "@/lib/auth/session"; export const x = getSession;`, errors: [{ messageId: "forbidden" }] },
  ],
});

tester.run("hoso/server-action-guard", plugin.rules["server-action-guard"] as unknown as Rule.RuleModule, {
  valid: [
    { name: "bọc runAction", code: `"use server"; export async function a(id: string) { return runAction("a", async () => { return id; }); }` },
    { name: "tự kiểm phiên", code: `"use server"; export async function a() { const s = await getSession(); if (!s) return; }` },
    { name: "chỉ chạy khi mock", code: `"use server"; export async function a() { if (!serverEnv().mock) throw new Error("tắt"); }` },
    { name: "hàm không xuất không cần chốt chặn", code: `"use server"; async function helper() { return 1; } export async function a() { return runAction("a", helper); }` },
    { name: "tệp không phải use server thì không xét", code: `export async function a() { return 1; }` },
    { name: "xuất kiểu hay hằng không phải Server Action", code: `"use server"; export type T = { a: string }; export const LIMIT = 5;` },
  ],
  invalid: [
    { name: "Server Action trần gọi API", code: `"use server"; export async function a(id: string) { await serverApi().DELETE("/x", { params: { id } }); }`, errors: [{ messageId: "unguarded" }] },
    { name: "chỉ nhắc tên runAction trong chú thích hay chuỗi không tính", code: `"use server"; export async function a() { const note = "runAction"; return note; }`, errors: [{ messageId: "unguarded" }] },
  ],
});
