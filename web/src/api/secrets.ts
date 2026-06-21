import { request } from './client';

// Secrets API client — /v1/secrets/* (HLD-017 generic secret vault).
// Backend: internal/manager/server/secret/http.go. Values are write-only:
// the list never returns the secret material, only `has_value`.

export interface SecretView {
  id: number;
  name: string;
  description: string;
  has_value: boolean;
  created_at: string;
  updated_at: string;
}

export function listSecrets() {
  return request<{ items: SecretView[] }>('GET', '/secrets');
}

export function createSecret(input: { name: string; value: string; description?: string }) {
  return request<SecretView>('POST', '/secrets', input);
}

// Update value (blank = keep existing) and/or description.
export function updateSecret(id: number, input: { value?: string; description?: string }) {
  return request<{ ok: boolean }>('PUT', `/secrets/${id}`, input);
}

export function deleteSecret(id: number) {
  return request<{ ok: boolean }>('DELETE', `/secrets/${id}`);
}
