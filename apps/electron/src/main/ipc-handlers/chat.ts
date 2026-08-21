/** chat 域 IPC handlers（业务在 services/chat-ops）。 */
import { ChatError, type AgentSessionProjection } from "../../ipc";
import * as chatOps from "../services/chat-ops";
import { liftPromise, liftSync, toVoid, type HandlerModule } from "./util";

const error = (message: string) => new ChatError({ reason: message, code: 500 });

export const chat: HandlerModule = {
  domain: "chat",
  error,
  handlers: {
    "chat.listThreads": () => liftPromise(error, () => chatOps.listThreads()),
    "chat.listSkills": () => liftSync(error, () => chatOps.listSkills()),
    "chat.createThread": ({ title }) => liftSync(error, () => chatOps.createThread(title)),
    "chat.renameThread": ({ threadId, title }) =>
      liftPromise(error, () => chatOps.renameThread(threadId, title)).pipe(toVoid),
    "chat.generateThreadTitle": ({ threadId }) =>
      liftPromise(error, () => chatOps.generateThreadTitle(threadId)),
    "chat.archiveThread": ({ threadId }) =>
      liftPromise(error, () => chatOps.archiveThread(threadId)).pipe(toVoid),
    "chat.deleteThread": ({ threadId }) =>
      liftPromise(error, () => chatOps.deleteThread(threadId)).pipe(toVoid),
    "chat.forkThreadFromMessage": ({ threadId, messageId }) =>
      liftPromise(error, () => chatOps.forkThreadFromMessage(threadId, messageId)),
    "chat.exportMarkdown": ({ filename, markdown }) =>
      liftPromise(error, () => chatOps.exportMarkdown(filename, markdown)),
    "chat.readSessionProjection": ({ sessionId }) =>
      liftPromise(
        error,
        () => chatOps.readSessionProjection(sessionId) as Promise<AgentSessionProjection>,
      ),
    "chat.sendAgentCommand": ({ command }) =>
      liftPromise(error, () =>
        chatOps.sendAgentCommand(command as import("@shared/agent").AgentCommand),
      ).pipe(toVoid),
  },
};
