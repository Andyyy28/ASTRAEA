import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProvisioningOptions, provisionAdmin } from '../../scripts/adminProvisioning.js';

const id = '11111111-1111-4111-8111-111111111111';
const env = { VITE_SUPABASE_URL: 'https://project.example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-value' };
function fixture({ verified = true, preflightError = null, createError = null } = {}) {
  const actions = [];
  return {
    actions,
    from() {
      return {
        select: () => ({ limit: async () => ({ error: preflightError }) }),
        upsert: async payload => { actions.push(['enroll', payload]); return { error: null }; },
      };
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user: { id, email_confirmed_at: verified ? '2026-01-01' : null } }, error: null }),
      createUser: async payload => { actions.push(['create', payload]); return { data: { user: { id } }, error: createError }; },
      updateUserById() { assert.fail('Existing accounts must never be changed'); },
    } },
  };
}
test('requires explicit target; no defaults or reset flags', () => {
  for (const args of [[], ['--reset-password'], ['--user-id', 'bad'], ['--create', '--user-id', id]]) assert.throws(() => parseProvisioningOptions(args, env));
  assert.equal(parseProvisioningOptions(['--user-id', id], env).userId, id);
  assert.throws(() => parseProvisioningOptions(['--create'], { ...env, ADMIN_EMAIL: 'x@example.test', ADMIN_PASSWORD: 'short' }));
  assert.throws(() => parseProvisioningOptions(['--user-id', id], { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }));
});
test('enrollment changes only verified membership, never credentials', async () => {
  const client = fixture(); const result = await provisionAdmin(client, { userId: id });
  assert.equal(result.enrolled, true); assert.deepEqual(client.actions, [['enroll', { user_id: id }]]);
});
test('unverified email is denied without mutation', async () => {
  const client = fixture({ verified: false }); await assert.rejects(provisionAdmin(client, { userId: id })); assert.deepEqual(client.actions, []);
});
test('database preflight failure prevents account creation', async () => {
  const client = fixture({ preflightError: { code: '42501' } }); await assert.rejects(provisionAdmin(client, { create: true })); assert.deepEqual(client.actions, []);
});
test('explicit creation does not confirm email or enroll automatically', async () => {
  const client = fixture(); const result = await provisionAdmin(client, { create: true, email: 'new@example.test', password: 'unique-test-secret-value' });
  assert.equal(result.enrolled, false); assert.equal(result.requiresVerification, true); assert.equal(client.actions.length, 1); assert.equal(client.actions[0][1].email_confirm, false);
});
