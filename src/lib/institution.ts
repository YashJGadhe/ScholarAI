/* ScholarAI — INSTITUTION CONFIG (G H Raisoni).
   One file controls branding + email-domain policy:
   • Admin & Faculty  → @raisoni.net          (e.g. shruti.thakur@raisoni.net)
   • Students         → @ghrce.raisoni.net    (e.g. yash.gadhe.cse@ghrce.raisoni.net) */

import type { Role } from "./core";

export const INSTITUTION = {
  name: "G H Raisoni College of Engineering",
  shortName: "GHRCE",
  city: "Nagpur",
  tagline: "Academic Research Intelligence",

  adminFacultyDomain: "raisoni.net",
  studentDomain: "ghrce.raisoni.net",

  /* true → registration enforces the role-specific domains above */
  restrictRegistrationToDomain: true,
};

export const domainForRole = (role: Role): string =>
  role === "STUDENT" ? INSTITUTION.studentDomain : INSTITUTION.adminFacultyDomain;

export const instEmail = (localPart: string, role: Role = "ADMIN"): string =>
  `${localPart}@${domainForRole(role)}`;

export const emailOkForRole = (email: string, role: Role): boolean =>
  email.trim().toLowerCase().endsWith("@" + domainForRole(role).toLowerCase());

/** "Dr. Shruti Thakur" → "shruti.thakur" */
export const facultyLocal = (fullName: string): string => {
  const parts = fullName
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z]/g, "").toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return "faculty";
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
};
