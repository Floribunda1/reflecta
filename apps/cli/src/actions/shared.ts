import { z } from "zod";

export type JsonObject = Record<string, unknown>;

export type CliAction = {
  name: string;
  description: string;
  mutates: boolean;
};

export type ActionHelp = CliAction & {
  command: string;
  input: {
    required: string[];
    optional: string[];
    example: JsonObject;
  };
  output: {
    description: string;
  };
};

export type CliSuccess = {
  ok: true;
  data: unknown;
};

export type CliFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type CliResult = CliSuccess | CliFailure;

export type ActionDefinition<TArgs> = CliAction & {
  inputSchema: JsonObject;
  help: ActionHelp;
  schema: z.ZodTypeAny;
  handler: (args: TArgs) => Promise<unknown>;
};

export const MAX_LIMIT = 100;

export const sourceTypeSchema = z.enum(["experience", "video", "book", "article", "opinion", "ai"]);
export const thoughtTypeSchema = z.enum(["idea", "insight"]);
export const paginationShape = {
  limit: z.number().int().min(1).max(MAX_LIMIT).default(20),
  offset: z.number().int().min(0).default(0),
};
export const confirmShape = {
  confirm: z.boolean(),
};

export function objectSchema(properties: JsonObject, required: string[] = []): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

export function stringProperty(description: string): JsonObject {
  return { type: "string", description };
}

export function optionalStringProperty(description: string): JsonObject {
  return { type: "string", description };
}

export function nullableStringProperty(description: string): JsonObject {
  return { type: ["string", "null"], description };
}

export function numberProperty(description: string, defaultValue?: number): JsonObject {
  return {
    type: "number",
    description,
    ...(defaultValue === undefined ? {} : { default: defaultValue }),
  };
}

export function enumProperty(values: string[], description: string): JsonObject {
  return { type: "string", enum: values, description };
}

export function stringArrayProperty(description: string): JsonObject {
  return { type: "array", items: { type: "string" }, description };
}

export function confirmProperty(): JsonObject {
  return {
    type: "boolean",
    description: "Must be true to execute this mutating action.",
  };
}

export function success(data: unknown): CliSuccess {
  return { ok: true, data };
}

export function failure(code: string, message: string, details?: unknown): CliFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function mutationResult(): undefined {
  return undefined;
}

export function createActionHelp(input: {
  name: string;
  description: string;
  mutates: boolean;
  inputSchema: JsonObject;
  inputExample: JsonObject;
  outputDescription: string;
}): ActionHelp {
  return {
    name: input.name,
    description: input.description,
    mutates: input.mutates,
    command: `reflecta ${input.name} --json '${JSON.stringify(input.inputExample)}'${
      input.mutates ? " --confirm" : ""
    }`,
    input: {
      required: Array.isArray(input.inputSchema.required)
        ? (input.inputSchema.required as string[])
        : [],
      optional: Object.keys((input.inputSchema.properties as JsonObject | undefined) ?? {}).filter(
        (key) => !((input.inputSchema.required as string[] | undefined) ?? []).includes(key),
      ),
      example: input.inputExample,
    },
    output: {
      description: input.outputDescription,
    },
  };
}
