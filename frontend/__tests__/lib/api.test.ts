import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessions, createSession, getProviders } from "@/lib/api";

const BASE = "http://localhost:8000";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api.getSessions", () => {
  it("calls GET /sessions and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "abc", name: "Test", llm_provider: "openai", llm_model: "gpt-4o", created_at: "" }],
    });

    const result = await getSessions();

    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/sessions`);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test");
  });
});

describe("api.createSession", () => {
  it("calls POST /sessions with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "xyz", name: "New", llm_provider: "ollama", llm_model: "llama3", created_at: "" }),
    });

    const result = await createSession({ name: "New", llm_provider: "ollama", llm_model: "llama3" });

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/sessions`,
      expect.objectContaining({ method: "POST" })
    );
    expect(result.id).toBe("xyz");
  });
});

describe("api.getProviders", () => {
  it("calls GET /settings/providers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ name: "ollama", models: [], supports_vision: false, has_key: true }],
    });

    const result = await getProviders();
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/settings/providers`);
    expect(result[0].name).toBe("ollama");
  });
});
