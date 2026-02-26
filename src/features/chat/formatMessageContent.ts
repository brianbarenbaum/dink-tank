export interface ChatTextRun {
	kind: "text" | "strong" | "em" | "code";
	text: string;
}

export interface ChatContentBlock {
	kind: "paragraph" | "list";
	lines: ChatTextRun[][];
}

const INLINE_TOKEN_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

const parseInlineRuns = (line: string): ChatTextRun[] => {
	const tokens = line.split(INLINE_TOKEN_PATTERN).filter((token) => token.length > 0);
	return tokens.map((token) => {
		if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
			return { kind: "code" as const, text: token.slice(1, -1) };
		}
		if (
			token.startsWith("**") &&
			token.endsWith("**") &&
			token.length > 4
		) {
			return { kind: "strong" as const, text: token.slice(2, -2) };
		}
		if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
			return { kind: "em" as const, text: token.slice(1, -1) };
		}
		return { kind: "text" as const, text: token };
	});
};

const pushParagraph = (blocks: ChatContentBlock[], paragraphLines: string[]) => {
	if (paragraphLines.length === 0) {
		return;
	}
	blocks.push({
		kind: "paragraph",
		lines: paragraphLines.map(parseInlineRuns),
	});
	paragraphLines.length = 0;
};

const pushList = (blocks: ChatContentBlock[], listItems: string[]) => {
	if (listItems.length === 0) {
		return;
	}
	blocks.push({
		kind: "list",
		lines: listItems.map(parseInlineRuns),
	});
	listItems.length = 0;
};

export const formatChatMessageContent = (content: string): ChatContentBlock[] => {
	const lines = content.split(/\r?\n/);
	const blocks: ChatContentBlock[] = [];
	const paragraphLines: string[] = [];
	const listItems: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const listMatch = line.match(/^\s*-\s+(.*)$/);
		if (listMatch) {
			pushParagraph(blocks, paragraphLines);
			listItems.push(listMatch[1]);
			continue;
		}

		if (line.trim().length === 0) {
			pushParagraph(blocks, paragraphLines);
			pushList(blocks, listItems);
			continue;
		}

		pushList(blocks, listItems);
		paragraphLines.push(line);
	}

	pushParagraph(blocks, paragraphLines);
	pushList(blocks, listItems);

	if (blocks.length === 0) {
		return [{ kind: "paragraph", lines: [[{ kind: "text", text: "" }]] }];
	}
	return blocks;
};
