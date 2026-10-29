export function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? "";
}

export class AuthRequired extends Error {
  constructor() {
    super("Sign in with your mobavenue.com Google account.");
    this.name = "AuthRequired";
  }
}

async function read<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 401) throw new AuthRequired();
  if (!response.ok) {
    const detail = data && typeof data === "object" ? (data as { detail?: unknown }).detail : null;
    let message = response.statusText || "Request failed";
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) {
      message = detail.map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : JSON.stringify(item))).join(" ");
    }
    throw new Error(message);
  }
  return data as T;
}

export function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  return fetch(`${apiBase()}${path}`, { credentials: "include", signal }).then((response) => read<T>(response));
}

export function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  }).then((response) => read<T>(response));
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
