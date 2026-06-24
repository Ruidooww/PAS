import { QaHttpError } from "./sse-client";

export function qaErrorMessage(error: unknown): string {
  if (error instanceof QaHttpError) {
    if (error.status === 403) return "当前账号没有访问内部问答的权限。";
    if (error.status >= 500) return "问答服务暂时不可用，请稍后重试。";
  }
  if (error instanceof Error && error.message === "QA stream ended before done event") {
    return "连接已中断，回答可能不完整，请重新发送。";
  }
  if (error instanceof Error && error.message === "QA response has no readable stream") {
    return "浏览器无法读取流式回答，请刷新后重试。";
  }
  return "问答请求失败，请稍后重试。";
}
