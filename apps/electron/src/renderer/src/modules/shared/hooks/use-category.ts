import { useCaptureCategories } from "@renderer/modules/capture/queries";

export const useCategoryData = () => {
  return useCaptureCategories();
};
