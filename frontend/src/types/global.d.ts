export {};

declare global {
  interface Window {
    /** Gửi lỗi phía trình duyệt về /client-log; gắn trong instrumentation-client.ts. */
    __hosoReport?: (kind: string, error: unknown, extra?: Record<string, unknown>) => void;
  }
}
