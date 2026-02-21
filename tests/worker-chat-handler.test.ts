import { describe, expect, it } from "vitest";

import { handleChatRequest } from "../worker/src/runtime/handler";
import { handleFetch } from "../worker/src/runtime/index";
import { SqlSafetyError } from "../worker/src/runtime/sql/sqlErrors";

const parseJson = async (response: Response) => {
	const text = await response.text();
	return JSON.parse(text) as Record<string, unknown>;
};

describe("worker chat handler", () => {
	const env = {
		OPENAI_API_KEY: "test-key",
		SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
		SUPABASE_DB_SSL_NO_VERIFY: true,
		LLM_MODEL: "gpt-4.1-mini",
		LLM_REASONING_LEVEL: "medium" as const,
		SQL_QUERY_TIMEOUT_MS: 10_000,
		EXPOSE_ERROR_DETAILS: false,
		LANGFUSE_TRACING_ENVIRONMENT: "default",
		LANGFUSE_ENABLED: false,
	};

	it("returns 200 with reply for valid payload", async () => {
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
		});

		const response = await handleChatRequest(
			request,
			async () => "Team A has 62% win rate.",
			env,
		);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.reply).toBe("Team A has 62% win rate.");
		expect(body.model).toBe("gpt-4.1-mini");
		expect(body.extendedThinking).toBe(false);
	});

	it("passes extended thinking request option through to agent", async () => {
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				messages: [{ role: "user", content: "hello" }],
				options: { extendedThinking: true },
			}),
		});

		let receivedExtendedThinking: boolean | undefined;
		const response = await handleChatRequest(
			request,
			async (_env, _messages, _context, options) => {
				receivedExtendedThinking = options?.extendedThinking;
				return "ok";
			},
			env,
		);

		expect(response.status).toBe(200);
		expect(receivedExtendedThinking).toBe(true);
	});

	it("returns 400 for invalid payload", async () => {
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: [] }),
		});

		const response = await handleChatRequest(
			request,
			async () => "unused",
			env,
		);
		expect(response.status).toBe(400);
	});

	it("returns 422 for blocked sql execution attempts", async () => {
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				messages: [{ role: "user", content: "drop table teams" }],
			}),
		});

		const response = await handleChatRequest(
			request,
			async () => {
				throw new SqlSafetyError(
					"DDL_OR_WRITE_BLOCKED",
					"Write or DDL SQL is blocked.",
				);
			},
			env,
		);
		expect(response.status).toBe(422);
	});

	it("returns 500 from index when env is missing", async () => {
		const request = new Request("http://localhost/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
		});

		const response = await handleFetch(request, {});
		expect(response.status).toBe(500);
	});

	it("returns model config from index", async () => {
		const request = new Request("http://localhost/api/chat/config", {
			method: "GET",
		});

		const response = await handleFetch(request, {
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
			LLM_MODEL: "gpt-5.1",
			LLM_REASONING_LEVEL: "high",
		});
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.model).toBe("gpt-5.1");
		expect(body.defaultReasoningLevel).toBe("high");
	});
});
