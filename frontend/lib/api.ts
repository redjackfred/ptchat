import type { Session, Message, Document, Provider, AppSettings } from "./types";

const BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = init !== undefined ? await fetch(`${BASE}${path}`, init) : await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Sessions
export const getSessions = () => request<Session[]>("/sessions");

export const createSession = (body: Pick<Session, "name" | "llm_provider" | "llm_model">) =>
  request<Session>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const renameSession = (id: string, name: string) =>
  request<Session>(`/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteSession = (id: string) =>
  request<{ ok: boolean }>(`/sessions/${id}`, { method: "DELETE" });

export const getMessages = (sessionId: string) =>
  request<Message[]>(`/sessions/${sessionId}/messages`);

// Documents
export const getDocuments = () => request<Document[]>("/documents");

export const uploadDocument = async (file: File): Promise<Document> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

export const deleteDocument = (id: string) =>
  request<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" });

// Settings
export const getSettings = () => request<AppSettings>("/settings");

export const updateSettings = (patch: Partial<AppSettings>) =>
  request<AppSettings>("/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

export const getProviders = () => request<Provider[]>("/settings/providers");

export const setApiKey = (provider: string, key: string) =>
  request<{ ok: boolean }>(`/settings/api-keys/${provider}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

export const deleteApiKey = (provider: string) =>
  request<{ ok: boolean }>(`/settings/api-keys/${provider}`, { method: "DELETE" });
