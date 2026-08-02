/**
 * Ambient declaration for the optional native `@napi-rs/keyring` dependency, so
 * the CLI typechecks whether or not that platform binary is installed. The
 * module is loaded lazily at runtime only when a profile opts into the keychain.
 */
declare module '@napi-rs/keyring' {
  /** OS credential-store entry (service + account). */
  export class Entry {
    constructor(service: string, account: string);
    /** Returns the stored secret, or null if none. */
    getPassword(): string | null;
    /** Stores a secret. */
    setPassword(password: string): void;
    /** Deletes the stored secret; returns whether one existed. */
    deletePassword(): boolean;
  }
}
