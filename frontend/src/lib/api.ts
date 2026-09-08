import axios from "axios";

// Overridable per environment; must match the store row's slug in the DB.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG ?? "elbayan";

// Absolute API origin in production (e.g. https://bookstore-api.onrender.com).
// Empty in dev so requests stay relative and go through the Vite proxy.
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_URL}/api/v1/${STORE_SLUG}`,
});

/**
 * Refuse anything that is not JSON.
 *
 * A misconfigured host, a proxy error page, or a captive portal answers with
 * HTML and a 200. Axios hands that straight through as a string, the page then
 * calls an array method on it, and the whole shop white-screens. Failing the
 * request instead lets the normal loading and error states do their job.
 */
api.interceptors.response.use((response) => {
  const type = String(response.headers?.["content-type"] ?? "");
  if (response.data != null && !type.includes("json")) {
    return Promise.reject(
      new Error(`توقّعنا JSON من الخادم ووصلنا "${type || "نوع غير معروف"}"`),
    );
  }
  return response;
});

export default api;
