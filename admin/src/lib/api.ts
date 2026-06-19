import axios from "axios";
import { attachAuth } from "./auth";

// Overridable per environment; must match the store row's slug in the DB.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG ?? "elbayan";

// Absolute API origin in production; empty in dev (Vite proxy handles it).
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_URL}/api/v1/${STORE_SLUG}`,
});

// The admin app calls guarded store-scoped routes (requests list/status), so
// it sends the admin token here too.
attachAuth(api);

export default api;
