import type { ChatState, ChatStatus, UIMessage } from "ai";

function cloneUiMessage<UI_MESSAGE extends UIMessage>(message: UI_MESSAGE): UI_MESSAGE {
  return {
    ...message,
    parts: message.parts.map((part) => ({ ...part })),
  } as UI_MESSAGE;
}

export class ReflectaReactChatState<UI_MESSAGE extends UIMessage> implements ChatState<UI_MESSAGE> {
  private listeners = new Set<() => void>();
  private _messages: UI_MESSAGE[];
  private _status: ChatStatus = "ready";
  private _error: Error | undefined;

  constructor(messages?: UI_MESSAGE[]) {
    this._messages = (messages ?? []).map(cloneUiMessage);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    for (const listener of this.listeners) listener();
  }

  get messages(): UI_MESSAGE[] {
    return this._messages;
  }

  set messages(messages: UI_MESSAGE[]) {
    this._messages = messages.map(cloneUiMessage);
    this.emit();
  }

  get status(): ChatStatus {
    return this._status;
  }

  set status(status: ChatStatus) {
    this._status = status;
    this.emit();
  }

  get error(): Error | undefined {
    return this._error;
  }

  set error(error: Error | undefined) {
    this._error = error;
    this.emit();
  }

  pushMessage = (message: UI_MESSAGE) => {
    this._messages = [...this._messages, cloneUiMessage(message)];
    this.emit();
  };

  popMessage = () => {
    this._messages = this._messages.slice(0, -1);
    this.emit();
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    const next = this._messages.slice();
    next[index] = cloneUiMessage(message);
    this._messages = next;
    this.emit();
  };

  snapshot = <T>(value: T): T => value;
}
