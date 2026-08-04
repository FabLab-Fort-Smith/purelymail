/**
 * `@fablabfortsmith/purelymail-config` — shared profile/config loading for the
 * PurelyMail toolkit.
 *
 * Reads the non-secret TOML config into a core `ProfileRegistry`, wiring each
 * profile to its token source (an env var, or the OS keychain via the optional
 * `@napi-rs/keyring`). Consumed by both the CLI and the TUI so the two adapters
 * share one loader.
 *
 * @packageDocumentation
 */
export {
  loadProfiles,
  resolveConfigPath,
  profileEntrySchema,
  configSchema,
  type ProfileEntry,
  type ConfigData,
  type LoadedProfiles,
} from './config-file.js';
export {
  KeychainTokenProvider,
  setKeychainSecret,
  KEYCHAIN_SERVICE,
  type KeyringLoader,
  type KeyringEntry,
} from './token-resolvers.js';
