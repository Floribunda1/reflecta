import { defineComponent } from "vue";
import { RouterView } from "vue-router";
import ConfirmDialog from "primevue/confirmdialog";
import DynamicDialog from "primevue/dynamicdialog";
import { DrawerContextProvider } from "./modules/shared/hooks/use-drawer";

export const App = defineComponent({
  name: "App",
  setup() {
    return () => (
      <>
        <DrawerContextProvider>
          <ConfirmDialog />
          <DynamicDialog />
          <RouterView />
        </DrawerContextProvider>
      </>
    );
  },
});
