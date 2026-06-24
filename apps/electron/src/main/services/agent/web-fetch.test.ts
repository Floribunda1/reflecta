import { afterEach, describe, expect, test, vi } from "vitest";
import { buildCurlMdUrl, fetchWebPage, parsePublicHttpUrl } from "./web-fetch";

describe("web_fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("only allows public http/https URLs", () => {
    expect(() => parsePublicHttpUrl("file:///etc/passwd")).toThrow(/http\/https/);
    expect(() => parsePublicHttpUrl("http://localhost:3000")).toThrow(/private network/);
    expect(() => parsePublicHttpUrl("http://127.0.0.1")).toThrow(/private network/);
    expect(() => parsePublicHttpUrl("http://192.168.1.1")).toThrow(/private network/);
    expect(() => parsePublicHttpUrl("http://[::1]")).toThrow(/private network/);
    expect(parsePublicHttpUrl("https://example.com/path#section").toString()).toBe(
      "https://example.com/path",
    );
  });

  test("builds the curl.md fetch URL", () => {
    expect(buildCurlMdUrl(new URL("https://example.com/path?q=1"))).toBe(
      "https://curl.md/https://example.com/path?q=1",
    );
  });

  test("returns markdown from curl.md", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          ["---", "title: Example", "url: https://example.com/", "---", "", "# Example"].join("\n"),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const output = await fetchWebPage("https://example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://curl.md/https://example.com/",
      expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) }),
    );
    expect(output).toMatchObject({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example",
      markdown: expect.stringContaining("# Example"),
      provider: "curl.md",
      truncated: false,
    });
  });

  test("marks protected pages as blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Title: 安全验证 - 知乎", { status: 200 })),
    );

    await expect(fetchWebPage("https://www.zhihu.com/question/1")).resolves.toMatchObject({
      blocked: true,
      error: "Page appears blocked or login-gated.",
    });
  });
});
