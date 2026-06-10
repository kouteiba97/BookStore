import axios from "axios";

// Overridable per environment; must match the store row's slug in the DB.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG ?? "elbayan";

const api = axios.create({
  baseURL: `/api/v1/${STORE_SLUG}`,
});

export default api;
