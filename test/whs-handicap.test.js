import test from'node:test';
import assert from'node:assert/strict';
import{createClientToken,normaliseVisitor,validateMembershipNumber}from'../api/whs-handicap.js';

test('England Golf membership numbers must contain exactly ten digits',()=>{
 assert.equal(validateMembershipNumber('10 1234 5678'),'1012345678');
 assert.throws(()=>validateMembershipNumber('12345'),/10-digit/);
 assert.throws(()=>validateMembershipNumber('abcdefghij'),/10-digit/);
});

test('WHS client token contains only the required read-only authentication claims',()=>{
 const token=createClientToken('ggc-client','secret',123456);
 const[header,payload]=token.split('.').slice(0,2).map(value=>JSON.parse(Buffer.from(value,'base64url').toString()));
 assert.deepEqual(header,{alg:'HS256',typ:'JWT'});
 assert.deepEqual(payload,{aud:'isv-api',iss:'ggc-client',iat:123456});
});

test('visitor response is reduced to the minimum handicap details GGC needs',()=>{
 const result=normaliseVisitor({firstName:'Alex',lastName:'Golfer',handicap:{handicapIndex:7.4},homeClub:{name:'Example Golf Club'},lastScoreDateUTC:'2026-11-20T00:00:00Z'},'1012345678');
 assert.deepEqual(result,{membershipNumberLast4:'5678',displayName:'Alex Golfer',homeClub:'Example Golf Club',handicapIndex:7.4,lastScoreAt:'2026-11-20T00:00:00Z',retrievedAt:result.retrievedAt,source:'England Golf WHS'});
 assert.equal('email'in result,false);
 assert.equal('membershipNumber'in result,false);
});
