import { describe, expect, it } from "vitest";

import { handleChatRequest } from "../worker/src/chat/handler";
import { handleFetch } from "../worker/src/index";

const parseJson = async (response: Response) => {
	const text = await response.text();
	return JSON.parse(text) as Record<string, unknown>;
};

describe("worker chat handler", () => {
	const env = {
		OPENAI_API_KEY: "test-key",
		SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
		LLM_MODEL: "gpt-4.1-mini",
		SQL_QUERY_TIMEOUT_MS: 10_000,
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
				throw new Error("Write or DDL SQL is blocked.");
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
});
