# PurelyMail API v0 — reference (as consumed by this project)

Verified against the official OpenAPI specification at
<https://news.purelymail.com/api/> (title "Purelymail API", version 0.0.1) on
2026-08-02. This is a working reference for maintainers; the spec is authoritative.

> Unofficial. Not affiliated with or endorsed by PurelyMail.

## Transport

- **Base URL:** `https://purelymail.com`
- **All endpoints:** `POST /api/v0/<operation>`, JSON request + JSON response.
- **Auth:** header `Purelymail-Api-Token: <token>` on every request. Obtain a
  token from the account settings → "Refresh API Key".
- **Response envelope (observed):** success → `{ "type": "success", "result": … }`
  (the spec models it as `{ "result": … }`); error → `{ "type": "error",
"code": "…", "message": "…" }`. This client handles both and fails closed on
  unknown shapes (see `COMPLIANCE.md` EX-5).

## Endpoints

### Users / mailboxes

| Operation    | Request fields                                                                                                                                                                                                       | Result                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `createUser` | `userName`_, `domainName`_, `password`\*, `enablePasswordReset`=true, `recoveryEmail`, `recoveryEmailDescription`, `recoveryPhone`, `recoveryPhoneDescription`, `enableSearchIndexing`=true, `sendWelcomeEmail`=true | empty                                                                                                            |
| `deleteUser` | `userName`\* (full `user@domain`)                                                                                                                                                                                    | empty                                                                                                            |
| `listUser`   | —                                                                                                                                                                                                                    | `{ users: string[] }`                                                                                            |
| `getUser`    | `userName`\*                                                                                                                                                                                                         | `{ enableSearchIndexing, recoveryEnabled, requireTwoFactorAuthentication, enableSpamFiltering, resetMethods[] }` |
| `modifyUser` | `userName`\*, `newUserName`, `newPassword`, `enableSearchIndexing`, `enablePasswordReset`, `requireTwoFactorAuthentication`                                                                                          | empty                                                                                                            |

`userName` in `createUser` is the **local part**; elsewhere it is the **full**
address.

### Password-reset (recovery) methods

| Operation             | Request fields                                                                                                | Result                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `upsertPasswordReset` | `userName`_, `type`_ (`email`\|`phone`), `target`\*, `existingTarget`, `description`="", `allowMfaReset`=true | empty                                                       |
| `deletePasswordReset` | `userName`\*, `target`                                                                                        | empty                                                       |
| `listPasswordReset`   | `userName`\*                                                                                                  | `{ users: [{ type, target, description, allowMfaReset }] }` |

### Routing rules

| Operation           | Request fields                                                                               | Result                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `createRoutingRule` | `domainName`_, `prefix`_(bool), `matchUser`_, `targetAddresses`_(string[]), `catchall`=false | empty                                                                             |
| `deleteRoutingRule` | `routingRuleId`\* (int64, from list)                                                         | empty                                                                             |
| `listRoutingRules`  | —                                                                                            | `{ rules: [{ id, domainName, prefix, matchUser, targetAddresses[], catchall }] }` |

### Domains

| Operation              | Request fields                                                             | Result                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `addDomain`            | `domainName`\*                                                             | empty                                                                                                                                      |
| `getOwnershipCode`     | —                                                                          | `{ code }`                                                                                                                                 |
| `listDomains`          | `includeShared`=false                                                      | `{ domains: [{ name, allowAccountReset, symbolicSubaddressing, isShared, dnsSummary:{ passesMx, passesSpf, passesDkim, passesDmarc } }] }` |
| `updateDomainSettings` | `name`\*, `allowAccountReset`, `symbolicSubaddressing`, `recheckDns`=false | empty                                                                                                                                      |
| `deleteDomain`         | `name`\*                                                                   | empty                                                                                                                                      |

### App passwords

| Operation           | Request fields                                 | Result            |
| ------------------- | ---------------------------------------------- | ----------------- |
| `createAppPassword` | `userHandle`\* (full `user@domain`), `name`="" | `{ appPassword }` |
| `deleteAppPassword` | `userName`_, `appPassword`_                    | empty             |

### Account

| Operation            | Request fields | Result                |
| -------------------- | -------------- | --------------------- |
| `checkAccountCredit` | —              | `{ credit }` (string) |

`*` = required. Values shown as `name=default` carry that default (applied
client-side by the request schemas).

## Organization model (client-side)

PurelyMail has **no server-side organization concept** — one token authenticates
one account. This project layers an organization model on top: named account
**profiles**, each with its own token, optionally tagged `org`, aggregated across
accounts by `PurelymailWorkspace` / the CLI's `--org` / `--all` selectors.
