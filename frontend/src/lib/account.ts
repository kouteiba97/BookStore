import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import type { PublicOrder } from "./types";

/**
 * Optional customer accounts. The login token is kept in this browser
 * (localStorage) and sent only to the account and order routes — never to
 * the catalogue — so a logged-in visitor browses exactly like a guest.
 */

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  wilaya: string | null;
  address: string | null;
  createdAt: string;
}

export interface Session {
  token: string;
  customer: Customer;
}

const KEY = "bayan-account-v1";
const listeners = new Set<() => void>();

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the login lasts for this page only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Attach the token to account and order calls only.
const AUTHED = /^\/(account|orders)(\/|\?|$)/;
const PUBLIC_ACCOUNT = /^\/account\/(login|register|password\/reset)/;
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.url && AUTHED.test(config.url) && !PUBLIC_ACCOUNT.test(config.url)) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});
// A refused token (expired, password changed elsewhere) ends the session.
api.interceptors.response.use(undefined, (err) => {
  const url: string = err?.config?.url ?? "";
  if (err?.response?.status === 401 && url.startsWith("/account/") && !PUBLIC_ACCOUNT.test(url)) setToken(null);
  return Promise.reject(err);
});

// ── API ─────────────────────────────────────────────────

export const register = (data: {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  email?: string;
}) => api.post<Session>("/account/register", data).then((r) => r.data);

export const login = (phone: string, password: string) =>
  api.post<Session>("/account/login", { phone, password }).then((r) => r.data);

export const resetPassword = (token: string, password: string) =>
  api.post<Session>("/account/password/reset", { token, password }).then((r) => r.data);

export const fetchMe = () => api.get<Customer>("/account/me").then((r) => r.data);

export const updateMe = (data: Partial<Pick<Customer, "firstName" | "lastName" | "email" | "wilaya" | "address">>) =>
  api.patch<Customer>("/account/me", data).then((r) => r.data);

export const changePassword = (current: string, next: string) =>
  api.post<Session>("/account/password", { current, next }).then((r) => r.data);

export const fetchMyOrders = () =>
  api.get<{ orders: PublicOrder[] }>("/account/orders").then((r) => r.data.orders);

// ── Hook ────────────────────────────────────────────────

export const ME_KEY = ["account", "me"] as const;

export function useAccount() {
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: [...ME_KEY, token],
    queryFn: fetchMe,
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return {
    loggedIn: !!token,
    customer: token ? me.data ?? null : null,
    loading: !!token && me.isLoading,
    /** Store a fresh session (login, register, reset, password change). */
    start(session: Session) {
      qc.setQueryData([...ME_KEY, session.token], session.customer);
      setToken(session.token);
    },
    logout() {
      setToken(null);
      qc.removeQueries({ queryKey: ["account"] });
    },
  };
}
