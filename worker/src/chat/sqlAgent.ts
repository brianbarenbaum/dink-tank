import { SqlDatabase } from "@langchain/classic/sql_db";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { DataSource } from "typeorm";
import * as z from "zod";

import type { WorkerEnv } from "../env";
import { buildSqlSystemPrompt } from "./prompt";
import { sanitizeSqlQuery } from "./sqlSafety";

let cachedDb: SqlDatabase | null = null;

const getDb = async (env: WorkerEnv): Promise<SqlDatabase> => {
	if (cachedDb) {
		return cachedDb;
	}

	const source = new DataSource({
		type: "postgres",
		url: env.SUPABASE_DB_URL,
		extra: {
			ssl: {
				rejectUnauthorized: false,
			},
		},
	});

	cachedDb = await SqlDatabase.fromDataSourceParams({ appDataSource: source });
	return cachedDb;
};

const extractAgentText = (result: unknown): string => {
	if (!result || typeof result !== "object") {
		return "I could not generate a response.";
	}

	const candidate = result as {
		output?: string;
		messages?: Array<{ content?: unknown }>;
	};

	if (typeof candidate.output === "string" && candidate.output.trim().length > 0) {
		return candidate.output;
	}

	const lastMessage = candidate.messages?.at(-1);
	if (typeof lastMessage?.content === "string" && lastMessage.content.trim().length > 0) {
		return lastMessage.content;
	}

	return "I could not generate a response.";
};

export const runSqlAgent = async (
	env: WorkerEnv,
	messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> => {
	const db = await getDb(env);
	const schema = await db.getTableInfo();

	const executeSql = tool(
		async ({ query }) => {
			const sanitized = sanitizeSqlQuery(query);
			const result = await db.run(sanitized);
			return typeof result === "string" ? result : JSON.stringify(result, null, 2);
		},
		{
			name: "execute_sql",
			description: "Execute a read-only SQL query.",
			schema: z.object({ query: z.string() }),
		},
	);

	const model = new ChatOpenAI({
		apiKey: env.OPENAI_API_KEY,
		model: env.LLM_MODEL,
		temperature: 0,
		timeout: env.SQL_QUERY_TIMEOUT_MS,
	});

	const agent = createAgent({
		model,
		tools: [executeSql],
		systemPrompt: buildSqlSystemPrompt(schema),
	});

	const response = await agent.invoke({ messages });
	return extractAgentText(response);
};
