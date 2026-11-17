import { describe, expect, it } from "vitest";
import { reconnectDelayMs } from "./server-events";
import { createSseParser, type SseMessage } from "./sse-parser";

function collect() {
  const messages: SseMessage[] = [];
  const retries: number[] = [];
  const parser = createSseParser((m) => messages.push(m), (r) => retries.push(r));
  return { messages, retries, parser };
}

describe("bộ đọc SSE", () => {
  it("đọc sự kiện đủ id, event, data như API gửi", () => {
    const { messages, parser } = collect();
    parser.push('retry: 5000\n\nid: 12\nevent: job.progress\ndata: {"jobId":"j","processed":2}\n\n');
    expect(messages).toEqual([{ id: "12", event: "job.progress", data: '{"jobId":"j","processed":2}' }]);
    expect(parser.lastEventId()).toBe("12");
  });
  it("ghép được khi luồng bị cắt giữa dòng hoặc giữa \\r\\n", () => {
    const { messages, parser } = collect();
    for (const piece of ["id: 1\r", "\nevent: job.compl", "eted\ndata: {\"a\"", ":1}\r\n", "\r\n"]) parser.push(piece);
    expect(messages).toEqual([{ id: "1", event: "job.completed", data: '{"a":1}' }]);
  });
  it("bỏ qua nhịp tim (dòng bình luận) và sự kiện không có data", () => {
    const { messages, parser } = collect();
    parser.push(": heartbeat\n\n");
    parser.push("event: x\n\n");
    expect(messages).toEqual([]);
  });
  it("nhiều dòng data nối bằng xuống dòng; không có event thì là message", () => {
    const { messages, parser } = collect();
    parser.push("data: a\ndata: b\n\n");
    expect(messages).toEqual([{ id: null, event: "message", data: "a\nb" }]);
  });
  it("nhớ mã sự kiện cuối để gửi Last-Event-ID khi nối lại; ghi nhận gợi ý retry", () => {
    const { retries, parser } = collect();
    parser.push("id: 7\nevent: a\ndata: 1\n\nid: 8\nevent: b\ndata: 2\n\nretry: 3000\n\n");
    expect(parser.lastEventId()).toBe("8");
    expect(retries).toEqual([3000]);
  });
});

describe("nối lại", () => {
  it("giãn 1, 2, 4… tối đa 30 giây", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(reconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});
