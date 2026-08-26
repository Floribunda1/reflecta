import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedUnderstanding } from "../agent/agent-fixtures";
import { domainNode, openCapturePage, understandingCard } from "./capture-e2e";

test("@CP-LIST-005 用户打开 Dashboard 看到最近更新的 Understanding 在前", async () => {
  seedUnderstanding({
    id: "sort-old-created",
    title: "较早创建但最近更新",
    body: "用于验收更新时间排序",
    createdAt: "2029-01-01T00:00:00.000Z",
    updatedAt: "2031-01-01T00:00:00.000Z",
  });
  seedUnderstanding({
    id: "sort-new-created",
    title: "最近创建但较早更新",
    body: "用于验收创建时间排序",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expect(page.getByTestId("capture-understanding-card").first()).toHaveAttribute(
      "data-understanding-title",
      "较早创建但最近更新",
    );
  } finally {
    await app.close();
  }
});

test("@CP-LIST-002 用户选择 Domain 后只看到当前领域中的 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();

    await expect(page.getByTestId("capture-understanding-card").first()).toBeVisible();
    // 产品语义：选择领域后网格应只显示该领域（含子域）的理解。
    // 网格用虚拟滚动，.count() 只反映可视窗口而非真实总数，不能用「数量减少」断言；
    // 改为校验每张可见卡片的领域 chip 都属所选领域树（Programming 及其子域）。
    const progDomains = [
      "Programming",
      "Frontend",
      "Backend",
      "DevOps",
      "React",
      "Vue",
      "CSS",
      "Node.js",
      "Database",
      "API Design",
    ];
    const foreign = await page.$$eval(
      '[data-testid="capture-understanding-card"]',
      (cards, allowed) =>
        cards
          .filter((card) => {
            const chips = Array.from(card.querySelectorAll("[data-domain-name]")).map(
              (el) => el.getAttribute("data-domain-name") ?? "",
            );
            // 无领域标签的理解（noDomain）在选领域时会被过滤，不算作「非当前领域」
            if (chips.length === 0) return false;
            // 卡片只显示前 2 个领域；带「+N」溢出的多领域卡，其第 3+ 个领域可能含编程，
            // 无法从显示判断是否纯非编程，跳过此项。
            const wrap = card.querySelector("[data-domain-name]")?.parentElement;
            if (wrap && /\+\d+/.test(wrap.textContent ?? "")) return false;
            return !chips.some((n) => allowed.includes(n));
          })
          .map((card) => card.getAttribute("data-understanding-title")),
      progDomains,
    );
    expect(foreign).toEqual([]);
  } finally {
    await app.close();
  }
});

test("@CP-LIST-004 用户搜索关键词并清空恢复", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page.getByPlaceholder("查找已有理解").fill("Server Components");

    await expect(understandingCard(page, "React Server Components")).toBeVisible();

    await page.getByPlaceholder("查找已有理解").fill("");
    await expect(understandingCard(page, "React Server Components")).toBeVisible();
    await expect(page.getByTestId("capture-understanding-card").first()).toBeVisible();
  } finally {
    await app.close();
  }
});
