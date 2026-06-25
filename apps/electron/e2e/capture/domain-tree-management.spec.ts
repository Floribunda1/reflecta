import { expect, test } from "@playwright/test";
import { launchApp, openAgentPage } from "../agent/agent-e2e";
import {
  domainNode,
  dragDomainOnto,
  expandDomain,
  expectDomainBefore,
  openCapturePage,
  sortableDomainNode,
} from "./capture-e2e";

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

test("@CP-DOMAIN-002 用户拖动根级 Domain 穿过展开子节点调整顺序", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expandDomain(page, "Programming", "Frontend");
    await expectDomainBefore(page, "Design", "Reading");

    await dragDomainOnto(page, "Reading", "DevOps");

    await expectDomainBefore(page, "Programming", "Reading");
    await expectDomainBefore(page, "Reading", "Design");
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-003 展开 Domain 的拖动目标包含子树高度", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expandDomain(page, "Programming", "Frontend");

    const rowBox = await domainNode(page, "Programming").boundingBox();
    const sortableBox = await sortableDomainNode(page, "Programming").boundingBox();

    expect(rowBox?.height).toBeGreaterThan(0);
    expect(sortableBox?.height).toBeGreaterThan((rowBox?.height ?? 0) * 2);
  } finally {
    await app.close();
  }
});

test("@CP-DOMAIN-004 用户拖动展开 Domain 时子树跟随移动", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await expandDomain(page, "Programming", "Frontend");

    const parentBox = await domainNode(page, "Programming").boundingBox();
    const childBox = await domainNode(page, "Frontend").boundingBox();
    if (!parentBox || !childBox) throw new Error("Expanded domain rows are not visible");

    await page.mouse.move(parentBox.x + parentBox.width / 2, parentBox.y + parentBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      parentBox.x + parentBox.width / 2,
      parentBox.y + parentBox.height / 2 + 80,
      {
        steps: 8,
      },
    );

    await expect
      .poll(async () => (await domainNode(page, "Frontend").boundingBox())?.y ?? childBox.y)
      .toBeGreaterThan(childBox.y + 40);
    await page.mouse.up();
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
