import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  validateAgeCredential,
  validateMembershipCredential,
} from './credentials';
import type { CredentialJSON } from './types';

function makeBaseCredential(): CredentialJSON {
  return {
    subject_id: '0x1',
    issuer_id: '0x2',
    credential_type: '0x0',
    attribute_key: '0x1',
    attribute_value: '0x19',
    issued_at: '0x1',
    expires_at: '0x2',
    secret_salt: '0x3',
    signature: new Array(64).fill(0),
    issuer_pub_key_x: '0x2',
    issuer_pub_key_y: '0x4',
  };
}

describe('credential validation', () => {
  test('accepts valid age credential', () => {
    const credential = makeBaseCredential();
    const result = validateAgeCredential(credential);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('rejects missing signature', () => {
    const credential = makeBaseCredential() as unknown as Record<string, unknown>;
    delete credential.signature;

    const result = validateAgeCredential(credential as unknown as CredentialJSON);
    assert.equal(result.valid, false);
    assert.equal(
      result.errors.some((error) => error.includes('Signature is required')),
      true,
    );
  });

  test('rejects malformed signature type', () => {
    const credential = makeBaseCredential() as unknown as Record<string, unknown>;
    credential.signature = '0x1234';

    const result = validateAgeCredential(credential as unknown as CredentialJSON);
    assert.equal(result.valid, false);
    assert.equal(
      result.errors.some((error) => error.includes('Signature must be an array')),
      true,
    );
  });

  test('rejects invalid membership semantics', () => {
    const credential = makeBaseCredential();
    credential.credential_type = '0x1';
    credential.attribute_key = '0x1';

    const result = validateMembershipCredential(credential);
    assert.equal(result.valid, false);
    assert.equal(
      result.errors.some((error) =>
        error.includes('Expected attribute_key 2 (membership)'),
      ),
      true,
    );
  });
});
