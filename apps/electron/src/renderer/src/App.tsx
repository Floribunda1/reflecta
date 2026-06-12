import { RouterProvider } from "react-router-dom";
import { DrawerContextProvider } from "./modules/shared/hooks/use-drawer";
import { ModalProvider } from "./modules/shared/hooks/use-modal";
import { router } from "./router";

export function App() {
  return (
    <ModalProvider>
      <DrawerContextProvider>
        <RouterProvider router={router} />
      </DrawerContextProvider>
    </ModalProvider>
  );
}
