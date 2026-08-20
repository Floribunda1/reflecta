/**
 * IPC 传输层 —— `IpcWire` 抽象（归属 ipc-transport-boundary.md）。
 *
 * 传输层只管一件事：把"编码后的字节/值"从一个进程送到另一个并取回响应。
 * 业务无关、不感知具体协议——这正是它能被整体替换（ipcMain ↔ WS/HTTP/MessagePort）的接缝。
 *
 * 公开面（本模块对外仅两项）：
 * - `IpcWire`：renderer 侧视为 `invoke(payload) => Promise<response>`
 * - `makeInMemoryWire`：测试用 in-memory 配对（模拟 ipcRenderer.invoke / ipcMain.handle 的结构化克隆）
 *
 * 真机版（ipcMain.handle / ipcRenderer.invoke / contextBridge）在 P2 接入时补充，
 * 接口不变，仅换实现。
 */

/** 业务无关的 IPC 线：发 encoded 值，收 encoded 值（Promise 形态，匹配 invoke）。 */
export interface IpcWire {
  invoke(payload: unknown): Promise<unknown>;
}

/** 主进程侧接收器：把收到的 encoded 值转成 encoded 响应（对应 ipcMain.handle 的回调）。 */
export type IpcMainHandler = (payload: unknown) => Promise<unknown>;

/**
 * 构造一对 in-memory IPC 线：`clientWire` 对端提交 `handler` 处理。
 * 用结构化克隆浅模拟 Electron 的序列化边界（值能跨"进程"传、但同一份数据）。
 */
export function makeInMemoryWire(mainHandler: IpcMainHandler): IpcWire {
  return {
    invoke(payload: unknown): Promise<unknown> {
      const cloned = structuredClone(payload);
      return mainHandler(cloned).then((resp) => structuredClone(resp));
    },
  };
}

/** 真机 renderer 侧：把 `window.ipcRenderer.invoke(channel, ...)` 适配为 `IpcWire`。 */
export function makeRendererWire(invoke: (payload: unknown) => Promise<unknown>): IpcWire {
  return { invoke };
}
