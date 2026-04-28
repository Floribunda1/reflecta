import Button, { ButtonProps } from "primevue/button";
import { defineComponent, PropType } from "vue";

export const FooterButton = defineComponent({
  name: "FooterButton",
  props: {
    okProps: {
      type: Object as PropType<ButtonProps>,
    },
    cancelProps: {
      type: Object as PropType<ButtonProps>,
    },
  },
  setup(props) {
    return () => (
      <div class="flex justify-end gap-2 w-full">
        <Button severity="secondary" {...props.cancelProps}>
          取消
        </Button>
        <Button {...props.okProps}>确定</Button>
      </div>
    );
  },
});
