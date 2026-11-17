/**
 * Bộ đọc luồng text/event-stream theo chuẩn WHATWG (id, event, data, retry, dòng bình luận bắt đầu bằng ":").
 * Dùng thay EventSource vì EventSource không gửi được header X-Assignment-Id mà API cần để biết phân công đang dùng.
 */
export type SseMessage = { id: string | null; event: string; data: string };

export type SseParser = {
  /** Đưa thêm một đoạn chữ vừa đọc từ luồng; có thể cắt giữa dòng. */
  push: (chunk: string) => void;
  /** Mã sự kiện cuối cùng đã nhận, gửi lại qua header Last-Event-ID khi nối lại. */
  lastEventId: () => string | null;
};

export function createSseParser(onMessage: (message: SseMessage) => void, onRetry?: (milliseconds: number) => void): SseParser {
  let buffer = "";
  let lastId: string | null = null;
  let event = "";
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onMessage({ id: lastId, event: event || "message", data: data.join("\n") });
    event = "";
    data = [];
  };

  const handleLine = (line: string) => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") {
      if (!value.includes("\0")) lastId = value;
    } else if (field === "retry" && /^\d+$/.test(value)) onRetry?.(Number(value));
  };

  return {
    push(chunk) {
      buffer += chunk;
      // Dòng kết thúc bằng \n, \r hoặc \r\n. Nếu đoạn kết thúc bằng \r thì chưa biết có \n theo sau, chờ đoạn kế.
      for (;;) {
        const match = /\r\n|\n|\r(?!$)/.exec(buffer);
        if (!match) return;
        handleLine(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
    },
    lastEventId: () => lastId,
  };
}
