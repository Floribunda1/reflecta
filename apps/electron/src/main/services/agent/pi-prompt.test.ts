import { describe, expect, test } from "vitest";
import { buildPiPromptText } from "./pi-prompt";

describe("buildPiPromptText", () => {
  test("injects selected context refs as lightweight references", () => {
    const prompt = buildPiPromptText({
      text: "请比较这些引用",
      contextSources: [
        {
          sourceId: "rf_understanding",
          entity: {
            type: "understanding",
            id: "understanding-1",
            title: "React Server Components",
          },
          origin: { kind: "user_context", messageId: "user-1" },
        },
        {
          sourceId: "rf_domain",
          entity: { type: "domain", id: "domain-1", title: "React" },
          origin: { kind: "user_context", messageId: "user-1" },
        },
      ],
    });

    expect(prompt).toContain("请比较这些引用");
    expect(prompt).toContain("[[ref:rf_understanding]] Understanding: React Server Components");
    expect(prompt).toContain("[[ref:rf_domain]] Domain: React");
    expect(prompt).not.toContain("understanding-1");
    expect(prompt).not.toContain("domain-1");
    expect(prompt).toContain("轻量引用");
    expect(prompt).toContain("不要裸写 ref token");
  });

  test("injects attachment metadata without embedding file data URLs", () => {
    const prompt = buildPiPromptText({
      text: "请总结附件",
      files: [
        {
          type: "file",
          mediaType: "text/plain",
          filename: "attachment.txt",
          url: `data:text/plain;base64,${Buffer.from("secret file body").toString("base64")}`,
          providerMetadata: { reflecta: { attachmentId: "att-file", size: 16 } },
        },
      ],
    });

    expect(prompt).toContain("attachment.txt");
    expect(prompt).toContain("attachmentId=att-file");
    expect(prompt).toContain("size=16 bytes");
    expect(prompt).not.toContain("secret file body");
    expect(prompt).not.toContain("data:text/plain");
  });
});
