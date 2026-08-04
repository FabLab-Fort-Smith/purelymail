import { describe, expect, it } from 'vitest';
import { PurelymailConfigError } from '@fablabfortsmith/purelymail-core';
import {
  KeychainTokenProvider,
  setKeychainSecret,
  type KeyringLoader,
} from '../src/token-resolvers.js';

const loaderWith =
  (secret: string | null): KeyringLoader =>
  () =>
    Promise.resolve({
      Entry: class {
        getPassword(): string | null {
          return secret;
        }
        setPassword(_value: string): void {
          /* noop */
        }
      },
    });

describe('KeychainTokenProvider', () => {
  it('returns the stored secret', async () => {
    const p = new KeychainTokenProvider('purelymail', 'acme', loaderWith('kc-secret'));
    await expect(p.getToken()).resolves.toBe('kc-secret');
    expect(p.describe()).toBe('keychain:purelymail/acme');
  });

  it('fails closed when the secret is missing/empty', async () => {
    await expect(
      new KeychainTokenProvider('s', 'a', loaderWith(null)).getToken(),
    ).rejects.toBeInstanceOf(PurelymailConfigError);
    await expect(
      new KeychainTokenProvider('s', 'a', loaderWith('   ')).getToken(),
    ).rejects.toBeInstanceOf(PurelymailConfigError);
  });

  it('explains when the native module cannot be loaded', async () => {
    const failing: KeyringLoader = () => Promise.reject(new Error('MODULE_NOT_FOUND'));
    await expect(new KeychainTokenProvider('s', 'a', failing).getToken()).rejects.toThrow(
      /@napi-rs\/keyring/,
    );
  });

  it('uses the default loader when none is injected', async () => {
    // The native dep is not guaranteed present; either way this fails closed
    // with a config error (missing module or missing secret).
    const p = new KeychainTokenProvider('purelymail-test', 'nonexistent-account');
    await expect(p.getToken()).rejects.toBeInstanceOf(PurelymailConfigError);
  });
});

describe('setKeychainSecret', () => {
  it('stores a secret via the loader', async () => {
    const stored: { account?: string; value?: string } = {};
    const loader: KeyringLoader = () =>
      Promise.resolve({
        Entry: class {
          #account: string;
          constructor(_service: string, account: string) {
            this.#account = account;
          }
          getPassword(): string | null {
            return null;
          }
          setPassword(value: string): void {
            stored.account = this.#account;
            stored.value = value;
          }
        },
      });
    await setKeychainSecret('purelymail', 'acme', 'tok-123', loader);
    expect(stored).toEqual({ account: 'acme', value: 'tok-123' });
  });

  it('refuses an empty secret', async () => {
    const loader: KeyringLoader = () =>
      Promise.resolve({
        Entry: class {
          getPassword(): string | null {
            return null;
          }
          setPassword(): void {
            /* noop */
          }
        },
      });
    await expect(setKeychainSecret('s', 'a', '   ', loader)).rejects.toBeInstanceOf(
      PurelymailConfigError,
    );
  });

  it('explains when the native module is missing', async () => {
    const failing: KeyringLoader = () => Promise.reject(new Error('nope'));
    await expect(setKeychainSecret('s', 'a', 'tok', failing)).rejects.toThrow(/@napi-rs\/keyring/);
  });
});
