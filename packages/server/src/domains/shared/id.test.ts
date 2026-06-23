import { describe, expect, test } from "vitest";
import { createEntityId } from "./id";

describe("createEntityId", () => {
  test("creates CLI-safe ids", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(createEntityId()).toMatch(/^[0-9A-Za-z]+$/);
    }
  });
});
