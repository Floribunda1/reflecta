import { describe, expect, test } from "vitest";
import { shouldApplyInitialEntities } from "./initial-entities";

describe("ChatComposer initial entities", () => {
  test("applies a new request only to an empty draft", () => {
    expect(
      shouldApplyInitialEntities({
        requestChanged: true,
        editing: false,
        text: "",
        attachmentCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldApplyInitialEntities({
        requestChanged: false,
        editing: false,
        text: "",
        attachmentCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldApplyInitialEntities({
        requestChanged: true,
        editing: false,
        text: "user draft",
        attachmentCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldApplyInitialEntities({
        requestChanged: true,
        editing: false,
        text: "",
        attachmentCount: 1,
      }),
    ).toBe(false);
  });
});
