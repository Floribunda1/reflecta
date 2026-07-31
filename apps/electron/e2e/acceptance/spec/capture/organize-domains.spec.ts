import { expect, test } from "@playwright/test";
import { launchApp, openAgentPage } from "../agent/agent-e2e";
import {
  domainNode,
  dragDomainOnto,
  expandDomain,
  expectDomainBefore,
  openCapturePage,
} from "./capture-e2e";

test("@CP-DOMAIN-007 用户创建根 Domain", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page.getByRole("button", { name: "新建领域" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("领域名称").fill("NEW_ROOT_DOMAIN");
    await dialog.getByRole("button", { name: "新建", exact: true }).click();

    await expect(domainNode(page, "NEW_ROOT_DOMAIN")).toBeVisible();
    await domainNode(page, "NEW_ROOT_DOMAIN").click();
    await expect(page.getByTestId("capture-understanding-list-header")).toContainText(
      "NEW_ROOT_DOMAIN",
    );
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-008 用户在已有 Domain 下创建子 Domain", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await page.getByRole("menuitem", { name: "新建子领域" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("领域名称").fill("NEW_CHILD_DOMAIN");
    await dialog.getByRole("button", { name: "新建", exact: true }).click();

    await expect(domainNode(page, "NEW_CHILD_DOMAIN")).toBeVisible();
    await expect(domainNode(page, "Programming")).toHaveAttribute("aria-expanded", "true");
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-009 用户修改 Domain 的名称和父级", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expandDomain(page, "Programming", "DevOps");
    await domainNode(page, "DevOps").click({ button: "right" });
    await page.getByRole("menuitem", { name: "编辑领域" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("领域名称").fill("RENAMED_DOMAIN");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Design", exact: true }).click();
    await dialog.getByRole("button", { name: "保存", exact: true }).click();

    await expect(domainNode(page, "RENAMED_DOMAIN")).toBeVisible();
    await expect(domainNode(page, "Design")).toHaveAttribute("aria-expanded", "true");
    await domainNode(page, "RENAMED_DOMAIN").click();
    await expect(page.getByTestId("capture-understanding-list-header")).toContainText(
      "RENAMED_DOMAIN",
    );
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-010 用户删除 Domain 后仍能从全部领域找到原有理解", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await domainNode(page, "Programming").click({ button: "right" });
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();

    await expect(domainNode(page, "Programming")).toHaveCount(0);
    await expect(page.getByTestId("capture-understanding-list-header")).toContainText("全部领域");
    await expect(domainNode(page, "Frontend").locator(":scope > span").first()).toHaveCSS(
      "padding-left",
      "0px",
    );
    await page.getByRole("button", { name: "搜索理解" }).click();
    await page.getByPlaceholder("查找已有理解").fill("React Server Components");
    await expect(
      page.locator(
        '[data-testid="capture-understanding-row"][data-understanding-title="React Server Components"]',
      ),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-011 用户修改父 Domain 时只看到有效选项", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click({ button: "right" });
    await page.getByRole("menuitem", { name: "编辑领域" }).click();
    await page.getByRole("dialog").getByRole("combobox").click();

    await expect(page.getByRole("option", { name: "Design", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Programming", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Frontend", exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-001 用户拖动根级 Domain 调整顺序", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expectDomainBefore(page, "Programming", "Design");

    await dragDomainOnto(page, "Design", "Programming");
    await expectDomainBefore(page, "Design", "Programming");

    await openAgentPage(page);
    await openCapturePage(page);
    await expectDomainBefore(page, "Design", "Programming");
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-005 用户收起后从理解列表重新展开 Domain Tree", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await page.getByTestId("capture-sidebar-collapse-button").click();

    const sidebarContainer = page.getByTestId("capture-domain-sidebar-container");
    await expect(sidebarContainer).toHaveAttribute("aria-hidden", "true");
    await expect(sidebarContainer).toHaveCSS("width", "0px");
    await expect(page.getByTestId("capture-sidebar-expand-button")).toBeVisible();

    await page.getByTestId("capture-sidebar-expand-button").click();
    await expect(sidebarContainer).toHaveAttribute("aria-hidden", "false");
    await expect(sidebarContainer).toHaveCSS("width", "248px");
    await expect(page.getByTestId("capture-domain-sidebar")).toBeVisible();
    await expect(page.getByTestId("capture-sidebar-collapse-button")).toBeVisible();
  } finally {
    await app.close();
  }
});
