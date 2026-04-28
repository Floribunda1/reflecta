import { createRouter, createWebHashHistory } from "vue-router";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ContemplatePage } from "@renderer/modules/contemplate";
import { V2WireframePage } from "@renderer/modules/v2-wireframe";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: AppLayout,
      redirect: "/capture",
      children: [
        { path: "/capture", name: "Capture", component: CapturePage },
        { path: "/contemplate", name: "Contemplate", component: ContemplatePage },
        { path: "/v2-wireframe", name: "V2 Wireframe", component: V2WireframePage },
      ],
    },
  ],
});
