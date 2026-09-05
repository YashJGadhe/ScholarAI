import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../lib/api";
import { pollAuthor } from "../../lib/connectors";
import type { Author, DeletedAuthor } from "../../lib/core";
import { fmtDate, timeAgo } from "../../lib/core";
import { useAuth } from "../../state/auth";
import { Confirm, IdentityBadge, Metric, Modal, PageHeader, Skeleton, Spinner, useToast } from "../../components/ui";
import { IcPen, IcPlus, IcRadar, IcRestore, IcSearch, IcTrash } from "../../components/icons";

export default function FacultyPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<"active" | "deleted">("active");
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [deleted, setDeleted] = useState<DeletedAuthor[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Author | null>(null);
  const [form, setForm] = useState({ name: "", department: "", designation: "", email: "", areas: "" });
  const [toDelete, setToDelete] = useState<Author | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setAuthors(await api.listAuthors(token));
      setDeleted(await api.listDeletedAuthors(token));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Load failed.");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openEdit = (a: Author) => {
    setEdit(a);
    setForm({ name: a.name, department: a.department, designation: a.designation, email: a.email, areas: a.research_areas.join(", ") });
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusyId(edit._id);
    try {
      await api.updateAuthor(token, edit._id, {
        name: form.name.trim(), department: form.department.trim(), designation: form.designation.trim(),
        email: form.email.trim(), research_areas: form.areas.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast("success", "Faculty profile updated.");
      setEdit(null);
      load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Update failed.");
    } finally { setBusyId(null); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete._id);
    try {
      await api.deleteAuthor(token, toDelete._id);
      toast("success", `${toDelete.name} moved to deleted records (restorable).`);
      setToDelete(null);
      load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Delete failed.");
    } finally { setBusyId(null); }
  };

  const restore = async (d: DeletedAuthor) => {
    setBusyId(d._id);
    try {
      await api.restoreAuthor(token, d._id);
      toast("success", `${d.name} restored to active faculty.`);
      load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Restore failed.");
    } finally { setBusyId(null); }
  };

  const pollNow = async (a: Author) => {
    setPollingId(a._id);
    try {
      const res = await pollAuthor(a._id, user?.email ?? "admin");
      if (res.log.result === "UNCHANGED") toast("info", `${a.name}: summary unchanged — full collection skipped (${res.log.api_calls} API calls).`);
      else toast("success", `${a.name}: delta detected — ${res.log.change_reason.join("; ")}.`);
      load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Polling failed.");
    } finally { setPollingId(null); }
  };

  const filtered = (authors ?? []).filter((a) =>
    a.name.toLowerCase().includes(q.toLowerCase()) || a.department.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Faculty" sub="Researcher records, identity verification and lifecycle"
        actions={<button className="btn-primary" onClick={() => nav("/admin/faculty/add")}><IcPlus size={16} /> Add faculty</button>} />

      <div className="card p-3 flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><IcSearch size={15} /></span>
          <input className="input pl-9" placeholder="Search name or department…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setTab("active")} className={`h-9 px-3.5 rounded-lg text-[12.5px] font-bold cursor-pointer ${tab === "active" ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100"}`}>Active ({authors?.length ?? "…"})</button>
          <button onClick={() => setTab("deleted")} className={`h-9 px-3.5 rounded-lg text-[12.5px] font-bold cursor-pointer ${tab === "deleted" ? "bg-danger-600 text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100"}`}>Deleted ({deleted.length})</button>
        </div>
      </div>

      {tab === "active" ? (
        <div className="card overflow-hidden">
          {!authors ? (
            <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-400">No faculty match your search.</div>
          ) : (
            <table className="w-full">
              <thead><tr>
                <th className="th">Researcher</th><th className="th">Identity</th><th className="th">ORCID</th>
                <th className="th text-right">Scopus P/C/H</th><th className="th">Last polled</th><th className="th text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((a) => {
                  const m = a.platform_metrics.SCOPUS;
                  return (
                    <tr key={a._id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="td">
                        <div className="font-semibold text-ink-900">{a.name}</div>
                        <div className="text-[11.5px] text-ink-400">{a.designation} · {a.department}</div>
                      </td>
                      <td className="td"><IdentityBadge status={a.identity.status} size="sm" /></td>
                      <td className="td num text-[12px] text-ink-500">{a.identifiers.orcid ?? "NA"}</td>
                      <td className="td text-right">
                        <Metric v={m?.papers ?? null} /> <span className="text-ink-300">/</span> <Metric v={m?.citations ?? null} strong /> <span className="text-ink-300">/</span> <Metric v={m?.h_index ?? null} />
                      </td>
                      <td className="td text-[12px] text-ink-500">{timeAgo(a.last_polled_at)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn-ghost btn-sm" title="Check for updates (summary-first)" onClick={() => pollNow(a)} disabled={pollingId === a._id}>
                            {pollingId === a._id ? <Spinner /> : <IcRadar size={14} />} Poll
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => openEdit(a)}><IcPen size={14} /> Edit</button>
                          <button className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50" onClick={() => setToDelete(a)}><IcTrash size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {deleted.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-400">No deleted records. Deletion is soft — records stay restorable.</div>
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">Researcher</th><th className="th">Department</th><th className="th">Deleted</th><th className="th">By</th><th className="th text-right">Action</th></tr></thead>
              <tbody>
                {deleted.map((d) => (
                  <tr key={d._id} className="hover:bg-danger-50/40 transition-colors">
                    <td className="td font-semibold text-ink-800">{d.name}</td>
                    <td className="td text-[13px] text-ink-500">{d.department}</td>
                    <td className="td text-[12.5px] text-ink-500">{fmtDate(d.deleted_at)}</td>
                    <td className="td num text-[12px] text-ink-500">{d.deleted_by}</td>
                    <td className="td text-right">
                      <button className="btn-primary btn-sm" onClick={() => restore(d)} disabled={busyId === d._id}>
                        {busyId === d._id ? <Spinner light /> : <IcRestore size={14} />} Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit — ${edit?.name}`}>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Department</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="label">Research areas (comma separated)</label><input className="input" value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit} disabled={busyId === edit?._id}>{busyId === edit?._id ? <Spinner light /> : null} Save changes</button>
          </div>
        </div>
      </Modal>

      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete} busy={busyId === toDelete?._id} danger
        title="Delete faculty record"
        body={<><strong>{toDelete?.name}</strong> will be moved to <em>deleted_authors</em>. Publications remain in the corpus; the record can be restored at any time.</>} />
    </div>
  );
}
