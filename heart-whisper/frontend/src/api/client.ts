const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }

  return data as T;
}

interface SSEOptions {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

async function connectSSE(
  url: string,
  body: unknown,
  { onToken, onDone, onError }: SSEOptions
): Promise<void> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    onError(data.detail || "Request failed");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr);

          if (event.type === "token") {
            onToken(event.content);
          } else if (event.type === "done") {
            onDone();
            return;
          } else if (event.type === "error") {
            onError(event.message || "Unknown error");
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch (err) {
    onError("Connection lost");
  }
}

export { apiFetch, connectSSE };
