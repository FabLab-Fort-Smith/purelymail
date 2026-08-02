/**
 * `@fablabfortsmith/purelymail-cli` — the CLI, also importable so other tools
 * (a web backend, a bot) can embed or extend the command tree.
 *
 * Not affiliated with or endorsed by PurelyMail.
 *
 * @packageDocumentation
 */

export { buildProgram, run, CLI_VERSION } from './program.js';
export { CliContext, type ContextDeps, type GlobalOptions } from './context.js';
export {
  loadProfiles,
  resolveConfigPath,
  type LoadedProfiles,
  type ConfigData,
  type ProfileEntry,
} from './config-file.js';
export {
  readConfigData,
  writeConfigData,
  addProfileEntry,
  upsertProfileEntry,
  removeProfileEntry,
  setDefaultProfile,
} from './config-store.js';
export {
  KeychainTokenProvider,
  setKeychainSecret,
  KEYCHAIN_SERVICE,
  type KeyringLoader,
  type KeyringEntry,
} from './token-resolvers.js';
export { createPrompter, Prompter, type PromptIO, type Choice } from './prompt.js';
export {
  CliError,
  confirm,
  exitCodeFor,
  messageFor,
  printJson,
  printRecord,
  printTable,
  readStdin,
  render,
  stdio,
  type IO,
} from './output.js';
