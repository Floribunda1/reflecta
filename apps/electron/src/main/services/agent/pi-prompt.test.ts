import { describe, expect, test } from "vitest";
import { buildPiPromptText } from "./pi-prompt";

describe("buildPiPromptText", () => {
  test("injects selected context refs as lightweight references", () => {
    const prompt = buildPiPromptText({
      text: "请比较这些引用",
      contextCatalog: [
        {
          key: "understanding:understanding-1",
          entity: {
            type: "understanding",
            id: "understanding-1",
            title: "React Server Components",
          },
          origin: { kind: "user_context", messageId: "user-1" },
        },
        {
          key: "domain:domain-1",
          entity: { type: "domain", id: "domain-1", title: "React" },
          origin: { kind: "user_context", messageId: "user-1" },
        },
      ],
      entityCatalog: [
        {
          key: "understanding:understanding-1",
          entity: {
            type: "understanding",
            id: "understanding-1",
            title: "React Server Components",
          },
          origin: { kind: "user_context", messageId: "user-1" },
        },
        {
          key: "domain:domain-1",
          entity: { type: "domain", id: "domain-1", title: "React" },
          origin: { kind: "user_context", messageId: "user-1" },
        },
      ],
    });

    expect(prompt).toContain("请比较这些引用");
    expect(prompt).toContain("Understanding: React Server Components; id=understanding-1");
    expect(prompt).toContain("Domain: React; id=domain-1");
    expect(prompt).toContain("<reflecta_entities>");
    expect(prompt).toContain(
      '{"type":"understanding","id":"understanding-1","citation":"[[u:understanding-1]]","title":"React Server Components"}',
    );
    expect(prompt).toContain(
      '{"type":"domain","id":"domain-1","citation":"[[d:domain-1]]","title":"React"}',
    );
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
