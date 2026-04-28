import { defineComponent, computed } from "vue";
import { useRoute, RouterView, useRouter } from "vue-router";
import { useDialog } from "primevue/usedialog";
import Button from "primevue/button";
import { SettingsDialogContent } from "@renderer/modules/settings/SettingsDialog";
import { GlobalSearch } from "@renderer/modules/shared/biz-components/GlobalSearch";
import appIcon from "../../../../../../build/icon.png";

export const AppLayout = defineComponent({
  name: "AppLayout",
  setup() {
    const route = useRoute();
    const router = useRouter();

    const dialog = useDialog();

    const openSettings = () => {
      dialog.open(SettingsDialogContent, {
        props: {
          header: "设置",
          style: { width: "60vw", maxWidth: "90vw" },
          modal: true,
          dismissableMask: true,
          closeButtonProps: {
            size: "small",
            severity: "secondary",
          },
          pt: {
            root: { class: "!overflow-hidden" },
            header: { class: "!px-8 !py-5" },
            title: { class: "!text-[1.35rem] !font-semibold" },
            content: {
              style: "padding: 0; overflow: hidden;",
              class: "border-t border-surface-100",
            },
          },
        },
      });
    };

    const navItems = computed<Array<{ label: string; value: string; description: string }>>(() => [
      { label: "Capture", value: "Capture", description: "Collect" },
      { label: "Contemplate", value: "Contemplate", description: "Connect" },
      { label: "V2 Wireframe", value: "V2 Wireframe", description: "Cognitive session wireframe" },
    ]);

    return () => (
      <div class="flex h-screen flex-col overflow-hidden bg-surface-0">
        <header class="flex h-[54px] shrink-0 items-center gap-6 border-b border-surface-200/70 bg-surface-0 px-6">
          <div class="flex items-center gap-3">
            <img src={appIcon} alt="" class="h-7 w-7 select-none rounded-md object-contain" />
            <span class="select-none text-[18px] font-semibold leading-none text-color">
              Reflecta
            </span>
          </div>

          <nav class="flex items-center gap-1">
            {navItems.value.map((item) => {
              const active = route.name === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  class={[
                    "flex h-8 items-center rounded-lg px-3.5 text-[14px] font-medium transition-colors",
                    active
                      ? "bg-primary-50 text-primary"
                      : "text-muted-color hover:bg-surface-100 hover:text-color",
                  ]}
                  title={item.description}
                  onClick={() => {
                    if (!active) router.push({ name: item.value });
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div class="ml-auto flex items-center gap-1">
            <GlobalSearch />
            <Button
              text
              rounded
              severity="secondary"
              icon="pi pi-cog"
              aria-label="设置"
              class="!h-8 !w-8"
              onClick={openSettings}
            />
          </div>
        </header>

        {/* Content */}
        <div class="flex flex-1 overflow-hidden">
          <RouterView />
        </div>
      </div>
    );
  },
});
