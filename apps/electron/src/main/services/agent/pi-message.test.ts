import { describe, expect, test } from "vitest";
import { extractPiAssistantError, extractPiAssistantText } from "./pi-message";

describe("Pi assistant message translation", () => {
  test("extracts user-visible text and errors from Pi protocol messages", () => {
    expect(
      extractPiAssistantText({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "private" },
          { type: "text", text: "first" },
          { type: "text", text: " second" },
        ],
      }),
    ).toBe("first second");
    expect(
      extractPiAssistantError({
        role: "assistant",
        stopReason: "error",
        errorMessage: "provider failed",
      }),
    ).toBe("provider failed");
    expect(extractPiAssistantText({ role: "user", content: [] })).toBe("");
  });
});
