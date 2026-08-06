/**
 * Secure password generation (CSPRNG).
 *
 * Uses Node's `crypto.randomInt` (a cryptographically secure RNG — never
 * `Math.random`, per `topic-cryptography`). Ambiguous characters (0/O, 1/l/I)
 * are excluded, and at least one lower/upper/digit (and symbol, when enabled)
 * is guaranteed before a CSPRNG shuffle.
 *
 * @packageDocumentation
 */
import { randomInt } from 'node:crypto';

const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const DIGITS = '23456789'; // no 0, 1
const SYMBOLS = '!@#$%^&*-_=+';

/** Options for {@link generatePassword}. */
export interface PasswordOptions {
  /** Total length (clamped to a minimum of 12). Defaults to 20. */
  readonly length?: number;
  /** Include symbols. Defaults to `true`. */
  readonly symbols?: boolean;
}

/** Pick one character from `chars` using a CSPRNG. */
function pick(chars: string): string {
  return chars.charAt(randomInt(chars.length));
}

/**
 * Generate a strong random password. Guarantees at least one character from
 * each enabled class, then fills and CSPRNG-shuffles to the requested length.
 *
 * @param options - Length and whether to include symbols.
 * @returns A freshly generated password.
 */
export function generatePassword(options?: PasswordOptions): string {
  const length = Math.max(12, options?.length ?? 20);
  const useSymbols = options?.symbols ?? true;
  const classes = useSymbols ? [LOWER, UPPER, DIGITS, SYMBOLS] : [LOWER, UPPER, DIGITS];
  const pool = classes.join('');

  const chars: string[] = classes.map((c) => pick(c));
  while (chars.length < length) {
    chars.push(pick(pool));
  }
  // Fisher–Yates shuffle so the guaranteed class chars aren't in fixed slots.
  // i and j are always valid indices into the non-empty array.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = tmp;
  }
  return chars.join('');
}
