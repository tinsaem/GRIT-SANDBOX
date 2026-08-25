import axios from "axios";
import { getKeycloak } from "./keycloak";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  // A live Keycloak token always wins over anything cached locally.
  const kc = getKeycloak();
  const token = kc?.authenticated ? kc.token : localStorage.getItem("givt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — clear token and redirect to auth (expired/invalid session).
// 403 means "logged in but not allowed to do this" — an ordinary authorization
// denial that each screen handles inline; it must NOT log the user out.
// Skip this for /auth/* requests themselves (login, signup, verify-otp, ...) —
// those routes return 401 for normal reasons (wrong password, unverified
// account) that their own screens already handle inline, not an expired session.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRequest = (err.config?.url || "").startsWith("/auth");
    if (!isAuthRequest && err.response?.status === 401) {
      localStorage.removeItem("givt_token");
      localStorage.removeItem("givt_user");
      window.location.href = "/auth";
    }
    return Promise.reject(err);
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  resendVerification: (email) => api.post("/auth/resend-verification", { email }),
  verifyOtp: (email, otp) => api.post("/auth/verify-otp", { email, otp }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, password) => api.post("/auth/reset-password", { token, password }),
  // Checks a reset token before the form renders, so dead links fail loudly.
  validateResetToken: (token) => api.get(`/auth/reset-password/${token}/validate`),
  googleUrl: (role) => `/api/auth/google?role=${encodeURIComponent(role)}`,
};

// ── Users ──────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: () => api.get("/users/profile"),
  updateProfile: (data) => api.put("/users/profile", data),
  getPublic: (id) => api.get(`/users/${id}/public`),
  listStudents: () => api.get("/users/students"),
  getResume: () => api.get("/users/resume"),
  saveResume: (content) => api.post("/users/resume", { content }),
  getJD: () => api.get("/users/jd"),
  saveJD: (content, target_company) => api.post("/users/jd", { content, target_company }),
  getResumeFor: (id) => api.get(`/users/${id}/resume`),
  getJDFor: (id) => api.get(`/users/${id}/jd`),
};

// ── Tokens ─────────────────────────────────────────────────────────────────────
export const tokensAPI = {
  getBalance: () => api.get("/tokens/balance"),
  getLedger: () => api.get("/tokens/ledger"),
  award: (student_id, amount) => api.post("/tokens/award", { student_id, amount }),
};

// ── Verifications ──────────────────────────────────────────────────────────────
export const verificationsAPI = {
  getForStudent: (studentId) => api.get(`/verifications/${studentId}`),
  getScore: (studentId) => api.get(`/verifications/${studentId}/score`),
  verify: (data) => api.post("/verifications", data),
};

// ── Companies ──────────────────────────────────────────────────────────────────
export const companiesAPI = {
  list: () => api.get("/companies"),
  get: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post("/companies", data),
  update: (id, data) => api.put(`/companies/${id}`, data),
};

// ── Syllabi ────────────────────────────────────────────────────────────────────
export const syllabiAPI = {
  list: () => api.get("/syllabi"),
  get: (id) => api.get(`/syllabi/${id}`),
  create: (data) => api.post("/syllabi", data),
  update: (id, data) => api.put(`/syllabi/${id}`, data),
  supervise: (id) => api.post(`/syllabi/${id}/supervise`),
};

// ── Leaderboard ────────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  get: () => api.get("/leaderboard"),
};

// ── Messages ───────────────────────────────────────────────────────────────────
export const messagesAPI = {
  send: (data) => api.post("/messages", data),
  inbox: () => api.get("/messages/inbox"),
  sent: () => api.get("/messages/sent"),
};

// ── Advising intake pathways ────────────────────────────────────────────────────
export const advisingAPI = {
  listIntakes: (studentId) =>
    api.get("/advising/intakes", studentId ? { params: { student_id: studentId } } : undefined),
  createIntake: (pathway, details, guidance) =>
    api.post("/advising/intakes", { pathway, details, guidance }),
};

// ── Peer review (student capability) ──────────────────────────────────
export const peerAPI = {
  quota: () => api.get("/verifications/peer/quota"),
  candidates: (search = "", take = 20) =>
    api.get("/verifications/peer/candidates", { params: { search, take } }),
  submit: (student_id, skill_name, confidence, comment) =>
    api.post("/verifications", { student_id, skill_name, confidence, comment }),
};

// ── Admin / User management ────────────────────────────────────────────────────
// Every endpoint here is Admin-only server-side (see server/routes/admin.js).
export const adminAPI = {
  stats: (days = 30) => api.get(`/admin/stats?days=${days}`),
  listUsers: (params = {}) => api.get("/admin/users", { params }),
  createUser: (data) => api.post("/admin/users", data),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  setStatus: (id, isActive, reason) => api.patch(`/admin/users/${id}/status`, { isActive, reason }),
  resetPassword: (id, password) => api.post(`/admin/users/${id}/reset-password`, { password }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  verifyUser: (id) => api.post(`/admin/users/${id}/verify`),
  bulk: (ids, action, reason) => api.post("/admin/users/bulk", { ids, action, reason }),
  audit: (params = {}) => api.get("/admin/audit", { params }),
  settings: () => api.get("/admin/settings"),
  updateSetting: (key, value) => api.patch(`/admin/settings/${key}`, { value }),
  peerReviewOverview: () => api.get("/admin/peer-review-overview"),
  exportUsers: (params = {}) => api.get("/admin/export", { params }),
  resendVerification: (id) => api.post(`/admin/users/${id}/resend-verification`),
};

// ── GAN ────────────────────────────────────────────────────────────────────────
export const ganAPI = {
  list: () => api.get("/gan"),
  latest: () => api.get("/gan/latest"),
  save: (data) => api.post("/gan", data),
};

export default api;
