import { customAlphabet } from "nanoid";

const createId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21,
);

export function createEntityId(): string {
  return createId();
}
