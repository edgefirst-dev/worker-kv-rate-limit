# @edgefirst-dev/worker-kv-rate-limit

A Rate Limit based on Cloudflare's Worker KV.

This class is based on Cloudflare's own [Rate Limit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) feature currently in beta and only available to Cloudflare Workers.

This package can be used on your Cloudflare Pages application too as it uses Worker KV to keep the rate limit state.

## Installation

Install from npm or GitHub Package Registry with;

```bash
bun add @edgefirst-dev/worker-kv-rate-limit
```

## Usage

```ts
import { WorkerKVRateLimit } from "@edgefirst-dev/worker-kv-rate-limit";

export default {
  async fetch(request, env): Promise<Response> {
    let { pathname } = new URL(request.url);

    let rateLimit = WorkerKVRateLimit(env.KV);

    // key can be any string of your choosing
    let { success } = await rateLimit.limit({ key: pathname });

    if (!success) {
      return new Response(`429 Failure – rate limit exceeded for ${pathname}`, {
        status: 429,
        headers: await rateLimit.writeHttpMetadata({
          key: pathname,
          resource: "resource identifier", // Optional
        }),
      });
    }

    return new Response(`Success!`, {
      status: 200,
      headers: await rateLimit.writeHttpMetadata({
        key: pathname,
        resource: "resource identifier", // Optional
      }),
    });
  },
} satisfies ExportedHandler<Env>;
```

The `limit` function works exactly like Cloudflare's own Rate Limit feature. It returns an object with a `success` property that is `true` if the rate limit has not been exceeded and `false` if it has.

The `writeHttpMetadata` function returns an object with the necessary headers to be set on the response to the client. This is necessary to inform the client of the rate limit status.

If you want to apply extra headers, you can either keep the result Headers object and append headers there.

```ts
let headers = await rateLimit.writeHttpMetadata({
  key: pathname,
  resource: "resource identifier", // Optional
});
headers.set("X-Extra-Header", "Extra Value");
```

Or you can pass a Headers object to the `writeHttpMetadata` function and it will append the necessary headers to it.

```ts
let headers = new Headers();
headers.set("X-Extra-Header", "Extra Value");

await rateLimit.writeHttpMetadata(
  {
    key: pathname,
    resource: "resource identifier", // Optional
  },
  headers
);
```

The `writeHttpMetadata` will set the following headers:

- `X-RateLimit-Limit`: The maximum number of requests allowed in the current window.
- `X-RateLimit-Remaining`: The number of requests remaining in the current window.
- `X-RateLimit-Used`: The number of requests used in the current window.
- `X-RateLimit-Reset`: The time in seconds when the rate limit window resets.
- `X-RateLimit-Resource`: The resource being rate limited (if provided).
- `Retry-After`: The time in seconds when the rate limit window resets.

The `X-RateLimit-Reset` and `Retry-After` headers are the same and represent the time in seconds when the rate limit window resets, the reason to duplicate them is to keep compatibility with the `Retry-After` header that is used by the HTTP standard and consistency with common `X-RateLimit-` headers.

## License

See [LICENSE](./LICENSE)

## Author

- [Sergio Xalambrí](https://sergiodxa.com)
