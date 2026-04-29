import { createRouter, createWebHashHistory } from "vue-router";
import { AppLayout } from "@renderer/modules/shared/layout/AppLayout";
import { CapturePage } from "@renderer/modules/capture";
import { ContemplatePage } from "@renderer/modules/contemplate";

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
      ],
    },
  ],
});
