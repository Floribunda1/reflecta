import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "vitest";
import { generateCodexImage } from "./codex-image-generation";

describe("generateCodexImage", () => {
  test("completes the app-server handshake and stores only the generated image asset", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const process = Object.assign(new EventEmitter(), {
      stdin,
      stdout,
      stderr,
      exitCode: null,
      kill: () => true,
    });
    const methods: string[] = [];
    let buffered = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk: string) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        const message = JSON.parse(line);
        methods.push(message.method);
        if (typeof message.id !== "number") continue;
        const result =
          message.method === "account/read"
            ? { account: { type: "chatgpt", planType: "pro", email: null } }
            : message.method === "modelProvider/capabilities/read"
              ? { imageGeneration: true, namespaceTools: true, webSearch: true }
              : message.method === "thread/start"
                ? { thread: { id: "thread-1" } }
                : message.method === "turn/start"
                  ? { turn: { id: "turn-1" } }
                  : {};
        stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
        if (message.method === "turn/start") {
          const item = {
            type: "imageGeneration",
            id: "image-1",
            status: "completed",
            result: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"),
            revisedPrompt: "A rainy Shanghai street",
          };
          stdout.write(
            `${JSON.stringify({ method: "item/completed", params: { threadId: "thread-1", turnId: "turn-1", item } })}\n`,
          );
          stdout.write(
            `${JSON.stringify({ method: "turn/completed", params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed", items: [item] } } })}\n`,
          );
        }
      }
    });

    const contentStorageRoot = await mkdtemp(join(tmpdir(), "reflecta-image-test-"));
    const result = await generateCodexImage(
      { prompt: "雨中的上海街道", contentStorageRoot },
      () => process as never,
    );

    expect(methods).toEqual([
      "initialize",
      "initialized",
      "account/read",
      "modelProvider/capabilities/read",
      "thread/start",
      "turn/start",
    ]);
    expect(result).toMatchObject({
      kind: "generated-image",
      assetUrl: expect.stringMatching(/^asset:\/\/\//),
      mediaType: "image/png",
      revisedPrompt: "A rainy Shanghai street",
    });
    expect(
      await readFile(join(contentStorageRoot, "assets", result.assetUrl.slice("asset:///".length))),
    ).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
