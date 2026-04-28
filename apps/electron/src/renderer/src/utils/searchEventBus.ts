import EventEmitter from "eventemitter3";

export type SearchSelectPayload = {
  thoughtId: string;
  /** Available when the hit was a thought (ThoughtSummaryDTO). Undefined for context hits. */
  categoryIds: string[] | undefined;
};

type Events = {
  thoughtSelected: [SearchSelectPayload];
};

export const searchEventBus = new EventEmitter<Events>();
