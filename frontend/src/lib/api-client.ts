const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; message?: string };
    return body.detail ?? body.message ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, await getErrorMessage(response));
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "The server took too long to respond.");
    }
    throw new ApiError(0, "Unable to reach the JalRakshak API.");
  } finally {
    window.clearTimeout(timeout);
  }
}
