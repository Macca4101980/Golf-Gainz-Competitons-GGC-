import React,{useEffect,useState}from'react';
import{Bell,BellOff}from'lucide-react';
import{disablePushNotifications,enablePushNotifications,installedApp,preparePushNotifications,pushNotificationStatus,pushSupported}from'./pushNotifications.js';

export default function PushNotificationSettings({client}){
 const[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let alive=true;pushNotificationStatus(client).then(value=>{if(alive)setEnabled(value)}).catch(()=>{});preparePushNotifications(client).catch(()=>{});return()=>{alive=false}},[client]);
 if(!pushSupported())return <div className="pushSettings"><b>BACKGROUND NOTIFICATIONS</b><p className="muted">This device or browser does not support web push notifications.</p></div>;
 const toggle=async()=>{setBusy(true);setNotice('');try{if(enabled){await disablePushNotifications(client);setEnabled(false);setNotice('Background notifications switched off.')}else{await enablePushNotifications(client);setEnabled(true);setNotice('Background notifications enabled on this device.')}}catch(error){const code=String(error?.message||error);setNotice(code.includes('INSTALL_REQUIRED')?'Add GGC to your Home Screen first, then open the installed app and try again.':code.includes('PERMISSION_DENIED')?'Notifications were not allowed. Enable them for GGC in your phone settings and try again.':code.includes('TIMEOUT')?'Apple did not complete the notification connection. Close GGC fully, reopen it and try once more.':'Notifications could not be enabled. Please try again.')}finally{setBusy(false)}};
 return <div className="pushSettings"><b>BACKGROUND NOTIFICATIONS</b><p className="muted">Receive Group updates even while GGC is closed.</p>{!installedApp()&&<p className="pushNotice">Add GGC to your Home Screen before enabling notifications.</p>}<button className={enabled?'secondary':'primary'} disabled={busy||(!enabled&&!installedApp())} onClick={toggle}>{enabled?<BellOff/>:<Bell/>}{busy?'PLEASE WAIT…':enabled?'DISABLE NOTIFICATIONS':'ENABLE NOTIFICATIONS'}</button>{notice&&<p className="pushNotice" role="status">{notice}</p>}</div>;
}
