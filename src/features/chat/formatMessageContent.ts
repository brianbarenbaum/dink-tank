const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const formatInlineMarkdown = (value: string): string =>
	value
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>");

const renderParagraph = (lines: string[]): string => {
	if (lines.length === 0) {
		return "";
	}

	return `<p>${lines.map(formatInlineMarkdown).join("<br />")}</p>`;
};

const renderList = (items: string[]): string =>
	`<ul>${items
		.map((item) => `<li>${formatInlineMarkdown(item)}</li>`)
		.join("")}</ul>`;

export const formatChatMessageContent = (content: string): string => {
	const lines = escapeHtml(content).split(/\r?\n/);
	const blocks: string[] = [];
	let paragraphLines: string[] = [];
	let listItems: string[] = [];

	const flushParagraph = () => {
		const paragraph = renderParagraph(paragraphLines);
		if (paragraph.length > 0) {
			blocks.push(paragraph);
		}
		paragraphLines = [];
	};

	const flushList = () => {
		if (listItems.length > 0) {
			blocks.push(renderList(listItems));
		}
		listItems = [];
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const listMatch = line.match(/^\s*-\s+(.*)$/);

		if (listMatch) {
			flushParagraph();
			listItems.push(listMatch[1]);
			continue;
		}

		if (line.trim().length === 0) {
			flushParagraph();
			flushList();
			continue;
		}

		flushList();
		paragraphLines.push(line);
	}

	flushParagraph();
	flushList();

	return blocks.join("");
};
