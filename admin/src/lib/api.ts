import axios from "axios";

const STORE_SLUG = "test-store";

const api = axios.create({
  baseURL: `/api/v1/${STORE_SLUG}`,
});

export default api;
