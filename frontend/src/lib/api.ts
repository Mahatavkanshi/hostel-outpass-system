export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5002";
export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5002/ws";

export function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(
      data.message || data.error || `Request failed (${res.status})`,
    );
  }
  return data;
}

export async function apiBlob(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) throw new Error("File request failed");
  return res.blob();
}

export function descriptor(seed: number) {
  return Array.from({ length: 128 }, (_, i) => {
    const value = Math.sin(seed + i * 0.13) * 0.5 + 0.5;
    return Number(value.toFixed(6));
  });
}

export async function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });
  });
}

export function saveSession(token: string, user: unknown) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.clear();
}

export function loadSession<T>() {
  const token = localStorage.getItem("token") || "";
  const savedUser = localStorage.getItem("user");
  return {
    token,
    user: savedUser ? (JSON.parse(savedUser) as T) : null,
  };
}
