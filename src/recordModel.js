/** Translate the in-memory app state to independent versioned records.
 * Collections retain their existing IDs. Root-level editable state is split
 * into small appFields records so changing one setting never writes the rest
 * of the application state.
 */
export const APP_RECORD_KINDS=Object.freeze([
 'players','societies','comps','cards','leagues','courses','audit','societyInvites','appFields'
]);

const COLLECTIONS=APP_RECORD_KINDS.filter(kind=>kind!=='appFields');
const clone=value=>structuredClone(value);
const encode=parts=>parts.map(value=>encodeURIComponent(String(value))).join(':');

function rootFieldRecords(state,{userId,mayAdministerSociety=()=>false}={}){
 const fields=[];
 const push=(id,scope,value,extra={})=>fields.push({id,scope,...extra,value:clone(value)});
 const user=String(userId||'anonymous');
 if(Object.prototype.hasOwnProperty.call(state,'currentSocietyId'))push(encode(['user',user,'currentSocietyId']),'user',state.currentSocietyId,{userId:user,field:'currentSocietyId'});
 for(const [oldId,newId] of Object.entries(state.identityLinks||{}))push(encode(['user',user,'identityLink',oldId]),'user',newId,{userId:user,field:'identityLink',subjectId:String(oldId)});
 for(const [key,value] of Object.entries(state.settings||{}))push(encode(['user',user,'setting',key]),'user',value,{userId:user,field:'setting',subjectId:String(key)});
 for(const key of ['contacts','hiddenContacts']){
  for(const [playerId,value] of Object.entries(state[key]||{})){
   // Contacts are personal preferences, synced across the same account's devices.
   push(encode(['user',user,key,playerId]),'user',value,{userId:user,field:key,subjectId:String(playerId)});
  }
 }
 for(const [societyId,value] of Object.entries(state.oom||{})){
  if(!mayAdministerSociety(societyId))continue;
  for(const [key,setting] of Object.entries(value||{}))push(encode(['society',societyId,'oom',key]),'society',setting,{societyId:String(societyId),field:'oom',subjectId:String(key)});
 }
 return fields;
}

export function toRecordSnapshot(state,options={}){
 const snapshot={};
 for(const kind of COLLECTIONS)snapshot[kind]=Array.isArray(state?.[kind])?clone(state[kind]):[];
 snapshot.appFields=rootFieldRecords(state||{},options);
 // Tombstone IDs are control metadata used only while translating a local
 // deletion into the versioned row's deleted flag.
 for(const key of ['deletedCompIds','deletedSocietyIds','deletedCourseIds','deletedLeagueIds']){
  snapshot[key]=Array.isArray(state?.[key])?clone(state[key]):[];
 }
 return snapshot;
}

export function applyRecordSnapshot(base,records,{userId}={}){
 const next={...base};
 for(const kind of COLLECTIONS)next[kind]=clone(records?.[kind]||[]);
 const user=String(userId||'anonymous');
 const appFields=records?.appFields||[];
 const current=appFields.find(row=>row.scope==='user'&&row.userId===user&&row.field==='currentSocietyId');
 if(current)next.currentSocietyId=clone(current.value);
 const identityLinks={...(base?.identityLinks||{})};
 for(const item of appFields)if(item.scope==='user'&&item.userId===user&&item.field==='identityLink'&&item.subjectId!=null)identityLinks[item.subjectId]=clone(item.value);
 next.identityLinks=identityLinks;
 const settings={...(base?.settings||{})};
 for(const item of appFields)if(item.scope==='user'&&item.userId===user&&item.field==='setting'&&item.subjectId!=null)settings[item.subjectId]=clone(item.value);
 next.settings=settings;
 for(const key of ['contacts','hiddenContacts']){
  const values={...(base?.[key]||{})};
  for(const item of appFields){
   if(item.scope==='user'&&item.userId===user&&item.field===key&&item.subjectId!=null)values[item.subjectId]=clone(item.value);
  }
  next[key]=values;
 }
 const oom=clone(base?.oom||{});
 for(const item of appFields){if(item.scope==='society'&&item.field==='oom'&&item.societyId&&item.subjectId!=null){oom[item.societyId]??={};oom[item.societyId][item.subjectId]=clone(item.value)}}
 next.oom=oom;
 // Local deletion markers survive an interrupted write, but remote record
 // tombstones are authoritative after a confirmed write.
 for(const key of ['deletedCompIds','deletedSocietyIds','deletedCourseIds','deletedLeagueIds']){
  next[key]=Array.isArray(base?.[key])?clone(base[key]):[];
 }
 return next;
}

export function mergeRecordSnapshotIntoAppState(base,records,options={}){
 const next=applyRecordSnapshot(base,records,options);
 // Keep the local active group when it is still present; otherwise pick the
 // user's first available group or the normal seed default.
 if(!(next.societies||[]).some(item=>item.id===next.currentSocietyId)){
  next.currentSocietyId=next.societies?.[0]?.id||'default-society';
 }
 return next;
}
