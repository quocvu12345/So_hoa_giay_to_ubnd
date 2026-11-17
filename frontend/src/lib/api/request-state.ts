import "server-only";
import { cache } from "react";

/**
 * Trạng thái riêng của một request phía máy chủ Next, dùng chung giữa lớp phiên và lớp gọi API.
 * `dropAssignment`: cookie hoso_assignment đang trỏ tới phân công không còn dùng được (hết hạn, bị thu hồi,
 * hoặc là của người dùng trước trên cùng máy). Khi đó mọi lệnh gọi API trong request này bỏ header X-Assignment-Id
 * để API dùng phân công mặc định, thay vì trả 403 ở mọi nơi.
 */
export const requestState = cache(() => ({ dropAssignment: false }));
