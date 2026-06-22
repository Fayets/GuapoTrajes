import { getApiBaseUrl } from "./api-config";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiFetchOptions = RequestInit & {
  token?: string | null;
  /** Evita redirigir a /login en 401 (p. ej. login o verify-token). */
  skipAuthRedirect?: boolean;
};

function buildUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = getApiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Fetch autenticado con redirección centralizada en 401. */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { token, skipAuthRedirect, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (rest.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(buildUrl(path), { ...rest, headers });

  if (
    res.status === 401 &&
    !skipAuthRedirect &&
    typeof window !== "undefined"
  ) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return res;
}

/** Parsea JSON y lanza ApiError si la respuesta no es ok. */
export async function apiJson<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.detail === "string"
          ? data.detail
          : `Error ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

/** POST JSON con cuerpo serializado. */
export async function apiPost<T>(
  path: string,
  body: unknown,
  options: Omit<ApiFetchOptions, "body" | "method"> = {}
): Promise<T> {
  return apiJson<T>(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** GET JSON. */
export async function apiGet<T>(
  path: string,
  options: Omit<ApiFetchOptions, "method"> = {}
): Promise<T> {
  return apiJson<T>(path, { ...options, method: "GET" });
}
