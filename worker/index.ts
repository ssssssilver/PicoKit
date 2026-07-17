/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { isModelProxyRequest, resolveModelProxyTarget } from "../lib/model-proxy";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;
    if (isModelProxyRequest(request.url)) {
      const target = resolveModelProxyTarget(request.url);
      if (!target) response = new Response("Model not found", { status: 404 });
      else if (request.method !== "GET" && request.method !== "HEAD") {
        response = new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      } else {
        const headers = new Headers();
        for (const name of ["range", "if-none-match", "if-modified-since"]) {
          const value = request.headers.get(name);
          if (value) headers.set(name, value);
        }
        response = await fetch(target, { method: request.method, headers, redirect: "follow" });
      }
    } else if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    } else response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    secured.headers.set("Permissions-Policy", "display-capture=(self), microphone=(self), camera=(), geolocation=(), payment=()");
    secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    if (isModelProxyRequest(request.url) && secured.status === 206) {
      secured.headers.set("Cache-Control", "no-store");
    }
    secured.headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob: data: https://huggingface.co");
    return secured;
  },
};

export default worker;
