"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  formatApiError,
  type Guide,
  type TeamUser,
  type TeamUserCreatePayload,
  type TeamUserUpdatePayload,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MANAGERS, assignableRoles, type Role } from "@/lib/rbac";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";

const ROLE_STYLE: Record<string, string> = {
  SALES: "bg-sky-50 text-sky-700",
  OPS: "bg-amber-50 text-amber-700",
  MANAGER: "bg-violet-50 text-violet-700",
  ADMIN: "bg-rose-50 text-rose-700",
  CEO: "bg-slate-900 text-white",
  FINANCE: "bg-emerald-50 text-emerald-800",
  TRANSPORT: "bg-orange-50 text-orange-800",
  VENDOR: "bg-teal-50 text-teal-800",
};

const ALL_ROLES: Role[] = ["SALES", "OPS", "MANAGER", "ADMIN", "CEO", "FINANCE", "TRANSPORT", "VENDOR"];
const PARTNER_ROLES = new Set<Role>(["TRANSPORT", "VENDOR"]);

function TeamView() {
  const { user } = useAuth();
  const canAssign = assignableRoles(user?.role);

  const [rows, setRows] = useState<TeamUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [vendors, setVendors] = useState<Guide[]>([]);

  const loadVendors = useCallback(async () => {
    try {
      setVendors(await api.getVendors());
    } catch {
      setVendors([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTeamUsers({
        role: roleFilter || undefined,
        active: activeFilter === "all" ? undefined : activeFilter === "true",
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (showCreate || editing) loadVendors();
  }, [showCreate, editing, loadVendors]);

  const counts = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const r of rows) byRole[r.role] = (byRole[r.role] ?? 0) + 1;
    return { total: rows.length, active: rows.filter((r) => r.active).length, byRole };
  }, [rows]);

  return (
    <AppShell>
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Team</h1>
            <p className="text-sm text-slate-500">
              Staff run the CRM. Transport and vendor logins are tied to a partner record and only see the trips assigned to that partner.
            </p>
          </div>
          {canAssign.length > 0 && (
            <button
              onClick={() => {
                void loadVendors();
                setShowCreate(true);
              }}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Add user
            </button>
          )}
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Stat label="In view" value={String(counts.total)} />
          <Stat label="Active" value={String(counts.active)} />
          <Stat
            label="By role"
            value={ALL_ROLES.filter((r) => counts.byRole[r])
              .map((r) => `${r} ${counts.byRole[r]}`)
              .join(" · ") || "—"}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="all">Active + inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <button
            onClick={load}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading team…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            No users match this filter.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Linked partner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => {
                  const editable =
                    canAssign.includes(u.role) ||
                    (user?.role === "CEO") ||
                    (user?.role === "ADMIN" && u.role !== "CEO");
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            ROLE_STYLE[u.role] || ""
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.vendorName ? `${u.vendorName}${u.vendorCategory ? ` · ${u.vendorCategory}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editable && (
                          <button
                            onClick={() => setEditing(u)}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showCreate && (
          <UserForm
            title="Add team user"
            roles={canAssign}
            vendors={vendors}
            onClose={() => setShowCreate(false)}
            onSubmit={async (payload) => {
              await api.createTeamUser(payload as TeamUserCreatePayload);
              setShowCreate(false);
              await load();
              await loadVendors();
            }}
          />
        )}

        {editing && (
          <UserForm
            title={`Edit ${editing.fullName}`}
            roles={
              user?.role === "CEO"
                ? ALL_ROLES
                : user?.role === "ADMIN"
                  ? ALL_ROLES.filter((r) => r !== "CEO")
                  : canAssign
            }
            vendors={vendors}
            initial={editing}
            isSelf={editing.id === user?.id}
            onClose={() => setEditing(null)}
            onSubmit={async (payload) => {
              const update: TeamUserUpdatePayload = {
                fullName: payload.fullName,
                role: payload.role,
                phone: payload.phone || null,
                active: payload.active,
                vendorId: payload.vendorId ?? null,
              };
              if (payload.password) update.password = payload.password;
              await api.updateTeamUser(editing.id, update);
              setEditing(null);
              await load();
              await loadVendors();
            }}
          />
        )}
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

type PartnerMode = "existing" | "new";

type FormState = {
  email: string;
  fullName: string;
  role: Role;
  phone: string;
  password: string;
  active: boolean;
  vendorId: string;
  partnerMode: PartnerMode;
  partnerCategory: string;
};

function defaultPartnerCategory(role: Role) {
  return role === "TRANSPORT" ? "TRANSPORT" : "HOTEL";
}

function partnerCategoriesFor(role: Role) {
  return role === "TRANSPORT" ? ["TRANSPORT", "DRIVER"] : ["HOTEL", "GUIDE"];
}

function UserForm({
  title,
  roles,
  vendors,
  initial,
  isSelf,
  onClose,
  onSubmit,
}: {
  title: string;
  roles: Role[];
  vendors: Guide[];
  initial?: TeamUser;
  isSelf?: boolean;
  onClose: () => void;
  onSubmit: (payload: TeamUserCreatePayload & { active?: boolean }) => Promise<void>;
}) {
  const initialRole = (initial?.role as Role) ?? roles[0] ?? "SALES";
  const [form, setForm] = useState<FormState>({
    email: initial?.email ?? "",
    fullName: initial?.fullName ?? "",
    role: initialRole,
    phone: initial?.phone ?? "",
    password: "",
    active: initial?.active ?? true,
    vendorId: initial?.vendorId ?? "",
    partnerMode: initial?.vendorId ? "existing" : "new",
    partnerCategory: defaultPartnerCategory(initialRole),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const partnerOptions = useMemo(() => {
    if (!PARTNER_ROLES.has(form.role)) return [];
    return vendors.filter((v) =>
      form.role === "TRANSPORT"
        ? v.category === "TRANSPORT" || v.category === "DRIVER"
        : v.category === "HOTEL" || v.category === "GUIDE",
    );
  }, [form.role, vendors]);

  const partnerValue = partnerOptions.some((v) => v.id === form.vendorId) ? form.vendorId : "";
  const usingExisting = form.partnerMode === "existing" && partnerOptions.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isEdit && form.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const mobile = normalizeIndianMobile(form.phone);
      const phoneOk = mobile.length === 10 && /^[6-9]/.test(mobile) ? mobile : undefined;

      let vendorId: string | undefined;
      if (PARTNER_ROLES.has(form.role)) {
        if (usingExisting) {
          if (!partnerValue) {
            throw new Error("Choose the existing transport or vendor record this login belongs to");
          }
          vendorId = partnerValue;
        } else {
          const created = await api.createVendor({
            category: form.partnerCategory,
            name: form.fullName.trim(),
            phone: phoneOk,
            email: form.email.trim() || undefined,
          });
          vendorId = String(created.id);
        }
      }

      await onSubmit({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        phone: phoneOk,
        password: form.password,
        active: form.active,
        vendorId,
      });
    } catch (err) {
      setError(formatApiError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          You can assign: {roles.join(", ") || "none"}
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Full name
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            disabled={isEdit}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          />
        </label>

        <div className="mt-3">
          <label htmlFor="team-phone" className="block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input
            id="team-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="9876543210"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            10-digit Indian mobile (leading 0 / +91 ok)
          </p>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Role
          <select
            required
            disabled={isSelf}
            value={form.role}
            onChange={(e) => {
              const role = e.target.value as Role;
              setForm({
                ...form,
                role,
                vendorId: "",
                partnerMode: "new",
                partnerCategory: defaultPartnerCategory(role),
              });
            }}
            className="mt-1 block w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        {PARTNER_ROLES.has(form.role) && (
          <div className="mt-3 space-y-2">
            <p className="block text-sm font-medium text-slate-700">Partner record</p>
            {partnerOptions.length > 0 && (
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, partnerMode: "new", vendorId: "" })}
                  className={`rounded-md px-3 py-1.5 ${
                    !usingExisting ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
                  }`}
                >
                  New partner
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, partnerMode: "existing" })}
                  className={`rounded-md px-3 py-1.5 ${
                    usingExisting ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
                  }`}
                >
                  Existing partner
                </button>
              </div>
            )}
            {usingExisting ? (
              <select
                id="team-partner"
                required
                value={partnerValue}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                className="block w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="" disabled>
                  Choose a partner…
                </option>
                {partnerOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.category}
                  </option>
                ))}
              </select>
            ) : (
              <label className="block text-sm font-medium text-slate-700">
                Partner type
                <select
                  required
                  value={form.partnerCategory}
                  onChange={(e) => setForm({ ...form, partnerCategory: e.target.value })}
                  className="mt-1 block w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  {partnerCategoriesFor(form.role).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-xs text-slate-400">
              {usingExisting
                ? "This login only sees trips already assigned to that partner."
                : "Save creates the partner under Vendors from this name, then attaches the login."}
            </p>
          </div>
        )}

        <label className="mt-3 block text-sm font-medium text-slate-700">
          {isEdit ? "New password (optional)" : "Password"}
          <input
            type="password"
            required={!isEdit}
            minLength={isEdit ? undefined : 8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete={isEdit ? "new-password" : "new-password"}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>

        {isEdit && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              disabled={isSelf}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active account
          </label>
        )}

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Strip +91 / leading 0 / spaces → 10-digit mobile when possible. */
function normalizeIndianMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export default function TeamPage() {
  return (
    <Protected allowedRoles={MANAGERS}>
      <TeamView />
    </Protected>
  );
}
