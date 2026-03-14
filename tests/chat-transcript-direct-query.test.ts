import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import ChatTranscript from "../src/features/chat/components/ChatTranscript.vue";
import { createChatController } from "../src/features/chat/useChatController";
import type {
	ChatMessage,
	DataBrowserQueryRequest,
	DirectQueryCardItem,
} from "../src/features/chat/types";

const buildDivisionPlayersRequest = (): DataBrowserQueryRequest => ({
	queryType: "division_players",
	scope: {
		seasonYear: 2025,
		seasonNumber: 3,
		divisionId: "11111111-1111-4111-8111-111111111111",
		divisionName: "3.5",
		teamId: null,
		teamName: null,
	},
	viewState: {
		page: 1,
		pageSize: 20,
		sortKey: "ranking",
		sortDirection: "asc",
	},
});

const buildDirectQueryCard = (
	overrides: Partial<DirectQueryCardItem> = {},
): DirectQueryCardItem => ({
	kind: "direct_query_card",
	id: "direct-query-card-1",
	queryId: "query-1",
	queryType: "division_players",
	layout: "table",
	title: "Division Players",
	breadcrumb: ["2025 S3", "3.5", "Players"],
	createdAt: new Date(0).toISOString(),
	fetchedAt: new Date(0).toISOString(),
	status: "success",
	request: buildDivisionPlayersRequest(),
	page: 1,
	pageSize: 20,
	totalRows: 1,
	totalPages: 1,
	sortKey: "ranking",
	sortDirection: "asc",
	errorMessage: null,
	payload: {
		columns: [
			{ key: "ranking", label: "Rank" },
			{ key: "playerName", label: "Player" },
		],
		rows: [{ ranking: 1, playerName: "Jamie Fox" }],
	},
	...overrides,
});

describe("ChatTranscript direct query items", () => {
	it("renders text messages and direct-query cards without using the markdown bubble path", () => {
		const assistantMessage: ChatMessage = {
			id: "assistant-1",
			role: "assistant",
			content: "Here is the latest snapshot.",
			createdAt: new Date(0).toISOString(),
		};

		const wrapper = mount(ChatTranscript, {
			props: {
				messages: [assistantMessage, buildDirectQueryCard()],
			},
		});

		expect(wrapper.findAll(".chat-message-bubble")).toHaveLength(1);
		expect(wrapper.find("[data-testid='direct-query-card']").exists()).toBe(
			true,
		);
		expect(wrapper.text()).not.toContain("Direct query");
		expect(wrapper.text()).not.toContain("Division Players");
		expect(wrapper.text()).toContain("2025 S3 / 3.5 / Players");
	});

	it("appends repeated direct-query cards as distinct transcript items", () => {
		const send = vi.fn().mockResolvedValue({ reply: "ok", model: "gpt-5.1" });
		const controller = createChatController(send) as ReturnType<
			typeof createChatController
		> & {
			appendDirectQueryCard: (input: Omit<DirectQueryCardItem, "id">) => string;
		};

		const firstId = controller.appendDirectQueryCard(
			buildDirectQueryCard({ id: "placeholder-a" }),
		);
		const secondId = controller.appendDirectQueryCard(
			buildDirectQueryCard({
				id: "placeholder-b",
				createdAt: new Date(1).toISOString(),
			}),
		);

		expect(firstId).not.toBe(secondId);
		expect(
			controller.messages.value.filter(
				(item): item is DirectQueryCardItem =>
					"kind" in item && item.kind === "direct_query_card",
			),
		).toHaveLength(2);
	});
});
