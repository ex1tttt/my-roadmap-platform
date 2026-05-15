import { resolveMx } from "dns/promises";

const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Частые одноразовые домены — не принимаем при регистрации. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.de",
  "sharklasers.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwaway.email",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
  "emailondeck.com",
  "tempail.com",
  "burnermail.io",
  "mailnesia.com",
  "spamgourmet.com",
]);

export type RegistrationEmailIssue = "invalid_format" | "disposable" | "no_mx";

export function normalizeRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getRegistrationEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1);
}

export async function validateRegistrationEmail(
  rawEmail: string
): Promise<{ ok: true; email: string } | { ok: false; issue: RegistrationEmailIssue }> {
  const email = normalizeRegistrationEmail(rawEmail);

  if (!email || email.length > 254 || !EMAIL_FORMAT.test(email)) {
    return { ok: false, issue: "invalid_format" };
  }

  const domain = getRegistrationEmailDomain(email);
  if (!domain || domain.length > 253) {
    return { ok: false, issue: "invalid_format" };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, issue: "disposable" };
  }

  try {
    const mx = await resolveMx(domain);
    if (!mx.length) {
      return { ok: false, issue: "no_mx" };
    }
  } catch {
    return { ok: false, issue: "no_mx" };
  }

  return { ok: true, email };
}
