import type {
	KVNamespace,
	RateLimit,
	RateLimitOptions,
	RateLimitOutcome,
} from "@cloudflare/workers-types";

export namespace WorkerKVRateLimit {
	export interface KV extends KVNamespace {}

	/**
	 * Options for the WorkerKVRateLimit class.
	 */
	export interface Options {
		/**
		 * The limit (number of requests, number of API calls) to be applied.
		 * This is incremented when you call the limit() function in your Worker.
		 */
		limit: number;
		/**
		 * The period to measure increments to the limit over, in seconds.
		 * Must be 10 or 60.
		 */
		period: 10 | 60;
	}

	/** @internal */
	export interface Result {
		/**
		 * The number of requests remaining in the current period.
		 */
		remaining: number;
		/**
		 * The time at which the current period ends, in milliseconds since the
		 * Unix epoch.
		 */
		reset: number;
	}

	export namespace Limit {
		export interface Options extends RateLimitOptions {}
		export interface Outcome extends RateLimitOutcome {}
	}
}

export class WorkerKVRateLimit implements RateLimit {
	#limit: WorkerKVRateLimit.Options["limit"];
	#period: WorkerKVRateLimit.Options["period"];

	constructor(
		protected kv: WorkerKVRateLimit.KV,
		options?: WorkerKVRateLimit.Options,
	) {
		this.#limit = options?.limit ?? 10;
		this.#period = options?.period ?? 60;
	}

	async limit(
		options: WorkerKVRateLimit.Limit.Options,
	): Promise<WorkerKVRateLimit.Limit.Outcome> {
		let limit = this.#limit;
		let period = this.#period;

		let key = this.getPrefixedKey(options.key);

		let result = await this.kv.get<WorkerKVRateLimit.Result>(key, "json");

		if (!result) {
			result = { remaining: limit, reset: Date.now() + period * 1000 };
		}

		// Reduce the remaining count by 1 if it's greater than 0
		if (result.remaining >= 0) result.remaining -= 1;

		// Set the reset time to the current time plus the period
		result.reset = Date.now() + period * 1000;

		// Store the updated result in the KV store
		await this.kv.put(key, JSON.stringify(result), {
			expirationTtl: period,
		});

		// Return the outcome
		return { success: result.remaining >= 0 };
	}

	/**
	 * Reset the rate limit for a given key.
	 * @param key The key to reset the rate limit for.
	 */
	async reset(options: RateLimitOptions): Promise<void> {
		let key = this.getPrefixedKey(options.key);
		await this.kv.delete(key);
	}

	async writeHttpMetadata(
		options: RateLimitOptions & { resource?: string },
		headers = new Headers(),
	): Promise<Headers> {
		let limit = this.#limit;
		let period = this.#period;

		let key = this.getPrefixedKey(options.key);

		let result = await this.kv.get<WorkerKVRateLimit.Result>(key, "json");

		if (!result) {
			result = { remaining: limit, reset: Date.now() + period * 1000 };
		}

		headers.append("X-RateLimit-Limit", this.#limit.toString());
		headers.append("X-RateLimit-Remaining", result.remaining.toString());
		headers.append(
			"X-RateLimit-Used",
			(this.#limit - result.remaining).toString(),
		);
		headers.append("X-RateLimit-Reset", result.reset.toString());

		if (options.resource) {
			headers.append("X-RateLimit-Resource", options.resource);
		}

		// Standard HTTP header for rate limiting
		headers.append("Retry-After", result.reset.toString());

		return headers;
	}

	private getPrefixedKey<K extends string>(key: K): `rl:${K}` {
		return `rl:${key}`;
	}
}
