// Cliente REST de `/api/v1/users` (TASK-040; ADR-016 § 4, contrato real da TASK-038), só ADMIN:
// - `GET   /users` → 200 `{items: User[]}`;
// - `POST  /users` `{username, displayName, password, role}` → 201 `User`; 409 `USERNAME_TAKEN`; 422;
// - `PATCH /users/{id}` `{displayName?, role?, active?, password?}` → 200 `User`;
//   404 `USER_NOT_FOUND`; 409 `LAST_ADMIN` | `OWN_ADMIN_ACCESS`; 422.
// O 422 segue o formato do FastAPI, com `loc` em camelCase (`["body", "displayName"]`).

import type { UsersGateway } from '../../application/auth/ports'
import { readArray, readRecord } from '../shared/readJson'
import { type AuthHttpOptions, createSendJson, guardContract, mapUser } from './authHttp'

export const USERS_PATH = '/api/v1/users'

export function createUsersRestClient(options: AuthHttpOptions = {}): UsersGateway {
  const send = createSendJson(options)

  return {
    async list() {
      const { json } = await send('GET', USERS_PATH)
      return guardContract(() =>
        readArray(readRecord(json, 'response'), 'items', 'response').map((item, index) =>
          mapUser(item, `response.items[${index}]`),
        ),
      )
    },

    async create(user) {
      const { json } = await send('POST', USERS_PATH, user)
      return guardContract(() => mapUser(json, 'response'))
    },

    async update(id, changes) {
      const { json } = await send('PATCH', `${USERS_PATH}/${encodeURIComponent(id)}`, changes)
      return guardContract(() => mapUser(json, 'response'))
    },
  }
}
