import Drawer, { DrawerProps } from "primevue/drawer";
import { defineComponent, inject, provide, ref, shallowRef, VNode } from "vue";

export const DrawerContextProvider = defineComponent({
  setup(_, { slots }) {
    const drawerVisible = ref(false);
    const drawerProps = shallowRef<Partial<DrawerProps>>({});
    const _children = ref<VNode | null>(null);

    const openDrawer = (props: DrawerProps, children: VNode) => {
      drawerProps.value = props;
      _children.value = children;
      drawerVisible.value = true;
    };

    const closeDrawer = () => {
      drawerVisible.value = false;
    };

    provide("openDrawer", openDrawer);
    provide("closeDrawer", closeDrawer);

    return () => (
      <>
        <Drawer
          v-model:visible={drawerVisible.value}
          {...drawerProps.value}
          onAfter-hide={() => {
            _children.value = null;
            drawerProps.value = {};
          }}
        >
          {_children.value}
        </Drawer>
        {slots.default?.()}
      </>
    );
  },
});

export const useSharedDrawer = () => {
  const openDrawer = inject("openDrawer") as (
    props: DrawerProps & { class?: string; style?: any },
    children: VNode,
  ) => void;
  const closeDrawer = inject("closeDrawer") as () => void;

  if (!openDrawer || !closeDrawer) {
    throw new Error("useSharedDrawer must be used within a DrawerContextProvider");
  }

  return { openDrawer, closeDrawer };
};
