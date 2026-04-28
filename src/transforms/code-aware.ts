/**
 * Walk a Markdown source string and call `onText` for every span that is
 * outside fenced code blocks and inline code spans. Returns the rewritten
 * string. The callback receives the span text and a mutable report-like
 * object the caller can use to count substitutions.
 *
 * This avoids the perennial regex bug of mangling code samples that
 * happen to contain `[[` or `![[`.
 */
export function rewriteOutsideCode(
	source: string,
	onText: (chunk: string) => string,
): string {
	const out: string[] = [];
	let i = 0;
	while (i < source.length) {
		// Fenced code block: ``` or ~~~ at the start of a line.
		const fenceMatch = matchFenceAt(source, i);
		if (fenceMatch) {
			out.push(source.slice(i, fenceMatch.end));
			i = fenceMatch.end;
			continue;
		}
		// Inline code span: one or more backticks. Match opening run, then
		// look for the same-length closing run.
		if (source[i] === "`") {
			let runLen = 0;
			while (source[i + runLen] === "`") runLen++;
			const closeIdx = findMatchingBacktickRun(source, i + runLen, runLen);
			if (closeIdx !== -1) {
				const end = closeIdx + runLen;
				out.push(source.slice(i, end));
				i = end;
				continue;
			}
		}
		// Plain text up to the next backtick or line that could start a fence.
		const next = nextSpecialIndex(source, i + 1);
		out.push(onText(source.slice(i, next)));
		i = next;
	}
	return out.join("");
}

function matchFenceAt(s: string, i: number): { end: number } | null {
	const atLineStart = i === 0 || s[i - 1] === "\n";
	if (!atLineStart) return null;
	const ch = s[i];
	if (ch !== "`" && ch !== "~") return null;
	let runLen = 0;
	while (s[i + runLen] === ch) runLen++;
	if (runLen < 3) return null;
	// Find the closing fence on its own line.
	let cursor = s.indexOf("\n", i + runLen);
	while (cursor !== -1) {
		const lineStart = cursor + 1;
		// Check whether this line is the matching fence (>= runLen of same char,
		// optionally surrounded by spaces).
		let p = lineStart;
		while (s[p] === " ") p++;
		let close = 0;
		while (s[p + close] === ch) close++;
		if (close >= runLen) {
			// Skip past the closing line.
			const eol = s.indexOf("\n", p + close);
			return { end: eol === -1 ? s.length : eol + 1 };
		}
		cursor = s.indexOf("\n", lineStart);
	}
	return { end: s.length };
}

function findMatchingBacktickRun(s: string, from: number, runLen: number): number {
	let i = from;
	while (i < s.length) {
		if (s[i] !== "`") {
			i++;
			continue;
		}
		let n = 0;
		while (s[i + n] === "`") n++;
		if (n === runLen) return i;
		i += n;
	}
	return -1;
}

function nextSpecialIndex(s: string, from: number): number {
	for (let i = from; i < s.length; i++) {
		if (s[i] === "`") return i;
		if (s[i] === "\n" && (s[i + 1] === "`" || s[i + 1] === "~")) {
			// Could be a fence start; let the main loop re-check.
			return i + 1;
		}
	}
	return s.length;
}
