import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { adminAPI } from "../api";
import { DonutChart, BarChart, AreaChart, HBarChart, Sparkline, ROLE_COLORS } from "../components/Charts";
import { exportCSV, exportExcel, exportPDF, USER_EXPORT_COLUMNS } from "../components/exportUtils";

/* =============================================================================
   AdminDashboard — user management + analytics for the Admin role.
   Route: /admin  (gated by <ProtectedRoute roles={["Admin"]}> in App.jsx)
   Backed by /api/admin/* which is itself Admin-gated server-side.
   ========================================================================== */

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A", muted: "#6B7280",
  paper: "#F7F3EC", paperWarm: "#EFE7D6", card: "#FFFFFF",
  rule: "#D8CFBE", ruleSoft: "#E8E1D4",
  gold: "#B8862F", goldDeep: "#8C6420", goldSoft: "#F3E8CC",
  teal: "#2D6E6A", tealDeep: "#1F4A47",
  rust: "#A04A1E", green: "#1F7A3A", greenSoft: "#D4EAD8",
  red: "#B42318", redSoft: "#FDE7E4", violet: "#6D28D9",
};

// Peer is a Student capability, not a role — see server/routes/verifications.js
const ROLES = ["Student", "Professor", "Advisor", "Employer", "Admin"];
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "User Management" },
  { id: "analytics", label: "Analytics" },
  { id: "audit", label: "Audit Log" },
  { id: "settings", label: "Settings" },
];

/* ------------------------------------------------------------------ atoms */
const font = { fontFamily: "'DM Sans', system-ui, sans-serif" };

function Card({ children, style, pad = 20 }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.ruleSoft}`, borderRadius: 12,
      padding: pad, boxShadow: "0 1px 3px rgba(14,17,22,.05)", ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled, style, title, type = "button" }) {
  const variants = {
    primary: { background: C.gold, color: "#fff", border: `1px solid ${C.goldDeep}` },
    ghost: { background: "transparent", color: C.inkSoft, border: `1px solid ${C.rule}` },
    danger: { background: C.red, color: "#fff", border: `1px solid #8f1c13` },
    dangerGhost: { background: "transparent", color: C.red, border: `1px solid ${C.red}` },
    teal: { background: C.teal, color: "#fff", border: `1px solid ${C.tealDeep}` },
    subtle: { background: C.paperWarm, color: C.inkSoft, border: `1px solid ${C.rule}` },
  };
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12 },
    md: { padding: "8px 15px", fontSize: 13 },
    lg: { padding: "11px 22px", fontSize: 14 },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{
        ...font, ...variants[variant], ...sizes[size],
        borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600, opacity: disabled ? 0.5 : 1,
        transition: "filter .15s, opacity .15s", whiteSpace: "nowrap", ...style,
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.filter = "brightness(1.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >{children}</button>
  );
}

function Field({ label, children, hint, required }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ ...font, display: "block", fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 5 }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ ...font, display: "block", fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  ...font, width: "100%", padding: "9px 11px", fontSize: 13.5,
  border: `1px solid ${C.rule}`, borderRadius: 8, background: "#fff",
  color: C.ink, outline: "none",
};

function Badge({ children, color, soft }) {
  return (
    <span style={{
      ...font, display: "inline-block", padding: "2.5px 9px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, color, background: soft,
      border: `1px solid ${color}22`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || C.muted;
  return <Badge color={color} soft={`${color}18`}>{role}</Badge>;
}

function StatusBadge({ active }) {
  return active
    ? <Badge color={C.green} soft={C.greenSoft}>Active</Badge>
    : <Badge color={C.red} soft={C.redSoft}>Deactivated</Badge>;
}

function StatCard({ label, value, sub, accent = C.teal, spark, icon }) {
  return (
    <Card pad={16} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ ...font, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 15, opacity: .75 }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...font, fontSize: 27, fontWeight: 700, color: C.ink, lineHeight: 1.05 }}>{value}</span>
        {spark && <Sparkline data={spark} color={accent} width={72} height={24} />}
      </div>
      {sub && <span style={{ ...font, fontSize: 11.5, color: C.muted }}>{sub}</span>}
      <div style={{ height: 3, background: accent, borderRadius: 2, marginTop: 2, opacity: .85 }} />
    </Card>
  );
}

/* ----------------------------------------------------------------- Modal */
function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(14,17,22,.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      backdropFilter: "blur(2px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, borderRadius: 14, width: "100%", maxWidth: width,
        maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.28)",
      }}>
        <div style={{
          padding: "16px 22px", borderBottom: `1px solid ${C.ruleSoft}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: C.card, borderRadius: "14px 14px 0 0",
        }}>
          <h3 style={{ ...font, margin: 0, fontSize: 16.5, fontWeight: 700, color: C.ink }}>{title}</h3>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", fontSize: 21, cursor: "pointer",
            color: C.muted, lineHeight: 1, padding: 0, width: 26, height: 26,
          }}>×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg, kind, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  const isErr = kind === "error";
  return (
    <div style={{
      ...font, position: "fixed", bottom: 24, right: 24, zIndex: 2000,
      background: isErr ? C.red : C.tealDeep, color: "#fff",
      padding: "12px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 500,
      maxWidth: 400, boxShadow: "0 8px 26px rgba(0,0,0,.24)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 15 }}>{isErr ? "⚠" : "✓"}</span>
      <span>{msg}</span>
    </div>
  );
}

/* ============================================================ MAIN ===== */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [statsDays, setStatsDays] = useState(30);
  const [loadingStats, setLoadingStats] = useState(true);

  const [users, setUsers] = useState([]);
  const [userMeta, setUserMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [filters, setFilters] = useState({
    search: "", role: "", status: "", verified: "",
    sortBy: "createdAt", sortDir: "desc", page: 1, pageSize: 25,
  });
  const [selected, setSelected] = useState(new Set());

  const [settings, setSettings] = useState([]);
  const [peerOverview, setPeerOverview] = useState(null);
  const [audit, setAudit] = useState([]);
  const [auditMeta, setAuditMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  const [toast, setToast] = useState({ msg: "", kind: "ok" });
  const [modal, setModal] = useState({ type: null, payload: null });
  const [busy, setBusy] = useState(false);

  const notify = (msg, kind = "ok") => setToast({ msg, kind });
  const errMsg = (e, fallback) => e?.response?.data?.error || fallback;

  /* ------------------------------------------------------------- loaders */
  const loadStats = useCallback(async (days = statsDays) => {
    setLoadingStats(true);
    try {
      const res = await adminAPI.stats(days);
      setStats(res.data);
    } catch (e) {
      notify(errMsg(e, "Could not load statistics"), "error");
    } finally {
      setLoadingStats(false);
    }
  }, [statsDays]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await adminAPI.listUsers(filters);
      setUsers(res.data.users);
      setUserMeta({ total: res.data.total, page: res.data.page, totalPages: res.data.totalPages });
    } catch (e) {
      notify(errMsg(e, "Could not load users"), "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [filters]);

  const loadSettings = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([adminAPI.settings(), adminAPI.peerReviewOverview()]);
      setSettings(s.data.settings || []);
      setPeerOverview(p.data);
    } catch (e) {
      notify(errMsg(e, "Could not load settings"), "error");
    }
  }, []);

  const loadAudit = useCallback(async (page = 1) => {
    try {
      const res = await adminAPI.audit({ page, pageSize: 50 });
      setAudit(res.data.logs);
      setAuditMeta({ total: res.data.total, page: res.data.page, totalPages: res.data.totalPages });
    } catch (e) {
      notify(errMsg(e, "Could not load audit log"), "error");
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "users") loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "audit") loadAudit(); }, [tab, loadAudit]);
  useEffect(() => { if (tab === "settings") loadSettings(); }, [tab, loadSettings]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput, page: 1 })), 380);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ------------------------------------------------------------- actions */
  const refreshAll = () => { loadStats(); if (tab === "users") loadUsers(); if (tab === "audit") loadAudit(); };

  async function handleCreate(form) {
    setBusy(true);
    try {
      await adminAPI.createUser(form);
      notify(`${form.role} account created for ${form.email}`);
      setModal({ type: null });
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Could not create user"), "error");
    } finally { setBusy(false); }
  }

  async function handleEdit(id, form) {
    setBusy(true);
    try {
      await adminAPI.updateUser(id, form);
      notify("User updated");
      setModal({ type: null });
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Could not update user"), "error");
    } finally { setBusy(false); }
  }

  async function handleStatus(u, makeActive, reason) {
    setBusy(true);
    try {
      await adminAPI.setStatus(u.id, makeActive, reason);
      notify(`${u.name} ${makeActive ? "activated" : "deactivated"}`);
      setModal({ type: null });
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Could not change status"), "error");
    } finally { setBusy(false); }
  }

  async function handleDelete(u) {
    setBusy(true);
    try {
      await adminAPI.deleteUser(u.id);
      notify(`${u.name} permanently deleted`);
      setModal({ type: null });
      setSelected((s) => { const n = new Set(s); n.delete(u.id); return n; });
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Could not delete user"), "error");
    } finally { setBusy(false); }
  }

  async function handleVerify(u) {
    setBusy(true);
    try {
      await adminAPI.verifyUser(u.id);
      notify(`${u.name} manually verified`);
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Could not verify user"), "error");
    } finally { setBusy(false); }
  }

  async function handleResetPw(u, password) {
    setBusy(true);
    try {
      await adminAPI.resetPassword(u.id, password);
      notify(`Password reset for ${u.name}`);
      setModal({ type: null });
    } catch (e) {
      notify(errMsg(e, "Could not reset password"), "error");
    } finally { setBusy(false); }
  }

  async function handleBulk(action, reason) {
    setBusy(true);
    try {
      const res = await adminAPI.bulk([...selected], action, reason);
      const { succeeded, skipped } = res.data;
      notify(
        `${succeeded} user${succeeded === 1 ? "" : "s"} ${action}d` +
        (skipped?.length ? ` · ${skipped.length} skipped` : ""),
        skipped?.length ? "error" : "ok"
      );
      setSelected(new Set());
      setModal({ type: null });
      refreshAll();
    } catch (e) {
      notify(errMsg(e, "Bulk action failed"), "error");
    } finally { setBusy(false); }
  }

  async function saveSetting(key, value) {
    setBusy(true);
    try {
      await adminAPI.updateSetting(key, value);
      notify("Setting saved \u2014 it takes effect immediately");
      loadSettings();
    } catch (e) {
      notify(errMsg(e, "Could not save setting"), "error");
    } finally { setBusy(false); }
  }

  async function handleResendVerification(u) {
    setBusy(true);
    try {
      await adminAPI.resendVerification(u.id);
      notify(`Verification email resent to ${u.email}`);
    } catch (e) {
      notify(errMsg(e, "Could not resend verification email"), "error");
    } finally { setBusy(false); }
  }

  async function doExport(kind) {
    try {
      const res = await adminAPI.exportUsers({ role: filters.role, status: filters.status });
      const rows = res.data.users;
      if (!rows.length) return notify("No users match the current filter", "error");

      const meta = {
        "Generated": new Date().toLocaleString(),
        "Generated by": `${user.name} (${user.role})`,
        "Total records": rows.length,
        "Role filter": filters.role || "All roles",
        "Status filter": filters.status || "All statuses",
      };

      if (kind === "csv") exportCSV(rows, USER_EXPORT_COLUMNS, "givt-users");
      if (kind === "excel") exportExcel(rows, USER_EXPORT_COLUMNS, "givt-users", meta);
      if (kind === "pdf") exportPDF(rows, USER_EXPORT_COLUMNS, "givt-users", meta);
      notify(`Exported ${rows.length} records as ${kind.toUpperCase()}`);
    } catch (e) {
      notify(errMsg(e, "Export failed"), "error");
    }
  }

  /* ------------------------------------------------------------- derived */
  const roleChartData = useMemo(
    () => (stats?.byRole || []).map((r) => ({ label: r.role, value: r.count, color: ROLE_COLORS[r.role] })),
    [stats]
  );
  const nonZeroRoles = useMemo(() => roleChartData.filter((r) => r.value > 0), [roleChartData]);

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  const toggleOne = (id) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const t = stats?.totals || {};

  /* =========================================================== render == */
  return (
    <div style={{ ...font, minHeight: "100vh", background: C.paper, color: C.ink }}>
      {/* ---------------------------------------------------------- header */}
      <header style={{
        background: C.card, borderBottom: `1px solid ${C.rule}`,
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1400, margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-between", height: 62, gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: C.violet,
              display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15,
              flexShrink: 0,
            }}>A</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -.2 }}>GIVT Administration</div>
              <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name} · System Administrator
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <Btn variant="ghost" size="sm" onClick={refreshAll}>↻ Refresh</Btn>
            <Btn variant="subtle" size="sm" onClick={() => navigate("/dashboard")}>Main dashboard</Btn>
            <Btn variant="ghost" size="sm" onClick={() => { logout(); navigate("/"); }}>Sign out</Btn>
          </div>
        </div>

        {/* tabs */}
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto" }}>
          {TABS.map((x) => {
            const on = tab === x.id;
            return (
              <button key={x.id} onClick={() => setTab(x.id)} style={{
                ...font, background: "transparent", border: "none", cursor: "pointer",
                padding: "10px 15px 12px", fontSize: 13.5,
                fontWeight: on ? 700 : 500, color: on ? C.gold : C.muted,
                borderBottom: `2.5px solid ${on ? C.gold : "transparent"}`,
                marginBottom: -1, whiteSpace: "nowrap",
              }}>{x.label}</button>
            );
          })}
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "22px 24px 60px" }}>

        {/* ==================================================== OVERVIEW == */}
        {tab === "overview" && (
          loadingStats && !stats ? <Loading /> : stats && (
            <>
              <SectionHead
                title="Platform overview"
                sub={`Snapshot across the last ${stats.periodDays} days`}
                right={
                  <select value={statsDays} onChange={(e) => { const d = +e.target.value; setStatsDays(d); loadStats(d); }}
                    style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 12.5 }}>
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={365}>Last year</option>
                  </select>
                }
              />

              <div style={{
                display: "grid", gap: 13, marginBottom: 22,
                gridTemplateColumns: "repeat(auto-fit, minmax(178px, 1fr))",
              }}>
                <StatCard label="Total users" value={t.totalUsers} icon="👥"
                  sub={`${t.newInPeriod} new in period`} accent={C.teal} spark={stats.growth} />
                <StatCard label="Active" value={t.activeUsers} icon="✓"
                  sub={`${((t.activeUsers / (t.totalUsers || 1)) * 100).toFixed(0)}% of all accounts`} accent={C.green} />
                <StatCard label="Deactivated" value={t.inactiveUsers} icon="⊘"
                  sub={t.inactiveUsers ? "Blocked from signing in" : "None"} accent={C.red} />
                <StatCard label="Unverified email" value={t.unverifiedUsers} icon="✉"
                  sub="Cannot log in until verified" accent={C.rust} />
                <StatCard label="Active last 7d" value={t.activeLast7Days} icon="⚡"
                  sub="Signed in recently" accent={C.violet} />
                <StatCard label="Tokens in circulation" value={(t.totalTokens || 0).toLocaleString()} icon="◈"
                  sub="Sum of all wallets" accent={C.gold} />
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", marginBottom: 20 }}>
                <Card>
                  <CardTitle>Users by role</CardTitle>
                  {nonZeroRoles.length
                    ? <DonutChart data={nonZeroRoles} title="Users" />
                    : <Empty>No users yet</Empty>}
                </Card>
                <Card>
                  <CardTitle>Registrations over time</CardTitle>
                  {stats.growth?.length
                    ? <AreaChart data={stats.growth} label="signups" color={C.teal} valueKey="count" />
                    : <Empty>No data</Empty>}
                </Card>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
                <Card>
                  <CardTitle>Role distribution</CardTitle>
                  <BarChart data={roleChartData} height={230} />
                </Card>
                <Card>
                  <CardTitle>Recent registrations</CardTitle>
                  {stats.recentUsers?.length ? (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {stats.recentUsers.map((u, i) => (
                        <div key={u.id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
                          borderTop: i ? `1px solid ${C.ruleSoft}` : "none",
                        }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: `${ROLE_COLORS[u.role]}1a`, color: ROLE_COLORS[u.role],
                            display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700,
                          }}>{u.name?.[0]?.toUpperCase() || "?"}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                            <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                          </div>
                          <RoleBadge role={u.role} />
                          <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <Empty>No registrations yet</Empty>}
                </Card>
              </div>
            </>
          )
        )}

        {/* =============================================== USER MANAGEMENT */}
        {tab === "users" && (
          <>
            <SectionHead
              title="User management"
              sub={`${userMeta.total} account${userMeta.total === 1 ? "" : "s"} matching current filters`}
              right={<Btn size="md" onClick={() => setModal({ type: "create" })}>+ Register user</Btn>}
            />

            {/* filter bar */}
            <Card pad={14} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>Search</span>
                  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Name or email…" style={inputStyle} />
                </div>
                <SelectFilter label="Role" value={filters.role}
                  onChange={(v) => setFilters((f) => ({ ...f, role: v, page: 1 }))}
                  options={[["", "All roles"], ...ROLES.map((r) => [r, r])]} />
                <SelectFilter label="Status" value={filters.status}
                  onChange={(v) => setFilters((f) => ({ ...f, status: v, page: 1 }))}
                  options={[["", "All"], ["active", "Active"], ["inactive", "Deactivated"]]} />
                <SelectFilter label="Verified" value={filters.verified}
                  onChange={(v) => setFilters((f) => ({ ...f, verified: v, page: 1 }))}
                  options={[["", "All"], ["yes", "Verified"], ["no", "Unverified"]]} />
                <SelectFilter label="Per page" value={filters.pageSize}
                  onChange={(v) => setFilters((f) => ({ ...f, pageSize: +v, page: 1 }))}
                  options={[[10, "10"], [25, "25"], [50, "50"], [100, "100"]]} />

                <div style={{ display: "flex", gap: 7, marginLeft: "auto" }}>
                  <Btn variant="ghost" size="sm" onClick={() => doExport("csv")} title="Comma-separated values">↓ CSV</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => doExport("excel")} title="Opens in Excel">↓ Excel</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => doExport("pdf")} title="Print / Save as PDF">↓ PDF</Btn>
                </div>
              </div>

              {(filters.search || filters.role || filters.status || filters.verified) && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: C.muted }}>Filters active</span>
                  <Btn variant="subtle" size="sm" onClick={() => {
                    setSearchInput("");
                    setFilters((f) => ({ ...f, search: "", role: "", status: "", verified: "", page: 1 }));
                  }}>Clear all</Btn>
                </div>
              )}
            </Card>

            {/* bulk bar */}
            {selected.size > 0 && (
              <Card pad={12} style={{ marginBottom: 12, background: C.goldSoft, borderColor: C.gold }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{selected.size} selected</strong>
                  <Btn variant="teal" size="sm" onClick={() => handleBulk("activate")} disabled={busy}>Activate</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setModal({ type: "bulkDeactivate" })} disabled={busy}>Deactivate</Btn>
                  <Btn variant="dangerGhost" size="sm" onClick={() => setModal({ type: "bulkDelete" })} disabled={busy}>Delete</Btn>
                  <Btn variant="subtle" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Btn>
                </div>
              </Card>
            )}

            {/* table */}
            <Card pad={0} style={{ overflow: "hidden" }}>
              {loadingUsers ? <Loading /> : users.length === 0 ? (
                <Empty style={{ padding: 50 }}>No users match these filters</Empty>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.paperWarm }}>
                        <Th style={{ width: 38 }}>
                          <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                        </Th>
                        <SortTh label="User" col="name" filters={filters} setFilters={setFilters} />
                        <SortTh label="Role" col="role" filters={filters} setFilters={setFilters} />
                        <Th>Status</Th>
                        <Th>Verified</Th>
                        <Th style={{ textAlign: "right" }}>Tokens</Th>
                        <SortTh label="Last login" col="lastLoginAt" filters={filters} setFilters={setFilters} />
                        <SortTh label="Registered" col="createdAt" filters={filters} setFilters={setFilters} />
                        <Th style={{ textAlign: "right" }}>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u.id === user.id;
                        return (
                          <tr key={u.id} style={{
                            borderTop: `1px solid ${C.ruleSoft}`,
                            background: selected.has(u.id) ? C.goldSoft + "80" : u.isActive ? "transparent" : "#FEFAF9",
                          }}>
                            <Td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} style={{ cursor: "pointer" }} /></Td>
                            <Td>
                              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                <div style={{
                                  width: 29, height: 29, borderRadius: 8, flexShrink: 0,
                                  background: `${ROLE_COLORS[u.role]}1a`, color: ROLE_COLORS[u.role],
                                  display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
                                }}>{u.name?.[0]?.toUpperCase() || "?"}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                    {u.name}
                                    {isSelf && <span style={{ fontSize: 10, color: C.violet, fontWeight: 700 }}>(you)</span>}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: C.muted }}>{u.email || "—"}</div>
                                </div>
                              </div>
                            </Td>
                            <Td><RoleBadge role={u.role} /></Td>
                            <Td><StatusBadge active={u.isActive} /></Td>
                            <Td>{u.emailVerified
                              ? <span style={{ color: C.green, fontWeight: 600 }}>✓</span>
                              : <span style={{ color: C.rust, fontWeight: 600 }}>✗</span>}</Td>
                            <Td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {(u.wallet?.balance ?? 0).toLocaleString()}
                            </Td>
                            <Td style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                            </Td>
                            <Td style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
                              {new Date(u.createdAt).toLocaleDateString()}
                            </Td>
                            <Td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                <IconBtn title="Edit" onClick={() => setModal({ type: "edit", payload: u })}>✎</IconBtn>
                                {!u.emailVerified && (
                                  <IconBtn title="Manually verify email" color={C.teal}
                                    onClick={() => handleVerify(u)}>✉✓</IconBtn>
                                )}
                                <IconBtn title="Reset password" onClick={() => setModal({ type: "resetPw", payload: u })}>🔑</IconBtn>
                                {!u.emailVerified && (
                                  <IconBtn title="Resend verification email" color={C.teal}
                                    onClick={() => handleResendVerification(u)}>✉</IconBtn>
                                )}
                                {u.isActive ? (
                                  <IconBtn title={isSelf ? "You cannot deactivate yourself" : "Deactivate"}
                                    disabled={isSelf} color={C.rust}
                                    onClick={() => setModal({ type: "deactivate", payload: u })}>⊘</IconBtn>
                                ) : (
                                  <IconBtn title="Activate" color={C.green}
                                    onClick={() => handleStatus(u, true)}>✓</IconBtn>
                                )}
                                <IconBtn title={isSelf ? "You cannot delete yourself" : "Delete permanently"}
                                  disabled={isSelf} color={C.red}
                                  onClick={() => setModal({ type: "delete", payload: u })}>🗑</IconBtn>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {userMeta.totalPages > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderTop: `1px solid ${C.ruleSoft}`, background: C.paper,
                }}>
                  <span style={{ fontSize: 12.5, color: C.muted }}>
                    Page {userMeta.page} of {userMeta.totalPages} · {userMeta.total} total
                  </span>
                  <div style={{ display: "flex", gap: 7 }}>
                    <Btn variant="ghost" size="sm" disabled={filters.page <= 1}
                      onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>← Prev</Btn>
                    <Btn variant="ghost" size="sm" disabled={filters.page >= userMeta.totalPages}
                      onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next →</Btn>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ==================================================== ANALYTICS = */}
        {tab === "analytics" && (
          loadingStats && !stats ? <Loading /> : stats && (
            <>
              <SectionHead title="Analytics & reports" sub="Composition, growth and platform activity" />

              <div style={{ display: "grid", gap: 13, marginBottom: 20, gridTemplateColumns: "repeat(auto-fit, minmax(178px, 1fr))" }}>
                <StatCard label="Skill verifications" value={t.verificationCount} accent={C.teal} icon="✓" />
                <StatCard label="Syllabi" value={t.syllabusCount} accent={C.gold} icon="▤" />
                <StatCard label="Companies" value={t.companyCount} accent={C.rust} icon="⌂" />
                <StatCard label="Messages" value={t.messageCount} accent={C.violet} icon="✉" />
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", marginBottom: 20 }}>
                <Card>
                  <CardTitle>Cumulative user growth</CardTitle>
                  <AreaChart data={stats.cumulative} label="total users" color={C.violet} valueKey="total" />
                </Card>
                <Card>
                  <CardTitle>Daily new registrations</CardTitle>
                  <AreaChart data={stats.growth} label="signups" color={C.gold} valueKey="count" />
                </Card>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
                <Card>
                  <CardTitle>Role composition</CardTitle>
                  <HBarChart data={roleChartData} />
                </Card>
                <Card>
                  <CardTitle>Account health</CardTitle>
                  <HBarChart data={[
                    { label: "Active", value: t.activeUsers, color: C.green },
                    { label: "Deactivated", value: t.inactiveUsers, color: C.red },
                    { label: "Email verified", value: t.verifiedUsers, color: C.teal },
                    { label: "Unverified", value: t.unverifiedUsers, color: C.rust },
                    { label: "Signed in last 7d", value: t.activeLast7Days, color: C.violet },
                  ]} />
                </Card>
                <Card>
                  <CardTitle>Export a report</CardTitle>
                  <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 14px", lineHeight: 1.55 }}>
                    Downloads respect the role and status filters set on the User Management tab.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Btn variant="teal" onClick={() => doExport("excel")}>↓ Excel workbook (.xls)</Btn>
                    <Btn variant="ghost" onClick={() => doExport("csv")}>↓ CSV (.csv)</Btn>
                    <Btn variant="ghost" onClick={() => doExport("pdf")}>↓ PDF (print dialog)</Btn>
                  </div>
                </Card>
              </div>
            </>
          )
        )}

        {/* ==================================================== AUDIT LOG = */}
        {tab === "audit" && (
          <>
            <SectionHead
              title="Audit log"
              sub={`${auditMeta.total} recorded administrative action${auditMeta.total === 1 ? "" : "s"}`}
              right={<Btn variant="ghost" size="sm" onClick={() => loadAudit(auditMeta.page)}>↻ Reload</Btn>}
            />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {audit.length === 0 ? <Empty style={{ padding: 50 }}>No actions recorded yet</Empty> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.paperWarm }}>
                        <Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Details</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((l) => (
                        <tr key={l.id} style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                          <Td style={{ whiteSpace: "nowrap", fontSize: 12, color: C.muted }}>
                            {new Date(l.createdAt).toLocaleString()}
                          </Td>
                          <Td>
                            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{l.actorName}</div>
                            {l.actorRole && <div style={{ fontSize: 11, color: C.muted }}>{l.actorRole}</div>}
                          </Td>
                          <Td><ActionBadge action={l.action} /></Td>
                          <Td style={{ fontSize: 12.5 }}>{l.targetName || "—"}</Td>
                          <Td style={{ fontSize: 12, color: C.muted, maxWidth: 320 }}>{l.details || "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {auditMeta.totalPages > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderTop: `1px solid ${C.ruleSoft}`, background: C.paper,
                }}>
                  <span style={{ fontSize: 12.5, color: C.muted }}>Page {auditMeta.page} of {auditMeta.totalPages}</span>
                  <div style={{ display: "flex", gap: 7 }}>
                    <Btn variant="ghost" size="sm" disabled={auditMeta.page <= 1}
                      onClick={() => loadAudit(auditMeta.page - 1)}>← Prev</Btn>
                    <Btn variant="ghost" size="sm" disabled={auditMeta.page >= auditMeta.totalPages}
                      onClick={() => loadAudit(auditMeta.page + 1)}>Next →</Btn>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ===================================================== SETTINGS = */}
        {tab === "settings" && (
          <>
            <SectionHead
              title="Platform settings"
              sub="Changes apply immediately \u2014 no redeploy needed"
              right={<Btn variant="ghost" size="sm" onClick={loadSettings}>\u21bb Reload</Btn>}
            />

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))" }}>
              <PeerLimitCard
                setting={settings.find((s) => s.key === "peer_max_students")}
                onSave={(v) => saveSetting("peer_max_students", v)}
                busy={busy}
              />

              <Card>
                <CardTitle>Peer review participation</CardTitle>
                {!peerOverview ? <Loading /> : (
                  <>
                    <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>
                          {peerOverview.students.filter((s) => s.studentsEvaluated > 0).length}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>students have evaluated</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>
                          {peerOverview.students.filter((s) => s.studentsEvaluated === 0).length}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>not yet participated</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>
                          {peerOverview.totalPeerReviews}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>peer reviews total</div>
                      </div>
                    </div>
                    <div style={{ maxHeight: 230, overflowY: "auto", borderTop: `1px solid ${C.ruleSoft}` }}>
                      {peerOverview.students.map((s) => (
                        <div key={s.id} style={{
                          display: "flex", alignItems: "center", gap: 9, padding: "8px 0",
                          borderBottom: `1px solid ${C.ruleSoft}`,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{s.email}</div>
                          </div>
                          {!s.peerVerifierEnabled && <Badge color={C.red} soft={C.redSoft}>disabled</Badge>}
                          <span style={{
                            fontSize: 12, fontWeight: 700, minWidth: 22, textAlign: "right",
                            color: s.studentsEvaluated > 0 ? C.green : C.muted,
                          }}>{s.studentsEvaluated}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </main>

      {/* ===================================================== MODALS ==== */}
      <CreateUserModal open={modal.type === "create"} busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={handleCreate} />

      <EditUserModal open={modal.type === "edit"} user={modal.payload} busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={handleEdit} />

      <ResetPwModal open={modal.type === "resetPw"} user={modal.payload} busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={handleResetPw} />

      <DeactivateModal open={modal.type === "deactivate"} user={modal.payload} busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={handleStatus} />

      <DeleteModal open={modal.type === "delete"} user={modal.payload} busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={handleDelete} />

      <BulkModal open={modal.type === "bulkDelete"} count={selected.size} action="delete" busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={(reason) => handleBulk("delete", reason)} />

      <BulkModal open={modal.type === "bulkDeactivate"} count={selected.size} action="deactivate" busy={busy}
        onClose={() => setModal({ type: null })} onSubmit={(reason) => handleBulk("deactivate", reason)} />

      <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast({ msg: "", kind: "ok" })} />
    </div>
  );
}

/* ==================================================== small components == */
function SectionHead({ title, sub, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 14, marginBottom: 16, flexWrap: "wrap",
    }}>
      <div>
        <h2 style={{ ...font, margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -.3, color: C.ink }}>{title}</h2>
        {sub && <p style={{ ...font, margin: "3px 0 0", fontSize: 13, color: C.muted }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const CardTitle = ({ children }) => (
  <h3 style={{
    ...font, margin: "0 0 15px", fontSize: 13, fontWeight: 700,
    color: C.inkSoft, textTransform: "uppercase", letterSpacing: .6,
  }}>{children}</h3>
);

const Th = ({ children, style }) => (
  <th style={{
    ...font, textAlign: "left", padding: "10px 13px", fontSize: 11,
    fontWeight: 700, color: C.inkSoft, textTransform: "uppercase",
    letterSpacing: .5, whiteSpace: "nowrap", ...style,
  }}>{children}</th>
);

const Td = ({ children, style }) => (
  <td style={{ ...font, padding: "10px 13px", verticalAlign: "middle", ...style }}>{children}</td>
);

function SortTh({ label, col, filters, setFilters }) {
  const on = filters.sortBy === col;
  return (
    <Th>
      <button onClick={() => setFilters((f) => ({
        ...f, sortBy: col, sortDir: f.sortBy === col && f.sortDir === "desc" ? "asc" : "desc", page: 1,
      }))} style={{
        ...font, background: "none", border: "none", padding: 0, cursor: "pointer",
        fontSize: 11, fontWeight: 700, color: on ? C.gold : C.inkSoft,
        textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", gap: 4,
      }}>
        {label}<span style={{ opacity: on ? 1 : .3 }}>{on && filters.sortDir === "asc" ? "▲" : "▼"}</span>
      </button>
    </Th>
  );
}

function IconBtn({ children, onClick, title, disabled, color = C.inkSoft }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      width: 27, height: 27, borderRadius: 7, border: `1px solid ${C.rule}`,
      background: "#fff", cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 12, color, opacity: disabled ? .32 : 1,
      display: "grid", placeItems: "center", padding: 0,
    }}>{children}</button>
  );
}

function SelectFilter({ label, value, onChange, options }) {
  return (
    <div>
      <span style={{ ...font, fontSize: 11, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: "auto", minWidth: 108, padding: "9px 8px" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function ActionBadge({ action }) {
  const map = {
    "user.create": [C.green, C.greenSoft], "user.update": [C.teal, "#D2E7E5"],
    "user.delete": [C.red, C.redSoft], "user.deactivate": [C.rust, "#F1DACB"],
    "user.activate": [C.green, C.greenSoft], "user.password_reset": [C.violet, "#EDE4FB"],
    "data.export": [C.gold, C.goldSoft],
  };
  const [color, soft] = map[action] || [C.muted, C.paperWarm];
  return <Badge color={color} soft={soft}>{action.replace("user.", "").replace(/_/g, " ")}</Badge>;
}

const Loading = () => (
  <div style={{ ...font, padding: 60, textAlign: "center", color: C.muted, fontSize: 14 }}>Loading…</div>
);

const Empty = ({ children, style }) => (
  <div style={{ ...font, padding: 34, textAlign: "center", color: C.muted, fontSize: 13.5, ...style }}>{children}</div>
);

/* ========================================================== modal forms = */
function CreateUserModal({ open, onClose, onSubmit, busy }) {
  const blank = { name: "", email: "", password: "", role: "Student", emailVerified: true, isActive: true };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setF(blank); setErr(""); } }, [open]);

  const submit = () => {
    if (!f.name.trim()) return setErr("Name is required");
    if (!f.email.trim()) return setErr("Email is required");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a valid email address");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters");
    setErr("");
    onSubmit(f);
  };

  const genPw = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    setF((x) => ({ ...x, password: [...arr].map((n) => chars[n % chars.length]).join("") }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Register a new user" width={520}>
      {err && <ErrBox>{err}</ErrBox>}
      <Field label="Full name" required>
        <input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Abebe Kebede" />
      </Field>
      <Field label="Email address" required>
        <input style={inputStyle} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="abebe@example.com" />
      </Field>
      <Field label="Role" required hint="Determines which agents and screens the user can access.">
        <select style={inputStyle} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      {f.role === "Admin" && (
        <WarnBox>Admin accounts have full access to user management, including deletion. Grant sparingly.</WarnBox>
      )}
      <Field label="Temporary password" required hint="At least 8 characters. Share it securely and ask the user to change it.">
        <div style={{ display: "flex", gap: 7 }}>
          <input style={inputStyle} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" />
          <Btn variant="subtle" size="sm" onClick={genPw} style={{ flexShrink: 0 }}>Generate</Btn>
        </div>
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 6 }}>
        <Check label="Mark email as verified" checked={f.emailVerified}
          onChange={(v) => setF({ ...f, emailVerified: v })}
          hint="Leave on while SMTP is unconfigured — otherwise the user cannot log in." />
        <Check label="Account active" checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} />
      </div>
      <Actions onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create user" />
    </Modal>
  );
}

function EditUserModal({ open, user, onClose, onSubmit, busy }) {
  const [f, setF] = useState({ name: "", email: "", role: "Student", emailVerified: false });
  useEffect(() => {
    if (open && user) setF({ name: user.name, email: user.email || "", role: user.role, emailVerified: user.emailVerified });
  }, [open, user]);
  if (!user) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Edit ${user.name}`} width={480}>
      <Field label="Full name"><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email address"><input style={inputStyle} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Role"><select style={inputStyle} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select></Field>
      <div style={{ marginBottom: 8 }}>
        <Check label="Email verified" checked={f.emailVerified} onChange={(v) => setF({ ...f, emailVerified: v })}
          hint="Turning this on lets the user log in without receiving a verification email." />
      </div>
      <Actions onClose={onClose} onSubmit={() => onSubmit(user.id, f)} busy={busy} submitLabel="Save changes" />
    </Modal>
  );
}

function ResetPwModal({ open, user, onClose, onSubmit, busy }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setPw(""); setErr(""); } }, [open]);
  if (!user) return null;

  const gen = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    setPw([...arr].map((n) => chars[n % chars.length]).join(""));
  };

  return (
    <Modal open={open} onClose={onClose} title={`Reset password — ${user.name}`} width={460}>
      {err && <ErrBox>{err}</ErrBox>}
      <p style={{ ...font, fontSize: 13, color: C.muted, margin: "0 0 15px", lineHeight: 1.55 }}>
        Sets a new password immediately. The user is <strong>not</strong> emailed — share it through a
        secure channel and ask them to change it after signing in.
      </p>
      <Field label="New password" required hint="Minimum 8 characters.">
        <div style={{ display: "flex", gap: 7 }}>
          <input style={inputStyle} value={pw} onChange={(e) => setPw(e.target.value)} />
          <Btn variant="subtle" size="sm" onClick={gen} style={{ flexShrink: 0 }}>Generate</Btn>
        </div>
      </Field>
      {pw && (
        <div style={{
          ...font, background: C.paperWarm, border: `1px solid ${C.rule}`, borderRadius: 8,
          padding: "9px 12px", fontSize: 13, fontFamily: "ui-monospace, monospace",
          wordBreak: "break-all", marginBottom: 14,
        }}>{pw}</div>
      )}
      <Actions onClose={onClose} busy={busy} submitLabel="Reset password" submitVariant="danger"
        onSubmit={() => { if (pw.length < 8) return setErr("Password must be at least 8 characters"); onSubmit(user, pw); }} />
    </Modal>
  );
}

function DeactivateModal({ open, user, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!user) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Deactivate ${user.name}?`} width={460}>
      <WarnBox>
        The account is kept but the user is blocked from signing in. All their data
        (tokens, verifications, syllabi) is preserved and this can be reversed at any time.
      </WarnBox>
      <Field label="Reason (optional)" hint="Shown to the user on their next sign-in attempt.">
        <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Graduated / left the programme" />
      </Field>
      <Actions onClose={onClose} onSubmit={() => onSubmit(user, false, reason)} busy={busy}
        submitLabel="Deactivate account" submitVariant="danger" />
    </Modal>
  );
}

function DeleteModal({ open, user, onClose, onSubmit, busy }) {
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (open) setConfirm(""); }, [open]);
  if (!user) return null;
  const ok = confirm.trim().toUpperCase() === "DELETE";
  return (
    <Modal open={open} onClose={onClose} title="Delete permanently?" width={470}>
      <div style={{
        background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9,
        padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ ...font, fontSize: 13.5, fontWeight: 700, color: C.red, marginBottom: 6 }}>
          This cannot be undone
        </div>
        <div style={{ ...font, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
          Deleting <strong>{user.name}</strong> ({user.email}) also removes their wallet,
          token history, skill verifications, syllabi and messages. If you only need to block
          access, <strong>deactivate instead</strong> — it is reversible and preserves the record.
        </div>
      </div>
      <Field label={`Type DELETE to confirm`} required>
        <input style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
      </Field>
      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 4 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="subtle" onClick={() => { onClose(); }}>Deactivate instead</Btn>
        <Btn variant="danger" disabled={!ok || busy} onClick={() => onSubmit(user)}>
          {busy ? "Deleting…" : "Delete permanently"}
        </Btn>
      </div>
    </Modal>
  );
}

function BulkModal({ open, count, action, onClose, onSubmit, busy }) {
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setConfirm(""); setReason(""); } }, [open]);
  const isDelete = action === "delete";
  const ok = !isDelete || confirm.trim().toUpperCase() === "DELETE";
  return (
    <Modal open={open} onClose={onClose} title={`${isDelete ? "Delete" : "Deactivate"} ${count} user${count === 1 ? "" : "s"}?`} width={460}>
      {isDelete ? (
        <div style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ ...font, fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
            Permanently deletes <strong>{count}</strong> account{count === 1 ? "" : "s"} and all
            associated data. Your own account and the last active administrator are skipped automatically.
          </div>
        </div>
      ) : (
        <WarnBox>
          Blocks {count} user{count === 1 ? "" : "s"} from signing in while keeping their data.
          Reversible at any time.
        </WarnBox>
      )}
      {!isDelete && (
        <Field label="Reason (optional)">
          <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {isDelete && (
        <Field label="Type DELETE to confirm" required>
          <input style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
        </Field>
      )}
      <Actions onClose={onClose} onSubmit={() => onSubmit(reason)} busy={busy} disabled={!ok}
        submitLabel={isDelete ? `Delete ${count}` : `Deactivate ${count}`} submitVariant="danger" />
    </Modal>
  );
}

/* ------------------------------------------------------- form primitives */
function Check({ label, checked, onChange, hint }) {
  return (
    <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, cursor: "pointer", width: 15, height: 15, flexShrink: 0 }} />
      <span>
        <span style={{ ...font, fontSize: 13, fontWeight: 500, color: C.inkSoft }}>{label}</span>
        {hint && <span style={{ ...font, display: "block", fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{hint}</span>}
      </span>
    </label>
  );
}

const ErrBox = ({ children }) => (
  <div style={{
    ...font, background: C.redSoft, border: `1px solid ${C.red}55`, color: C.red,
    padding: "9px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14, fontWeight: 500,
  }}>{children}</div>
);

const WarnBox = ({ children }) => (
  <div style={{
    ...font, background: C.goldSoft, border: `1px solid ${C.gold}55`, color: C.inkSoft,
    padding: "10px 13px", borderRadius: 8, fontSize: 12.5, marginBottom: 15, lineHeight: 1.55,
  }}>{children}</div>
);

function Actions({ onClose, onSubmit, busy, submitLabel, submitVariant = "primary", disabled }) {
  return (
    <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 6 }}>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant={submitVariant} onClick={onSubmit} disabled={busy || disabled}>
        {busy ? "Working…" : submitLabel}
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------- peer limit card */
function PeerLimitCard({ setting, onSave, busy }) {
  const [val, setVal] = useState(setting?.value ?? "1");
  useEffect(() => { if (setting) setVal(setting.value); }, [setting]);

  const n = parseInt(val, 10);
  const valid = !Number.isNaN(n) && n >= -1 && n <= 100;
  const changed = setting && String(setting.value) !== String(val);

  const describe = () => {
    if (!valid) return "Enter a whole number between -1 and 100.";
    if (n === -1) return "Unlimited \u2014 a student may evaluate any number of other students.";
    if (n === 0) return "Peer review is disabled platform-wide.";
    if (n === 1) return "Each student may evaluate exactly ONE other student.";
    return `Each student may evaluate up to ${n} other students.`;
  };

  return (
    <Card>
      <CardTitle>Peer evaluation limit</CardTitle>
      <p style={{ ...font, fontSize: 12.5, color: C.muted, margin: "0 0 14px", lineHeight: 1.6 }}>
        How many <strong>different</strong> students one student may evaluate as a peer.
        A student can never evaluate the same person twice, nor themselves \u2014 those
        rules are always enforced.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
        <input
          type="number" min={-1} max={100} value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{ ...inputStyle, width: 92, textAlign: "center", fontSize: 16, fontWeight: 700,
                   borderColor: valid ? C.rule : C.red }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <Btn key={q} size="sm" variant={String(val) === String(q) ? "teal" : "subtle"}
              onClick={() => setVal(String(q))}>{q}</Btn>
          ))}
          <Btn size="sm" variant={val === "0" ? "danger" : "subtle"} onClick={() => setVal("0")}>Off</Btn>
          <Btn size="sm" variant={val === "-1" ? "teal" : "subtle"} onClick={() => setVal("-1")}>\u221e</Btn>
        </div>
      </div>

      <div style={{
        background: valid ? C.paperWarm : C.redSoft,
        border: `1px solid ${valid ? C.rule : C.red + "55"}`,
        borderRadius: 8, padding: "9px 12px", fontSize: 12.5,
        color: valid ? C.inkSoft : C.red, marginBottom: 14, lineHeight: 1.5,
      }}>{describe()}</div>

      <Btn variant="primary" disabled={!valid || !changed || busy}
        onClick={() => onSave(val)} style={{ width: "100%" }}>
        {busy ? "Saving\u2026" : changed ? "Save change" : "No change to save"}
      </Btn>

      {setting?.updatedBy && (
        <p style={{ ...font, fontSize: 11, color: C.muted, margin: "10px 0 0", textAlign: "center" }}>
          Last changed by {setting.updatedBy}
          {setting.updatedAt ? ` on ${new Date(setting.updatedAt).toLocaleDateString()}` : ""}
        </p>
      )}
    </Card>
  );
}
