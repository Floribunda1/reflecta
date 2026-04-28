import "./style.css";
import { createApp } from "vue";
import { router } from "./router";
import PrimeVue from "primevue/config";
import { VueQueryPlugin } from "@tanstack/vue-query";
import DialogService from "primevue/dialogservice";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import { App } from "./App";
import { ReflectaPreset } from "./theme";

import Tooltip from "primevue/tooltip";

const app = createApp(App);

app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: ReflectaPreset,
    options: {
      darkModeSelector: false,
      cssLayer: {
        name: "primevue",
        order: "theme, base, primevue",
      },
    },
  },
});

app.use(VueQueryPlugin);
app.use(DialogService);
app.use(ConfirmationService);
app.use(ToastService);
app.use(router);
app.mount("#root");
app.directive("tooltip", Tooltip);
