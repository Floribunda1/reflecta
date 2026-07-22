import { afterEach, describe, expect, test } from "vitest";
import { getCodexCredentials } from "./codex-auth";

const originalCodexAccessToken = process.env.CODEX_ACCESS_TOKEN;

function fakeJwt(payload: object): string {
  return [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

afterEach(() => {
  if (originalCodexAccessToken === undefined) delete process.env.CODEX_ACCESS_TOKEN;
  else process.env.CODEX_ACCESS_TOKEN = originalCodexAccessToken;
});

describe("getCodexCredentials", () => {
  test("uses CODEX_ACCESS_TOKEN when present", async () => {
    const token = fakeJwt({
      "https://api.openai.com/auth": { chatgpt_account_id: "account-test" },
    });
    process.env.CODEX_ACCESS_TOKEN = token;

    await expect(getCodexCredentials()).resolves.toEqual({
      accessToken: token,
      refreshToken: "",
      expiresAt: Number.MAX_SAFE_INTEGER,
      accountId: "account-test",
    });
  });
});
