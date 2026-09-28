import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { estimateOrder } from '../src/lib/preparation.js';

test('database migrations, scheduling, authorization and stock transactions', async () => {
  const db = new PGlite();
  try {
    // Local PostgreSQL engine with Supabase platform tables/auth stubbed.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage, auth TO anon, authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;`);
    await db.exec(await readFile('supabase/schema.sql', 'utf8'));
    for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
      // PGlite has gen_random_uuid built in, but does not package pgcrypto.
      const sql = (await readFile(`supabase/migrations/${name}`, 'utf8')).replaceAll('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
      try { await db.exec(sql); } catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }); }
    }
    const admin = '11111111-1111-4111-8111-111111111111';
    await db.exec(`INSERT INTO auth.users VALUES ('${admin}', 'test@example.test'); INSERT INTO public.admin_users(user_id) VALUES ('${admin}');`);
    const { rows: [bouquet] } = await db.query("INSERT INTO bouquets(name, price, stock) VALUES ('Test', 100, 5) RETURNING id");
    const order = { customer_name: 'Test', contact_number: '09123456789', facebook_account: 'test', payment_method: 'cash', delivery_method: 'pickup', preferred_date: '2099-01-01', preferred_time: '10:00' };
    const items = [{ item_type: 'bouquet', bouquet_id: bouquet.id, quantity: 2 }];
    const place = async (o = order, i = items) => (await db.query('SELECT place_order($1::jsonb, $2::jsonb) AS result', [JSON.stringify(o), JSON.stringify(i)])).rows[0].result;
    await db.exec('SET ROLE anon');
    await assert.rejects(place({ ...order, preferred_date: '2020-01-01' }), /too soon/);
    await assert.rejects(place({ ...order, delivery_method: 'delivery' }), /address/);
    await assert.rejects(db.query('SELECT reserve_bouquet_stock($1, 1)', [bouquet.id]), /permission denied/);
    await assert.rejects(db.query('SELECT release_bouquet_stock($1, 1)', [bouquet.id]), /permission denied/);
    const placed = await place();
    assert.equal(placed.preparation_minutes, 30);
    await assert.rejects(place(order, [{ ...items[0], quantity: 4 }]), /stock/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT stock FROM bouquets WHERE id=$1', [bouquet.id])).rows[0].stock, 3);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query("SELECT confirm_order_timing($1, '2099-01-01T11:00:00+08:00', '')", [placed.id]), /Not authorized/);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await db.query("SELECT confirm_order_timing($1, '2099-01-01T11:00:00+08:00', 'Confirmed after review')", [placed.id]);
    await db.exec('RESET ROLE; SET ROLE anon');
    const tracked = (await db.query('SELECT track_order($1,$2) AS result', [placed.reference_number, order.contact_number])).rows[0].result;
    assert.equal(tracked.order.timing_note, 'Confirmed after review');
    assert.ok(tracked.order.confirmed_ready_at);
    assert.equal((await db.query('SELECT track_order($1,$2) AS result', [placed.reference_number, 'wrong'])).rows[0].result, null);
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await db.query("SELECT update_order_status($1, 'cancelled')", [placed.id]);
    await db.query("SELECT update_order_status($1, 'cancelled')", [placed.id]);
    await assert.rejects(db.query("SELECT update_order_status($1, 'pending')", [placed.id]), /cannot be reopened/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT stock FROM bouquets WHERE id=$1', [bouquet.id])).rows[0].stock, 5);
    const design = { item_type: 'custom', quantity: 2, size: 'large', flowers: [{ quantity: 12 }, { quantity: 3 }], fillers: [{ quantity: 2 }], addons: { ribbon: true }, wrapper: {}, instructions: 'Special shape' };
    const minutes = (await db.query('SELECT estimate_preparation_minutes($1::jsonb) AS minutes', [JSON.stringify([design])])).rows[0].minutes;
    assert.equal(minutes, estimateOrder([design]));
    const flower = (await db.query("INSERT INTO flowers(name,price_per_stem,stock) VALUES ('Test flower',10,20) RETURNING id")).rows[0];
    const filler = (await db.query("INSERT INTO fillers(name,price,stock) VALUES ('Test filler',5,20) RETURNING id")).rows[0];
    const custom = { item_type: 'custom', quantity: 2, size: 'medium', flowers: [{ id: flower.id, quantity: 3 }], fillers: [{ id: filler.id, quantity: 4 }], addons: {}, instructions: 'Keep asymmetrical' };
    const customOrder = await place(order, [custom]);
    assert.equal((await db.query('SELECT stock FROM fillers WHERE id=$1', [filler.id])).rows[0].stock, 12);
    assert.equal((await db.query('SELECT instructions FROM order_items WHERE order_id=$1', [customOrder.id])).rows[0].instructions, 'Keep asymmetrical');
    await db.query("SELECT update_order_status($1, 'cancelled')", [customOrder.id]);
    assert.equal((await db.query('SELECT stock FROM fillers WHERE id=$1', [filler.id])).rows[0].stock, 20);
    await assert.rejects(place(order, [items[0], { ...custom, quantity: 20 }]), /stock/);
    assert.equal((await db.query('SELECT stock FROM bouquets WHERE id=$1', [bouquet.id])).rows[0].stock, 5, 'failed mixed order rolls back stock deductions');
    assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='payment-proofs'")).rows[0].public, false);
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('bouquets','unauthorized.jpg')"), /row-level security/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('payment-proofs','22222222-2222-4222-8222-222222222222.jpg')");
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='payment-proofs'")).rows.length, 0);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('payment-proofs','wrong.svg')"), /row-level security/);
  } finally { await db.close(); }
});
