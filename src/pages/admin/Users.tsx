import { useEffect, useState } from "react";
import * as api from "../../lib/api";
import type { SafeUser } from "../../lib/api";
import type { Role } from "../../lib/core";
import { fmtDate } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { Confirm, Modal, PageHeader, RoleChip, Skeleton, Spinner, useToast } from "../../components/ui";
import { IcPlus, IcSearch, IcTrash } from "../../components/icons";

const ROLES: Role[] = ["ADMIN", "FACULTY", "STUDENT"];

export default function UsersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<SafeUser[] | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SafeUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inv, setInv] = useState({ name: "", email: "", role: "STUDENT" as Role, password: "", faculty_id: "" });
  const [invBusy, setInvBusy] = useState(false);
  const [authors, setAuthors] = useState<{ _id: string; name: string }[]>([]);

  const load = () => api.listUsers(token).then(setUsers).catch((e) => toast("error", e.message));

  useEffect(() => {
    load();
    api.listAuthors(token).then((a) => setAuthors(a.map((x) => ({ _id: x._id, name: x.name })))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRole = async (u: SafeUser, role: Role) => {
    if (role === u.role) return;
    setBusyId(u._id);
    try {
      setUsers(await api.updateUserRole(token, u._id, role));
      toast("success", `${u.name} is now ${role}.`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Role change failed.");
    } finally { setBusyId(null); }
  };

  const toggleActive = async (u: SafeUser) => {
    setBusyId(u._id);
    try {
      setUsers(await api.toggleUserActive(token, u._id));
      toast("success", u.active ? `${u.name} deactivated.` : `${u.name} re-activated.`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Action failed.");
    } finally { setBusyId(null); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete._id);
    try {
      setUsers(await api.deleteUser(token, toDelete._id));
      toast("success", `${toDelete.name} removed.`);
      setToDelete(null);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Delete failed.");
    } finally { setBusyId(null); }
  };

  const invite = async () => {
    setInvBusy(true);
    try {
      await api.inviteUser(token, { ...inv, faculty_id: inv.faculty_id || null });
      toast("success", `${inv.name} invited as ${inv.role}.`);
      setInviteOpen(false);
      setInv({ name: "", email: "", role: "STUDENT", password: "", faculty_id: "" });
      load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Invite failed.");
    } finally { setInvBusy(false); }
  };

  const filtered = (users ?? []).filter((u) =>
    (roleFilter === "ALL" || u.role === roleFilter) &&
    (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title="Users" sub="Authentication accounts · roles are enforced on every API request, not just in this UI"
        actions={<button className="btn-primary" onClick={() => setInviteOpen(true)}><IcPlus size={16} /> Invite user</button>} />

      <div className="card p-3 flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><IcSearch size={15} /></span>
          <input className="input pl-9" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(["ALL", ...ROLES] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`h-9 px-3 rounded-lg text-[12.5px] font-bold transition-colors cursor-pointer ${roleFilter === r ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100"}`}>
              {r === "ALL" ? "All roles" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {!users ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-400">No users match this filter.</div>
        ) : (
          <table className="w-full">
            <thead><tr>
              <th className="th">User</th><th className="th">Role</th><th className="th">Status</th>
              <th className="th">Linked researcher</th><th className="th">Created</th><th className="th text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u._id} className={`transition-colors hover:bg-primary-50/30 ${!u.active ? "opacity-60" : ""}`}>
                  <td className="td">
                    <div className="font-semibold text-ink-900">{u.name}</div>
                    <div className="num text-[11.5px] text-ink-400">{u.email}</div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <RoleChip role={u.role} />
                      {busyId === u._id ? <Spinner /> : (
                        <select className="h-7 px-1.5 rounded-md border border-ink-200 text-[11.5px] font-semibold text-ink-600 bg-white cursor-pointer"
                          value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="td">
                    <button onClick={() => toggleActive(u)}
                      className={`chip cursor-pointer ${u.active ? "bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100" : "bg-danger-50 text-danger-700 border border-danger-100 hover:bg-danger-100"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? "bg-primary-500" : "bg-danger-600"}`} />
                      {u.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="td text-[13px] text-ink-600">{u.faculty_id ? authors.find((a) => a._id === u.faculty_id)?.name ?? u.faculty_id : "—"}</td>
                  <td className="td text-[12.5px] text-ink-500">{fmtDate(u.created_at)}</td>
                  <td className="td text-right">
                    <button className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50" onClick={() => setToDelete(u)}><IcTrash size={14} /> Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11.5px] text-ink-400 mt-3">
        Safety rules enforced by the API: an admin cannot remove or downgrade themselves, and the last remaining ADMIN can be neither deleted nor downgraded.
      </p>

      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete} busy={busyId === toDelete?._id}
        title="Remove user" danger
        body={<>Remove <strong>{toDelete?.name}</strong> ({toDelete?.email})? They will lose access immediately. This does not delete research data.</>} />

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a user">
        <div className="space-y-3.5">
          <div><label className="label">Full name</label><input className="input" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} placeholder="Dr. …" /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="user@scholarai.edu" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select className="input cursor-pointer" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as Role })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input className="input" value={inv.password} onChange={(e) => setInv({ ...inv, password: e.target.value })} placeholder="min 8 chars" />
            </div>
          </div>
          {inv.role === "FACULTY" && (
            <div>
              <label className="label">Link researcher profile</label>
              <select className="input cursor-pointer" value={inv.faculty_id} onChange={(e) => setInv({ ...inv, faculty_id: e.target.value })}>
                <option value="">— none —</option>
                {authors.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={invite} disabled={invBusy || !inv.name || !inv.email || !inv.password}>
              {invBusy ? <Spinner light /> : null} Create account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
