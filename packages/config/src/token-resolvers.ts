/**
 * CLI token resolvers.
 *
 * Extends the core {@link TokenProvider} port with an OS-keychain-backed
 * provider, loaded lazily so the native `@napi-rs/keyring` dependency is only
 * required when a profile actually opts into the keychain (workflow-secrets).
 *
 * @packageDocumentation
 */

import { PurelymailConfigError, type TokenProvider } from '@fablabfortsmith/purelymail-core';

/** Keychain service namespace used for all PurelyMail tokens. */
export const KEYCHAIN_SERVICE = 'purelymail';

/** Minimal shape of a keychain entry used by this project. */
export interface KeyringEntry {
  /** Returns the stored secret, or null. */
  getPassword(): string | null;
  /** Stores a secret. */
  setPassword(password: string): void;
}

/** Loads the keyring module. Injectable so provider/writer are testable. */
export type KeyringLoader = () => Promise<{
  Entry: new (service: string, account: string) => KeyringEntry;
}>;

/** Default loader: dynamically import the optional native dependency. */
const defaultLoader: KeyringLoader = () => import('@napi-rs/keyring');

/** Load the keyring `Entry` constructor, failing closed with guidance. */
async function loadEntry(
  loader: KeyringLoader,
): Promise<new (service: string, account: string) => KeyringEntry> {
  try {
    const mod = await loader();
    return mod.Entry;
  } catch (cause) {
    throw new PurelymailConfigError(
      'Keychain support requires the optional dependency "@napi-rs/keyring". ' +
        'Install it (npm i @napi-rs/keyring) or use a tokenEnv instead.',
      { cause },
    );
  }
}

/**
 * Store a secret in the OS keychain (used by the interactive config wizard).
 *
 * @param service - Keychain service namespace.
 * @param account - Keychain account key.
 * @param secret - The token to store (non-empty).
 * @param loader - Optional keyring loader (defaults to the native dep).
 */
export async function setKeychainSecret(
  service: string,
  account: string,
  secret: string,
  loader: KeyringLoader = defaultLoader,
): Promise<void> {
  if (secret.trim() === '') {
    throw new PurelymailConfigError('Refusing to store an empty keychain secret.');
  }
  const Entry = await loadEntry(loader);
  new Entry(service, account).setPassword(secret);
}

/**
 * Resolves a token from the OS credential store (Keychain / libsecret / Windows
 * Credential Manager) via `@napi-rs/keyring`.
 */
export class KeychainTokenProvider implements TokenProvider {
  readonly #service: string;
  readonly #account: string;
  readonly #load: KeyringLoader;

  /**
   * @param service - Keychain service name (namespace).
   * @param account - Keychain account/username key.
   * @param loader - Optional keyring module loader (defaults to the native dep).
   */
  public constructor(service: string, account: string, loader: KeyringLoader = defaultLoader) {
    this.#service = service;
    this.#account = account;
    this.#load = loader;
  }

  /** @inheritDoc */
  public async getToken(): Promise<string> {
    const Entry = await loadEntry(this.#load);
    const secret = new Entry(this.#service, this.#account).getPassword();
    if (secret === null || secret.trim() === '') {
      throw new PurelymailConfigError(
        `No keychain secret found for ${this.#service}/${this.#account}. ` +
          'Store it first with `purelymail profiles add` or your OS keychain tool.',
      );
    }
    return secret;
  }

  /** @inheritDoc */
  public describe(): string {
    return `keychain:${this.#service}/${this.#account}`;
  }
}
