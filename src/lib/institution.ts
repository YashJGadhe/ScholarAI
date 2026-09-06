/* ScholarAI — INSTITUTION CONFIG.
   Edit this ONE file to rebrand the platform for your institute:
   every login/register email, the seeded accounts and the sign-in screen
   pick these values up automatically. */

export const INSTITUTION = {
  /* Full name shown on the sign-in screen */
  name: "G H Raisoni College of Engineering",

  /* Short name used in titles / footer */
  shortName: "GHRCE Nagpur",

  /* YOUR INSTITUTE DOMAIN — all seeded logins become <local-part>@<emailDomain> */
  emailDomain: "raisoni.edu",

  tagline: "Academic Research Intelligence",

  /* true  → self-registration only accepts addresses ending in @<emailDomain>
     false → any email may register (they join as STUDENT) */
  restrictRegistrationToDomain: true,
};

/** Build an institute email from a local part, e.g. instEmail("admin") → admin@<domain> */
export const instEmail = (localPart: string) => `${localPart}@${INSTITUTION.emailDomain}`;
