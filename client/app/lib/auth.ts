export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
};

const USER_KEY = "auth_user";
const EVENT = "auth:changed";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "number" && typeof parsed.email === "string") {
      return parsed as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function onAuthChanged(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
