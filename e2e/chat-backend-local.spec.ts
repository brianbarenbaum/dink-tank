import { expect, test } from "@playwright/test";

const runLocalBackend = process.env.RUN_LOCAL_BACKEND_E2E === "1";

test.describe("local backend worker", () => {
	test.skip(
		!runLocalBackend,
		"Set RUN_LOCAL_BACKEND_E2E=1 with worker env configured.",
	);

	test("worker /api/chat returns reply payload", async ({ request }) => {
		const workerBaseUrl =
			process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8787";
		const response = await request.post(`${workerBaseUrl}/api/chat`, {
			headers: { "content-type": "application/json" },
			data: {
				messages: [
					{ role: "user", content: "Who has the highest win percentage?" },
				],
			},
		});

		expect(response.status()).toBe(200);
		const payload = (await response.json()) as { reply: string };
		expect(typeof payload.reply).toBe("string");
		expect(payload.reply.length).toBeGreaterThan(0);
	});
});
