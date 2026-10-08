import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
const uid='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(48);
try {
 await client.query(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 for(const file of ['20261008_v4_membership_foundation.sql','20261008_v4_claim_guard.sql','20261008_v4_verified_claim.sql']) {
  await client.query(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 }
 await client.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[uid,'james@example.com',other,'other@example.com']);
 await client.query(`insert into public.ggc_golfers(id,display_name,auth_user_id,placeholder) values('old','James',null,true),('real','James',$1,false),('other','Other',$2,false)`,[uid,other]);
 await client.query(`insert into public.ggc_groups(id,name) values('wl25','Winter League 25/26'),('wl26','Winter League 26/27')`);
 await client.query(`insert into public.ggc_memberships(group_id,golfer_id,role,status) values('wl25','old','member','member'),('wl26','old','admin','member')`);
 await client.query(`insert into public.ggc_claim_invites(placeholder_id,token_digest,intended_email,expires_at) values('old',encode(digest($1,'sha256'),'hex'),'james@example.com',now()+interval '1 day')`,[token]);
 await client.query('begin');
 await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);
 await assert.rejects(client.query('select public.ggc_claim_golfer($1,$2)',['old','b'.repeat(48)]),/Invalid claim token/);
 await client.query('rollback');
 await client.query('begin');
 await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);
 const result=await client.query('select public.ggc_claim_golfer($1,$2) as id',['old',token]);
 assert.equal(result.rows[0].id,'real');
 await client.query('commit');
 const members=await client.query(`select group_id,role from public.ggc_memberships where golfer_id='real' order by group_id`);
 assert.deepEqual(members.rows,[{group_id:'wl25',role:'member'},{group_id:'wl26',role:'admin'}]);
 const old=await client.query(`select count(*)::int n from public.ggc_memberships where golfer_id='old'`);
 assert.equal(old.rows[0].n,2);
 await client.query('begin');
 await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[uid]);
 const retry=await client.query('select public.ggc_claim_golfer($1,$2) as id',['old',token]);
 assert.equal(retry.rows[0].id,'real');
 await client.query('commit');
 await client.query('begin');
 await client.query(`select set_config('request.jwt.claim.sub',$1,true)`,[other]);
 await assert.rejects(client.query('select public.ggc_claim_golfer($1,$2)',['old',token]),/Claim already used/);
 await client.query('rollback');
 console.log('PASS: PostgreSQL schema, token rejection, two-group claim, role preservation, historical identity, idempotent retry, competing account');
} finally {await client.end()}
