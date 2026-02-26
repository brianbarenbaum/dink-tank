import { describe, expect, it, vi } from "vitest";

const { runLineupLabRecommendMock } = vi.hoisted(() => ({
	runLineupLabRecommendMock: vi.fn(async () => ({
		requestId: "req_index_route",
		generatedAt: new Date(0).toISOString(),
		objective: "MAX_EXPECTED_WINS" as const,
		recommendations: [],
		scenarioSummary: { scenarioCount: 0 },
		playerDirectory: {},
	})),
}));

vi.mock("../worker/src/runtime/lineupLab/service", () => ({
	runLineupLabRecommend: runLineupLabRecommendMock,
}));

import { handleLineupLabRecommendRequest } from "../worker/src/runtime/lineupLab/handler";
import { handleFetch } from "../worker/src/runtime/index";

const parseJson = async (response: Response) => {
	const text = await response.text();
	return JSON.parse(text) as Record<string, unknown>;
};

const MALE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FEMALE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FEMALE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MALE_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const buildKnownRounds = () =>
	[
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
		["mixed", "mixed", "mixed", "mixed"],
		["female", "female", "male", "male"],
	].map((slotTypes, roundIndex) => ({
		roundNumber: roundIndex + 1,
		games: slotTypes.map((matchType, slotIndex) => ({
			roundNumber: roundIndex + 1,
			slotNumber: slotIndex + 1,
			matchType,
			opponentPlayerAId:
				matchType === "mixed" || matchType === "male" ? MALE_A : FEMALE_B,
			opponentPlayerBId:
				matchType === "mixed"
					? FEMALE_B
					: matchType === "female"
						? FEMALE_C
						: MALE_D,
		})),
	}));

const buildOpponentRoster = () => [
	{ playerId: MALE_A, gender: "Male" },
	{ playerId: FEMALE_B, gender: "Female" },
	{ playerId: FEMALE_C, gender: "Female" },
	{ playerId: MALE_D, gender: "Male" },
];

describe("lineup lab handler", () => {
	const env = {
		OPENAI_API_KEY: "test-key",
		SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
		SUPABASE_DB_SSL_NO_VERIFY: true,
		APP_ENV: "local" as const,
		SUPABASE_URL: "https://example.supabase.co",
		SUPABASE_ANON_KEY: "anon-key",
		AUTH_ALLOWED_ORIGINS: ["http://localhost:5173"],
		AUTH_JWT_ISSUER: "https://example.supabase.co/auth/v1",
		AUTH_JWT_AUDIENCE: "authenticated",
		AUTH_BYPASS_ENABLED: false,
		AUTH_TURNSTILE_BYPASS: true,
		AUTH_IP_HASH_SALT: "test-salt",
		LLM_MODEL: "gpt-4.1-mini",
		LLM_REASONING_LEVEL: "medium" as const,
		SQL_QUERY_TIMEOUT_MS: 10_000,
		SQL_CAPTURE_EXPLAIN_PLAN: false,
		EXPOSE_ERROR_DETAILS: false,
		LANGFUSE_TRACING_ENVIRONMENT: "default",
		LANGFUSE_ENABLED: false,
	};

	it("returns 200 with recommendation payload", async () => {
		const request = new Request("http://localhost/api/lineup-lab/recommend", {
			method: "POST",
			headers: { "content-type": "application/json" },
				body: JSON.stringify({
					divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
					seasonYear: 2025,
					seasonNumber: 3,
					teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						mode: "blind",
						availablePlayerIds: [
						"11111111-1111-4111-8111-111111111111",
						"22222222-2222-4222-8222-222222222222",
						"33333333-3333-4333-8333-333333333333",
						"44444444-4444-4444-8444-444444444444",
						"55555555-5555-4555-8555-555555555555",
						"66666666-6666-4666-8666-666666666666",
						"77777777-7777-4777-8777-777777777777",
						"88888888-8888-4888-8888-888888888888",
				],
				objective: "MAX_EXPECTED_WINS",
			}),
		});

		const response = await handleLineupLabRecommendRequest(
			request,
			async () => ({
				requestId: "req_123",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 0 },
				playerDirectory: {},
			}),
			env,
		);
		const body = await parseJson(response);

		expect(response.status).toBe(200);
		expect(body.requestId).toBe("req_123");
	});

	it("returns 400 for invalid request", async () => {
		const request = new Request("http://localhost/api/lineup-lab/recommend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ divisionId: "not-a-real-request" }),
		});

		const response = await handleLineupLabRecommendRequest(
			request,
			async () => ({
				requestId: "req_123",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 0 },
				playerDirectory: {},
			}),
			env,
		);

		expect(response.status).toBe(400);
	});

	it("returns 400 when matchupId is omitted", async () => {
		const request = new Request("http://localhost/api/lineup-lab/recommend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
					oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
					mode: "blind",
					availablePlayerIds: [
					"11111111-1111-4111-8111-111111111111",
					"22222222-2222-4222-8222-222222222222",
					"33333333-3333-4333-8333-333333333333",
					"44444444-4444-4444-8444-444444444444",
					"55555555-5555-4555-8555-555555555555",
					"66666666-6666-4666-8666-666666666666",
					"77777777-7777-4777-8777-777777777777",
					"88888888-8888-4888-8888-888888888888",
				],
				objective: "MAX_EXPECTED_WINS",
			}),
		});

		const response = await handleLineupLabRecommendRequest(
			request,
			async () => ({
				requestId: "req_123",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 0 },
				playerDirectory: {},
			}),
			env,
		);

		expect(response.status).toBe(400);
	});

	it("routes request from index", async () => {
		const request = new Request("http://localhost/api/lineup-lab/recommend", {
			method: "POST",
			headers: { "content-type": "application/json" },
				body: JSON.stringify({
					divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
					seasonYear: 2025,
					seasonNumber: 3,
					teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
						oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
						matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
						mode: "blind",
						availablePlayerIds: [
						"11111111-1111-4111-8111-111111111111",
						"22222222-2222-4222-8222-222222222222",
						"33333333-3333-4333-8333-333333333333",
						"44444444-4444-4444-8444-444444444444",
						"55555555-5555-4555-8555-555555555555",
						"66666666-6666-4666-8666-666666666666",
						"77777777-7777-4777-8777-777777777777",
						"88888888-8888-4888-8888-888888888888",
				],
				objective: "MAX_EXPECTED_WINS",
			}),
		});

		const response = await handleFetch(request, {
			OPENAI_API_KEY: "test-key",
			SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
			SUPABASE_URL: "https://example.supabase.co",
			SUPABASE_ANON_KEY: "anon-key",
			AUTH_IP_HASH_SALT: "test-salt",
			AUTH_TURNSTILE_BYPASS: "true",
			AUTH_BYPASS_ENABLED: "true",
		});

		expect(response.status).not.toBe(404);
	});

	it("returns 200 for known-opponent payload", async () => {
		const request = new Request("http://localhost/api/lineup-lab/recommend", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
				seasonYear: 2025,
				seasonNumber: 3,
				teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
				oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
				matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
				mode: "known_opponent",
				availablePlayerIds: [
					"11111111-1111-4111-8111-111111111111",
					"22222222-2222-4222-8222-222222222222",
					"33333333-3333-4333-8333-333333333333",
					"44444444-4444-4444-8444-444444444444",
					"55555555-5555-4555-8555-555555555555",
					"66666666-6666-4666-8666-666666666666",
					"77777777-7777-4777-8777-777777777777",
					"88888888-8888-4888-8888-888888888888",
				],
				objective: "MAX_EXPECTED_WINS",
				opponentRounds: buildKnownRounds(),
				opponentRoster: buildOpponentRoster(),
			}),
		});

		const response = await handleLineupLabRecommendRequest(
			request,
			async () => ({
				requestId: "req_123",
				generatedAt: new Date(0).toISOString(),
				objective: "MAX_EXPECTED_WINS",
				recommendations: [],
				scenarioSummary: { scenarioCount: 0 },
				playerDirectory: {},
			}),
			env,
		);
		expect(response.status).toBe(200);
	});
});
