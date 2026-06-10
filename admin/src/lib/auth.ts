import type { AxiosInstance } from "axios";

const TOKEN_KEY = "bayan-admin-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const isAuthed = () => Boolean(getToken());

/** Send the user to the login screen (full reload clears query state). */
export function redirectToLogin() {
  clearToken();
  if (!window.location.pathname.endsWith("/login")) {
    window.location.href = "/admin/login";
  }
}

/**
 * Attach auth to an axios instance: adds the Bearer token to every request
 * and bounces to /admin/login on a 401 (expired/invalid token).
 */
export function attachAuth(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.response?.status === 401) redirectToLogin();
      return Promise.reject(err);
    },
  );
}
