import { z } from "zod";
import { getServices } from "../services";
import {
  confirmProperty,
  confirmShape,
  createActionHelp,
  mutationResult,
  nullableStringProperty,
  numberProperty,
  objectSchema,
  stringProperty,
  type ActionDefinition,
} from "./shared";

type ReorderCategoryArgs = {
  items: Array<{
    id: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  confirm: boolean;
};

const inputSchema = objectSchema(
  {
    items: {
      type: "array",
      description: "Category reorder items.",
      items: objectSchema(
        {
          id: stringProperty("Category ID."),
          parentId: nullableStringProperty("Parent category ID, or null for root."),
          sortOrder: numberProperty("Sort order."),
        },
        ["id", "parentId", "sortOrder"],
      ),
    },
    confirm: confirmProperty(),
  },
  ["items", "confirm"],
);

export const reorderCategoriesAction = {
  name: "reorder_categories",
  description:
    "Mutates Reflecta. Reorder categories and update parent relationships. Requires confirm: true.",
  mutates: true,
  inputSchema,
  help: createActionHelp({
    name: "reorder_categories",
    description:
      "Mutates Reflecta. Reorder categories and update parent relationships. Requires confirm: true.",
    mutates: true,
    inputSchema,
    inputExample: { items: [{ id: "category-id", parentId: null, sortOrder: 0 }], confirm: true },
    outputDescription: "-",
  }),
  schema: z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        parentId: z.string().nullable(),
        sortOrder: z.number().int(),
      }),
    ),
    ...confirmShape,
  }),
  handler: async ({ items }) => {
    const services = await getServices();
    await services.categories.reorderCategories(items);
    return mutationResult();
  },
} satisfies ActionDefinition<ReorderCategoryArgs>;
