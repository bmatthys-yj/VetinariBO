/**
 * Mailbox providers whose domain says nothing about an employer. Their domain
 * is not sent to the model, since it would only mislead the search.
 */
const PERSONAL_MAIL_DOMAINS = new Set([
  "gmail.com",
  "mail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.be",
  "hotmail.fr",
  "outlook.com",
  "outlook.be",
  "live.com",
  "live.be",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "skynet.be",
  "telenet.be",
  "proximus.be",
  "orange.fr",
  "free.fr",
  "gmx.com",
  "gmx.de",
  "web.de",
]);

/** The email domain, when it can hint at the employer. */
export function employerDomain(email: string): string | undefined {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain && !PERSONAL_MAIL_DOMAINS.has(domain) ? domain : undefined;
}
