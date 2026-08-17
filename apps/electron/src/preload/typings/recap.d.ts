/** 回顾页（Recap）聚合数据 —— 参与过程 + 沉淀资产的原始输入，由 renderer 纯函数计算。 */

export type SessionParticipation = {
  sessionId: string;
  title: string;
  /** 首条用户消息时间（会话参与起点） */
  createdAt: string;
  updatedAt: string;
  /** 用户消息数 */
  messageCount: number;
  /** 每条用户消息的创建时间（ISO 列表，支撑按日分布） */
  userMessageDates: string[];
};

export type RecapData = {
  /** Agent 对话参与（会话级，含消息数） */
  sessions: SessionParticipation[];
  /** 上下文创建时间（ISO 列表） */
  contextCreates: string[];
  /** 画布元素创建时间（ISO 列表） */
  canvasElementCreates: string[];
  /** 画布连线创建时间（ISO 列表） */
  canvasEdgeCreates: string[];
  /** 出现在任意画布的理解 id（孤岛 = 理解全集 − 本集合） */
  canvasReferencedUnderstandingIds: string[];
};
