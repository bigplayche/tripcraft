import OpenAI from "openai";
import { z } from "zod";
import { recordUsage, type UsageKind } from "@/lib/entitlements";

let client: OpenAI | null = null;
export function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 240_000, maxRetries: 1 });
  return client;
}
export const aiModel = () => process.env.OPENAI_MODEL || "gpt-5-mini";

/** Reasoning-model knob; only sent when set because non-reasoning models reject it. */
export function extraParams() {
  const effort = process.env.OPENAI_REASONING_EFFORT;
  return effort ? { reasoning_effort: effort as "low" | "medium" | "high" } : {};
}

export function jsonSchemaFormat<T extends z.ZodType>(name: string, schema: T) {
  const { $schema: _drop, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return { type: "json_schema" as const, json_schema: { name, strict: true, schema: json } };
}

export class AiError extends Error {}

/** One structured (JSON-schema constrained) completion, validated with zod and metered. */
export async function structured<T extends z.ZodType>(opts: {
  name: string;
  schema: T;
  system: string;
  user: string;
  userId: string;
  kind: UsageKind;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const model = aiModel();
  const res = await openai().chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: jsonSchemaFormat(opts.name, opts.schema),
    max_completion_tokens: opts.maxTokens ?? 16000,
    ...extraParams(),
  });
  await recordUsage(opts.userId, opts.kind, model, res.usage?.prompt_tokens, res.usage?.completion_tokens);
  const choice = res.choices[0];
  if (choice?.message.refusal) throw new AiError("The AI declined this request.");
  if (choice?.finish_reason === "length") throw new AiError("The plan was too long to finish. Try a shorter trip or regenerate.");
  try {
    return opts.schema.parse(JSON.parse(choice?.message.content ?? ""));
  } catch {
    throw new AiError("The AI returned an unexpected format. Please try again.");
  }
}
