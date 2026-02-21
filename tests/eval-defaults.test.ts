import { describe, expect, it } from "vitest";

import { DEFAULT_EVAL_MAX_CONCURRENCY } from "../worker/eval/lib/evalDefaults";

describe("eval defaults", () => {
	it("sets max concurrency default to 1", () => {
		expect(DEFAULT_EVAL_MAX_CONCURRENCY).toBe(1);
	});
});
