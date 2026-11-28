import{flushPushNotifications}from'./pushNotifications.js';

export const roundStartAudience=group=>group?.roundStartNotificationAudience==='group'?'group':'admins';

export async function publishRoundStarted(client,{competitionId,roundGroupId}){
 if(!client||!competitionId||!roundGroupId)return false;
 const{error}=await client.rpc('ggc_publish_round_started_update',{p_comp_id:competitionId,p_round_group_id:roundGroupId});
 if(error)throw error;
 void flushPushNotifications(client);
 return true;
}
