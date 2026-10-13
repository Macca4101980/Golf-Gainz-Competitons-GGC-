import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroupMembershipApi} from '../src/groupMembershipApi.js';
test('join uses authoritative RPC, never local group code search',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true,group_id:'g1'},error:null}}};
 const api=createGroupMembershipApi(db);
 assert.equal((await api.joinCode('  GGC-ABCD  ')).group_id,'g1');
 assert.deepEqual(calls,[{name:'ggc_group_join_code',args:{p_code:'GGC-ABCD'}}]);
});
test('invite failures are not displayed as successes',async()=>{
 const api=createGroupMembershipApi({rpc:async()=>({data:null,error:{message:'GGC_GROUP_INVITE_FORBIDDEN'}})});
 await assert.rejects(api.invite('g1','p2'),/GGC_GROUP_INVITE_FORBIDDEN/);
});
test('pending invitations come from server',async()=>{
 const api=createGroupMembershipApi({rpc:async()=>({data:[{id:'i1',group_id:'g1'}],error:null})});
 assert.deepEqual(await api.pending(),[{id:'i1',group_id:'g1'}]);
});
test('acceptance calls transactional server function',async()=>{
 const api=createGroupMembershipApi({rpc:async(name,args)=>({data:{ok:true,accepted:args.p_accept},error:null})});
 assert.equal((await api.respond('i1',true)).accepted,true);
});
test('join not found is reported instead of pretending success',async()=>{
 const api=createGroupMembershipApi({rpc:async()=>({data:{ok:false,reason:'code_not_found'},error:null})});
 await assert.rejects(api.joinCode('invalid'),/GGC_GROUP_CODE_NOT_FOUND/);
});
