export const pushSupported=()=>typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
export const installedApp=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const decode=value=>{const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))};
const timeout=(promise,milliseconds,code)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(code)),milliseconds);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},reason=>{clearTimeout(timer);reject(reason)})});
async function pushRegistration(){if(!pushSupported())throw Error('GGC_PUSH_UNSUPPORTED');let registration=await timeout(navigator.serviceWorker.getRegistration(),5000,'GGC_PUSH_SERVICE_WORKER_TIMEOUT');if(!registration)registration=await timeout(navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}),10000,'GGC_PUSH_SERVICE_WORKER_TIMEOUT');if(registration.active)return registration;return timeout(navigator.serviceWorker.ready,12000,'GGC_PUSH_SERVICE_WORKER_TIMEOUT')}
let preparedPush=null,preparePromise=null;
export async function preparePushNotifications(client){
 if(preparedPush)return preparedPush;
 if(!client||!pushSupported())throw Error('GGC_PUSH_UNSUPPORTED');
 if(!preparePromise)preparePromise=Promise.all([pushRegistration(),timeout(client.rpc('ggc_push_public_key'),8000,'GGC_PUSH_SERVER_TIMEOUT')]).then(async([registration,keyResult])=>{const{data:key,error}=keyResult;if(error||!key)throw error||Error('GGC_PUSH_KEY_MISSING');const subscription=await timeout(registration.pushManager.getSubscription(),8000,'GGC_PUSH_SUBSCRIPTION_TIMEOUT');preparedPush={registration,key,subscription};return preparedPush}).catch(error=>{preparePromise=null;throw error});
 return preparePromise;
}

export async function currentPushSubscription(){if(!pushSupported())return null;const registration=await pushRegistration();return timeout(registration.pushManager.getSubscription(),8000,'GGC_PUSH_SUBSCRIPTION_TIMEOUT')}
export async function pushNotificationStatus(client){const subscription=await currentPushSubscription();if(!subscription||!client)return false;const{data,error}=await timeout(client.rpc('ggc_push_subscription_status'),8000,'GGC_PUSH_SERVER_TIMEOUT');if(error)throw error;return Number(data)>0}
export async function enablePushNotifications(client){
 if(!installedApp())throw Error('GGC_INSTALL_REQUIRED');
 if(!pushSupported())throw Error('GGC_PUSH_UNSUPPORTED');
 const prepared=preparedPush;if(!prepared)throw Error('GGC_PUSH_NOT_READY');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted')throw Error('GGC_PUSH_PERMISSION_DENIED');
 let subscription=prepared.subscription;
 if(!subscription)subscription=await timeout(prepared.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(prepared.key)}),20000,'GGC_PUSH_SUBSCRIPTION_TIMEOUT');
 prepared.subscription=subscription;
 const{error}=await timeout(client.rpc('ggc_register_push_subscription',{p_subscription:subscription.toJSON(),p_user_agent:navigator.userAgent}),10000,'GGC_PUSH_SERVER_TIMEOUT');if(error)throw error;
 void flushPushNotifications(client);return subscription;
}
export async function disablePushNotifications(client){
 const subscription=await currentPushSubscription();if(!subscription)return;
 const{error}=await timeout(client.rpc('ggc_unregister_push_subscription',{p_endpoint:subscription.endpoint}),10000,'GGC_PUSH_SERVER_TIMEOUT');if(error)throw error;await timeout(subscription.unsubscribe(),8000,'GGC_PUSH_SUBSCRIPTION_TIMEOUT');if(preparedPush)preparedPush.subscription=null;
}
export async function flushPushNotifications(client){try{await client?.functions.invoke('ggc-push',{body:{flush:true}})}catch{}}
