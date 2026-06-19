import axios from "axios";

// Overridable per environment; must match the store row's slug in the DB.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG ?? "elbayan";

// Absolute API origin in production (e.g. https://bookstore-api.onrender.com).
// Empty in dev so requests stay relative and go through the Vite proxy.
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_URL}/api/v1/${STORE_SLUG}`,
});

export default api;
