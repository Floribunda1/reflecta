/**
 * Agent 会话流的订阅 API 类型（renderer 侧 window.agentSessionFeed）。
 * 与运行时实现分离，避免 web 项目依赖 preload 的 electron 运行时文件。
 */
import type { AgentSessionFeedFrame } from "./agent";

export type AgentSessionFeedApi = {
  watch(sessionId: string, receive: (frame: AgentSessionFeedFrame) => void): () => void;
};
