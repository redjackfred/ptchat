export interface Session {
  id: string;
  name: string;
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number | null;
  status: "processing" | "ready" | "failed";
  source: "upload" | "folder";
  file_path: string | null;
  indexed_at: string | null;
  created_at: string;
}

export interface Provider {
  name: string;
  models: string[];
  supports_vision: boolean;
  has_key: boolean;
}

export interface AppSettings {
  theme: "system" | "dark" | "light";
  ollama_endpoint: string;
  watched_folders: string[];
}
