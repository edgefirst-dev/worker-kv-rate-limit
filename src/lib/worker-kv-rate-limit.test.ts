import { describe, expect, mock, test } from "bun:test";

import type { KVNamespace } from "@cloudflare/workers-types";
import { WorkerKVRateLimit } from "./worker-kv-rate-limit";

const state = new Map<string, WorkerKVRateLimit.Result>();

const get = mock().mockImplementation((key) => state.get(key) ?? null);
const put = mock().mockImplementation((key, value) =>
	state.set(key, JSON.parse(value)),
);
const del = mock().mockImplementation((key) => state.delete(key));

const kv = { get, put, delete: del } as unknown as KVNamespace;

describe(WorkerKVRateLimit.name, () => {
	test("#limit returns true if not limited yet", async () => {
		let rateLimit = new WorkerKVRateLimit(kv, { limit: 2, period: 60 });
		let key = "key:1";

		expect(rateLimit.limit({ key })).resolves.toEqual({ success: true });
	});

	test("#limit returns false if already limited", async () => {
		let rateLimit = new WorkerKVRateLimit(kv, { limit: 1, period: 60 });
		let key = "key:2";

		await rateLimit.limit({ key });
		expect(rateLimit.limit({ key })).resolves.toEqual({ success: false });
	});

	test("#reset removes the key from the rate limit", async () => {
		let rateLimit = new WorkerKVRateLimit(kv, { limit: 1, period: 60 });
		let key = "key:3";

		await rateLimit.limit({ key });
		await rateLimit.reset({ key });
		expect(rateLimit.limit({ key })).resolves.toEqual({ success: true });
	});

	test("#writeHttpMetadata applies headers to Headers object", async () => {
		let rateLimit = new WorkerKVRateLimit(kv, { limit: 1, period: 60 });
		let key = "key:4";

		let headers = new Headers();
		await rateLimit.writeHttpMetadata({ key, resource: "test" }, headers);

		expect(headers.get("X-RateLimit-Limit")).toBe("1");
		expect(headers.get("X-RateLimit-Remaining")).toBe("1");
		expect(headers.get("X-RateLimit-Used")).toBe("0");
		expect(new Date(Number(headers.get("X-RateLimit-Reset")))).toBeValidDate();
		expect(headers.get("X-RateLimit-Resource")).toBe("test");
		expect(new Date(Date.parse(headers.get("Retry-After") ?? ""))).toBeValidDate();
	});

	test("#writeHttpMetadata returns new Headers object", async () => {
		let rateLimit = new WorkerKVRateLimit(kv, { limit: 1, period: 60 });
		let key = "key:5";

		let headers = await rateLimit.writeHttpMetadata({ key, resource: "test" });

		expect(headers.get("X-RateLimit-Limit")).toBe("1");
		expect(headers.get("X-RateLimit-Remaining")).toBe("1");
		expect(headers.get("X-RateLimit-Used")).toBe("0");
		expect(new Date(Number(headers.get("X-RateLimit-Reset")))).toBeValidDate();
		expect(headers.get("X-RateLimit-Resource")).toBe("test");
		expect(new Date(Date.parse(headers.get("Retry-After") ?? ""))).toBeValidDate();
	});
});
