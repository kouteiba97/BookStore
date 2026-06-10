import axios from "axios";
import { attachAuth } from "./auth";

// Overridable per environment; must match the store row's slug in the DB.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG ?? "elbayan";

const api = axios.create({
  baseURL: `/api/v1/${STORE_SLUG}`,
});

// The admin app calls guarded store-scoped routes (requests list/status), so
// it sends the admin token here too.
attachAuth(api);

export default api;
