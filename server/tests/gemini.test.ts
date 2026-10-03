import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";

// gemini.service reads the key at module import time; ensure one is present
// so callGemini reaches the fetch we stub below.
beforeAll(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key-for-unit-tests";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("gemini.service error handling", () => {
  it("fails fast on 429 without retrying (callers fall back to mock immediately)", async () => {
    const fetchMock = vi.fn(async () => new Response("quota exceeded", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const { generateText } = await import("../src/services/gemini.service.js");
    await expect(generateText("hi")).rejects.toThrow("Gemini API error: 429");

    // Exactly one HTTP call: no backoff sleeps against a quota that resets daily.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still retries transient 500 errors with backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      const call = fetchMock.mock.calls.length;
      if (call < 3) return new Response("server error", { status: 500 });
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "recovered" }] } }] }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { generateText } = await import("../src/services/gemini.service.js");
    const promise = generateText("hi");

    await vi.advanceTimersByTimeAsync(0);    // attempt 1 -> 500, schedule 3s backoff
    await vi.advanceTimersByTimeAsync(3000); // attempt 2 -> 500, schedule 6s backoff
    await vi.advanceTimersByTimeAsync(6000); // attempt 3 -> 200

    await expect(promise).resolves.toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient HTTP errors (400)", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const { generateText } = await import("../src/services/gemini.service.js");
    await expect(generateText("hi")).rejects.toThrow("Gemini API error: 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
