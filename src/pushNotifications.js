export const pushSupported=()=>typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
export const installedApp=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const decode=value=>{const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))};

export async function currentPushSubscription(){if(!pushSupported())return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager.getSubscription()}
export async function enablePushNotifications(client){
 if(!installedApp())throw Error('GGC_INSTALL_REQUIRED');
 if(!pushSupported())throw Error('GGC_PUSH_UNSUPPORTED');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('GGC_PUSH_PERMISSION_DENIED');
 const{data:key,error:keyError}=await client.rpc('ggc_push_public_key');if(keyError||!key)throw keyError||Error('GGC_PUSH_KEY_MISSING');
 const registration=await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(key)});
 const{error}=await client.rpc('ggc_register_push_subscription',{p_subscription:subscription.toJSON(),p_user_agent:navigator.userAgent});if(error)throw error;
 await flushPushNotifications(client);return subscription;
}
export async function disablePushNotifications(client){
 const subscription=await currentPushSubscription();if(!subscription)return;
 await client.rpc('ggc_unregister_push_subscription',{p_endpoint:subscription.endpoint});await subscription.unsubscribe();
}
export async function flushPushNotifications(client){try{await client?.functions.invoke('ggc-push',{body:{flush:true}})}catch{}}
