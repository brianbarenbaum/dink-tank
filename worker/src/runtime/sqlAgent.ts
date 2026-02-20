import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import * as z from "zod";

import { emitLangfuseTelemetry } from "../observability/langfuseTelemetry";
import { selectCatalogContext } from "./catalog/catalog";
import type { WorkerEnv } from "./env";
import type { RequestContext } from "./requestContext";
import { logWarn } from "./runtimeLogger";
import { buildSqlSystemPrompt } from "./prompt";
import { executeReadOnlySql } from "./sql/sqlExecutor";

/**
 * Returns the current epoch time in milliseconds.
 */
const nowMs = (): number => Date.now();
const CATALOG_SELECTION_MODE = "hybrid" as const;
const CATALOG_TOP_K = 2;
const CATALOG_CONFIDENCE_MIN = 0.35;
const CATALOG_MAX_COLUMNS_PER_VIEW = 20;

/**
 * Extracts final assistant text from the LangChain agent response shape.
 */
const extractAgentText = (result: unknown): string => {
	if (!result || typeof result !== "object") {
		return "I could not generate a response.";
	}

	const candidate = result as {
		output?: string;
		messages?: Array<{ content?: unknown }>;
	};

	if (
		typeof candidate.output === "string" &&
		candidate.output.trim().length > 0
	) {
		return candidate.output;
	}

	const lastMessage = candidate.messages?.at(-1);
	if (
		typeof lastMessage?.content === "string" &&
		lastMessage.content.trim().length > 0
	) {
		return lastMessage.content;
	}

	return "I could not generate a response.";
};

/**
 * Extracts prompt/completion token usage from model response metadata.
 */
const extractTokenUsage = (
	response: unknown,
): { promptTokens: number; completionTokens: number } => {
	if (!response || typeof response !== "object") {
		return { promptTokens: 0, completionTokens: 0 };
	}

	const metadata = (response as { response_metadata?: unknown })
		.response_metadata;
	if (!metadata || typeof metadata !== "object") {
		return { promptTokens: 0, completionTokens: 0 };
	}

	const tokenUsage = (metadata as { tokenUsage?: unknown }).tokenUsage;
	if (!tokenUsage || typeof tokenUsage !== "object") {
		return { promptTokens: 0, completionTokens: 0 };
	}

	return {
		promptTokens:
			typeof (tokenUsage as { promptTokens?: unknown }).promptTokens ===
			"number"
				? ((tokenUsage as { promptTokens: number }).promptTokens ?? 0)
				: 0,
		completionTokens:
			typeof (tokenUsage as { completionTokens?: unknown }).completionTokens ===
			"number"
				? ((tokenUsage as { completionTokens: number }).completionTokens ?? 0)
				: 0,
	};
};

/**
 * Runs the SQL chat agent end-to-end: catalog selection, tool-backed query execution, and telemetry.
 */
export const runSqlAgent = async (
	env: WorkerEnv,
	messages: Array<{ role: "user" | "assistant"; content: string }>,
	context: RequestContext,
): Promise<string> => {
	const startMs = nowMs();
	const inputMessage =
		messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
	const selectedCatalog = selectCatalogContext(inputMessage, {
		mode: CATALOG_SELECTION_MODE,
		topK: CATALOG_TOP_K,
		confidenceMin: CATALOG_CONFIDENCE_MIN,
		maxColumnsPerView: CATALOG_MAX_COLUMNS_PER_VIEW,
	});
	const catalogContext =
		selectedCatalog.catalogContext ?? selectedCatalog.selectedSchema;

	const executeSql = tool(async ({ query }) => executeReadOnlySql(env, query), {
		name: "execute_sql",
		description: "Execute a read-only SQL query.",
		schema: z.object({ query: z.string() }),
	});

	const model = new ChatOpenAI({
		apiKey: env.OPENAI_API_KEY,
		model: env.LLM_MODEL,
		temperature: 1,
		timeout: env.SQL_QUERY_TIMEOUT_MS,
	});

	const agent = createAgent({
		model,
		tools: [executeSql],
		systemPrompt: buildSqlSystemPrompt({
			catalogContext,
			selectionReason: selectedCatalog.reason,
		}),
	});

	const response = await agent.invoke({ messages });
	const tokenUsage = extractTokenUsage(response);
	const reply = extractAgentText(response);
	const telemetryResult = await emitLangfuseTelemetry(
		env,
		"legacy_sql_telemetry",
		{
			orchestrator: "legacy",
			totalMs: nowMs() - startMs,
			promptTokens: tokenUsage.promptTokens,
			completionTokens: tokenUsage.completionTokens,
			messageCount: messages.length,
			catalogContextChars: catalogContext.length,
			selectedViews: selectedCatalog.selectedViews,
			selectorConfidence: selectedCatalog.confidence,
			selectorReason: selectedCatalog.reason,
			selectorSource: selectedCatalog.source,
			requestId: context.requestId,
		},
		{
			input: inputMessage,
			output: reply,
		},
	);

	if (!telemetryResult.ok && telemetryResult.reason !== "disabled") {
		logWarn("langfuse_emit_failed", context, {
			telemetryReason: telemetryResult.reason,
			statusCode: telemetryResult.statusCode,
		});
	}

	return reply;
};
