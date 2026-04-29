/**
 * Run `worker` for each item in `items` with at most `concurrency`
 * promises in flight. The worker receives the item, its index, and an
 * `AbortSignal`. If the signal aborts, in-flight workers are awaited
 * (they should observe the signal themselves) and no further items are
 * dispatched.
 */
export async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	signal: AbortSignal,
	worker: (item: T, index: number, signal: AbortSignal) => Promise<void>,
): Promise<void> {
	const limit = Math.max(1, Math.floor(concurrency));
	let cursor = 0;
	const inFlight: Promise<void>[] = [];

	const launch = (): Promise<void> | null => {
		if (signal.aborted) return null;
		const idx = cursor++;
		if (idx >= items.length) return null;
		const item = items[idx] as T;
		const p = worker(item, idx, signal).finally(() => {
			const i = inFlight.indexOf(p);
			if (i >= 0) void inFlight.splice(i, 1);
		});
		inFlight.push(p);
		return p;
	};

	while (cursor < items.length && inFlight.length < limit) {
		if (!launch()) break;
	}
	while (inFlight.length > 0) {
		await Promise.race(inFlight);
		while (!signal.aborted && cursor < items.length && inFlight.length < limit) {
			if (!launch()) break;
		}
	}
}
