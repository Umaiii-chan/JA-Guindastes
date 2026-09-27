// Cliente REST de `/api/v1/auth` (TASK-040; ADR-016 § 4, contrato real da TASK-038):
// - `GET  /auth/session` → 200 `{authEnabled, user | null}`;
// - `POST /auth/login` `{username, password}` → 200 `{user}` + cookie HttpOnly;
//   401 `INVALID_CREDENTIALS`; 429 `TOO_MANY_ATTEMPTS`;
// - `POST /auth/logout` → 204.

import type { AuthGateway } from '../../application/auth/ports'
import { readNullableRecord, readRecord } from '../shared/readJson'
import {
  type AuthHttpOptions,
  createSendJson,
  guardContract,
  mapUser,
  readBoolean,
} from './authHttp'

export const AUTH_PATH = '/api/v1/auth'

export function createAuthRestClient(options: AuthHttpOptions = {}): AuthGateway {
  const send = createSendJson(options)

  return {
    async getSession() {
      const { json } = await send('GET', `${AUTH_PATH}/session`)
      return guardContract(() => {
        const body = readRecord(json, 'response')
        const user = readNullableRecord(body, 'user', 'response')
        return {
          authEnabled: readBoolean(body, 'authEnabled', 'response'),
          user: user && mapUser(user, 'response.user'),
        }
      })
    },

    async login(username, password) {
      const { json } = await send('POST', `${AUTH_PATH}/login`, { username, password })
      return guardContract(() => mapUser(readRecord(json, 'response').user, 'response.user'))
    },

    async logout() {
      await send('POST', `${AUTH_PATH}/logout`)
    },
  }
}
