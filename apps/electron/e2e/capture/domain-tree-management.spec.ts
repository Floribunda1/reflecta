import { test } from "@playwright/test";
import { launchApp, openAgentPage } from "../agent/agent-e2e";
import { dragDomainOnto, expectDomainBefore, openCapturePage } from "./capture-e2e";

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
