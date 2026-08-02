/**
 * `@fablabfortsmith/purelymail-core` — unofficial, framework-free TypeScript
 * client for the PurelyMail API, plus multi-account/organization aggregation.
 *
 * Not affiliated with or endorsed by PurelyMail.
 *
 * @packageDocumentation
 */

export * from './errors.js';
export * from './config.js';
export * from './retry.js';
export * from './internal.js';

export * from './http/transport.js';
export * from './http/fetch-transport.js';
export * from './auth/token-provider.js';
export * from './logging/logger.js';

export * from './schemas.js';
export * from './types.js';

export * from './services/account.js';
export * from './services/app-passwords.js';
export * from './services/domains.js';
export * from './services/password-reset.js';
export * from './services/routing.js';
export * from './services/users.js';

export * from './client.js';
export * from './profiles.js';
export * from './workspace.js';
