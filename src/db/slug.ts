import { randomBytes } from "node:crypto";

/** Characters that read unambiguously in a URL someone may retype. */
const SUFFIX_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
const SUFFIX_LENGTH = 6;

function toKebabCase(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** A random suffix, so slugs never collide and cannot be enumerated. */
function randomSuffix(): string {
  const bytes = randomBytes(SUFFIX_LENGTH);
  let suffix = "";
  for (const byte of bytes) suffix += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length];
  return suffix;
}

/**
 * Build the path segment the hosted enrollment form is served under.
 *
 * The readable prefix makes a shared link recognizable; the random suffix makes
 * the page unlisted, so a workshop is reachable only by someone given the link
 * and no one can walk the list of workshops.
 */
export function generateWorkshopSlug(name: string): string {
  const prefix = toKebabCase(name);
  return prefix ? `${prefix}-${randomSuffix()}` : randomSuffix();
}
