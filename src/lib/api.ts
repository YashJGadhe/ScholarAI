/* ScholarAI — API + authentication + RBAC layer.
   Mirrors the FastAPI route contracts (auth, users, faculty, publications,
   citations, analytics, reports, admin). Every mutation re-validates the token
   and role server-side — the UI may hide controls, but the API enforces. */

import type { Author, Role, Settings, User } from "./core";
import { nowIso, uid } from "./core";
import { getDB, resetDB, saveDB, sleep } from "./db";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Stand-in for passlib/bcrypt hashing (sandbox); Unicode-safe. */
const pw = (p: string) => btoa(unescape(encodeURIComponent(p)));

/* ---------------- JWT-style tokens (sandbox analogue of python-jose) ---------------- */

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function signToken(user: User): string {
  const payload = { sub: user._id, email: user.email, role: user.role, exp: Date.now() + 24 * 3600 * 1000 };
  const body = btoa(JSON.stringify(payload));
  return `${body}.${hash(body + "scholarai-secret")}`;
}

function verifyToken(token: string | null): { sub: string; role: Role; exp: number } | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || sig !== hash(body + "scholarai-secret")) return null;
  try {
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem("scholarai.token");
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem("scholarai.token", t);
  else localStorage.removeItem("scholarai.token");
}

function requireUser(token: string | null, roles?: Role[]): User {
  const payload = verifyToken(token);
  if (!payload) throw new ApiError(401, "Authentication required. Please sign in.");
  const user = getDB().users.find((u) => u._id === payload.sub);
  if (!user) throw new ApiError(401, "Account no longer exists.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Contact the administrator.");
  if (roles && !roles.includes(user.role)) throw new ApiError(403, `Forbidden: requires ${roles.join(" or ")} role.`);
  return user;
}

const publicUser = (u: User) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, active: u.active, faculty_id: u.faculty_id, created_at: u.created_at, last_login_at: u.last_login_at });
export type SafeUser = ReturnType<typeof publicUser>;

/* ---------------- /auth ---------------- */

export async function login(email: string, password: string): Promise<{ token: string; user: SafeUser }> {
  await sleep(420);
  const db = getDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password_hash !== pw(password)) throw new ApiError(401, "Invalid email or password.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Contact the administrator.");
  user.last_login_at = nowIso();
  saveDB();
  return { token: signToken(user), user: publicUser(user) };
}

export async function register(name: string, email: string, password: string): Promise<{ token: string; user: SafeUser }> {
  await sleep(420);
  const db = getDB();
  if (name.trim().length < 3) throw new ApiError(422, "Name must be at least 3 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new ApiError(422, "Enter a valid email address.");
  if (password.length < 8) throw new ApiError(422, "Password must be at least 8 characters.");
  if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw new ApiError(409, "An account with this email already exists.");
  const user: User = {
    _id: uid("u"), name: name.trim(), email: email.trim().toLowerCase(),
    password_hash: pw(password), role: "STUDENT", active: true, faculty_id: null,
    created_at: nowIso(), last_login_at: nowIso(),
  };
  db.users.push(user);
  saveDB();
  return { token: signToken(user), user: publicUser(user) };
}

export async function me(token: string | null): Promise<SafeUser> {
  await sleep(120);
  return publicUser(requireUser(token));
}

/* ---------------- /admin/users ---------------- */

export async function listUsers(token: string | null): Promise<SafeUser[]> {
  await sleep(300);
  requireUser(token, ["ADMIN"]);
  return getDB().users.map(publicUser);
}

export async function inviteUser(token: string | null, data: { name: string; email: string; role: Role; password: string; faculty_id?: string | null }): Promise<SafeUser> {
  await sleep(380);
  requireUser(token, ["ADMIN"]);
  const db = getDB();
  if (db.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) throw new ApiError(409, "Email already registered.");
  if (data.password.length < 8) throw new ApiError(422, "Temporary password must be at least 8 characters.");
  const user: User = {
    _id: uid("u"), name: data.name.trim(), email: data.email.trim().toLowerCase(),
    password_hash: pw(data.password), role: data.role, active: true,
    faculty_id: data.faculty_id ?? null, created_at: nowIso(), last_login_at: null,
  };
  db.users.push(user);
  saveDB();
  return publicUser(user);
}

export async function updateUserRole(token: string | null, userId: string, role: Role): Promise<SafeUser[]> {
  await sleep(320);
  const admin = requireUser(token, ["ADMIN"]);
  const db = getDB();
  const target = db.users.find((u) => u._id === userId);
  if (!target) throw new ApiError(404, "User not found.");
  if (target._id === admin._id) throw new ApiError(403, "You cannot change your own role.");
  if (target.role === "ADMIN" && role !== "ADMIN") {
    const admins = db.users.filter((u) => u.role === "ADMIN" && u.active);
    if (admins.length <= 1) throw new ApiError(403, "The last remaining ADMIN cannot be downgraded.");
  }
  target.role = role;
  saveDB();
  return db.users.map(publicUser);
}

export async function toggleUserActive(token: string | null, userId: string): Promise<SafeUser[]> {
  await sleep(300);
  const admin = requireUser(token, ["ADMIN"]);
  const db = getDB();
  const target = db.users.find((u) => u._id === userId);
  if (!target) throw new ApiError(404, "User not found.");
  if (target._id === admin._id) throw new ApiError(403, "You cannot deactivate your own account.");
  if (target.role === "ADMIN" && target.active) {
    const admins = db.users.filter((u) => u.role === "ADMIN" && u.active);
    if (admins.length <= 1) throw new ApiError(403, "The last active ADMIN cannot be deactivated.");
  }
  target.active = !target.active;
  saveDB();
  return db.users.map(publicUser);
}

export async function deleteUser(token: string | null, userId: string): Promise<SafeUser[]> {
  await sleep(320);
  const admin = requireUser(token, ["ADMIN"]);
  const db = getDB();
  const target = db.users.find((u) => u._id === userId);
  if (!target) throw new ApiError(404, "User not found.");
  if (target._id === admin._id) throw new ApiError(403, "An admin cannot delete their own account.");
  if (target.role === "ADMIN") {
    const admins = db.users.filter((u) => u.role === "ADMIN");
    if (admins.length <= 1) throw new ApiError(403, "The last remaining ADMIN cannot be deleted.");
  }
  db.users = db.users.filter((u) => u._id !== userId);
  saveDB();
  return db.users.map(publicUser);
}

/* ---------------- /faculty ---------------- */

export async function listAuthors(token: string | null): Promise<Author[]> {
  await sleep(340);
  requireUser(token);
  return JSON.parse(JSON.stringify(getDB().authors)) as Author[];
}

export async function getAuthor(token: string | null, id: string): Promise<Author> {
  await sleep(220);
  requireUser(token);
  const a = getDB().authors.find((x) => x._id === id);
  if (!a) throw new ApiError(404, "Researcher not found.");
  return JSON.parse(JSON.stringify(a)) as Author;
}

export async function getMyFaculty(token: string | null): Promise<Author> {
  await sleep(260);
  const user = requireUser(token, ["FACULTY", "ADMIN"]);
  const id = user.faculty_id ?? getDB().authors[0]?._id;
  const a = getDB().authors.find((x) => x._id === id);
  if (!a) throw new ApiError(404, "No linked researcher profile.");
  return JSON.parse(JSON.stringify(a)) as Author;
}

export async function updateAuthor(token: string | null, id: string, patch: Partial<Pick<Author, "name" | "department" | "designation" | "email" | "research_areas" | "profile_urls">>): Promise<Author> {
  await sleep(360);
  requireUser(token, ["ADMIN"]);
  const db = getDB();
  const a = db.authors.find((x) => x._id === id);
  if (!a) throw new ApiError(404, "Researcher not found.");
  Object.assign(a, patch, { updated_at: nowIso() });
  saveDB();
  return JSON.parse(JSON.stringify(a)) as Author;
}

export async function deleteAuthor(token: string | null, id: string): Promise<void> {
  await sleep(380);
  const admin = requireUser(token, ["ADMIN"]);
  const db = getDB();
  const idx = db.authors.findIndex((x) => x._id === id);
  if (idx < 0) throw new ApiError(404, "Researcher not found.");
  const [removed] = db.authors.splice(idx, 1);
  db.deleted_authors.unshift({ ...removed, deleted_at: nowIso(), deleted_by: admin.email });
  saveDB();
}

export async function listDeletedAuthors(token: string | null) {
  await sleep(260);
  requireUser(token, ["ADMIN"]);
  return JSON.parse(JSON.stringify(getDB().deleted_authors));
}

export async function restoreAuthor(token: string | null, id: string): Promise<void> {
  await sleep(360);
  requireUser(token, ["ADMIN"]);
  const db = getDB();
  const idx = db.deleted_authors.findIndex((x) => x._id === id);
  if (idx < 0) throw new ApiError(404, "Deleted record not found.");
  const [restored] = db.deleted_authors.splice(idx, 1);
  const { deleted_at: _d, deleted_by: _b, ...author } = restored;
  void _d; void _b;
  author.updated_at = nowIso();
  db.authors.push(author);
  saveDB();
}

/* ---------------- /faculty/fetch-data + confirm (admin-only) ---------------- */

import type { FetchPreview } from "./connectors";
import { fetchPreview as runFetchPreview, persistNewFaculty } from "./connectors";

export async function previewFaculty(token: string | null, input: Parameters<typeof runFetchPreview>[0]): Promise<FetchPreview> {
  requireUser(token, ["ADMIN"]);
  return runFetchPreview(input);
}

export async function confirmNewFaculty(token: string | null, preview: FetchPreview): Promise<Author> {
  await sleep(420);
  requireUser(token, ["ADMIN"]);
  return persistNewFaculty(preview);
}

/* ---------------- /publications ---------------- */

export async function listPapers(token: string | null) {
  await sleep(380);
  requireUser(token);
  return JSON.parse(JSON.stringify(getDB().papers));
}

export async function getPaper(token: string | null, id: string) {
  await sleep(200);
  requireUser(token);
  const p = getDB().papers.find((x) => x._id === id);
  if (!p) throw new ApiError(404, "Publication not found.");
  return JSON.parse(JSON.stringify(p));
}

/* ---------------- polling logs / api usage / settings ---------------- */

export async function listPollingLogs(token: string | null) {
  await sleep(260);
  requireUser(token, ["ADMIN"]);
  return JSON.parse(JSON.stringify(getDB().polling_logs));
}

export async function listApiUsage(token: string | null) {
  await sleep(220);
  requireUser(token, ["ADMIN"]);
  return JSON.parse(JSON.stringify(getDB().api_usage));
}

export async function getSettings(token: string | null): Promise<Settings> {
  await sleep(200);
  requireUser(token, ["ADMIN"]);
  return { ...getDB().settings, keys: { ...getDB().settings.keys } };
}

export async function updateSettings(token: string | null, patch: Partial<Settings>): Promise<Settings> {
  await sleep(340);
  requireUser(token, ["ADMIN"]);
  const db = getDB();
  db.settings = { ...db.settings, ...patch, keys: { ...db.settings.keys, ...(patch.keys ?? {}) } };
  saveDB();
  return { ...db.settings };
}

export async function resetDemoData(token: string | null): Promise<void> {
  await sleep(500);
  requireUser(token, ["ADMIN"]);
  resetDB();
}
