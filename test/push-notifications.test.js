import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const client=readFileSync(new URL('../src/pushNotifications.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../src/PushNotificationSettings.jsx',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8'),sql=readFileSync(new URL('../supabase/migrations/20261122215348_web_push_notifications.sql',import.meta.url),'utf8'),fix=readFileSync(new URL('../supabase/migrations/20261123145000_fix_push_delivery_claim_ambiguity.sql',import.meta.url),'utf8'),edge=readFileSync(new URL('../supabase/functions/ggc-push/index.ts',import.meta.url),'utf8');

test('installed users can opt into and out of standards-based Web Push',()=>{
 assert.match(client,/display-mode: standalone/);assert.match(client,/Notification\.requestPermission/);assert.match(client,/pushManager\.subscribe/);assert.match(client,/ggc_register_push_subscription/);assert.match(client,/ggc_unregister_push_subscription/);assert.match(client,/serviceWorker\.register/);assert.match(client,/GGC_PUSH_SERVICE_WORKER_TIMEOUT/);assert.match(client,/ggc_push_subscription_status/);assert.match(ui,/ENABLE NOTIFICATIONS/);
});
test('service worker displays pushes and opens Updates when tapped',()=>{assert.match(sw,/addEventListener\('push'/);assert.match(sw,/showNotification/);assert.match(sw,/addEventListener\('notificationclick'/);assert.match(sw,/clients\.openWindow/);});
test('push subscriptions are private and delivery is audience filtered',()=>{
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public\.ggc_push_subscriptions from public,anon,authenticated/);assert.match(sql,/u\.audience='member'/);assert.match(sql,/u\.audience='admins'/);assert.match(sql,/u\.audience='group'/);assert.match(sql,/grant execute on function public\.ggc_push_server_config\(\).*to service_role/s);
});
test('push sender keeps VAPID private key server-side and expires dead devices',()=>{assert.match(edge,/ggc_push_server_config/);assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(edge,/status===404\|\|status===410/);assert.doesNotMatch(client,/privateKey|private_key/);});
test('push delivery queue uses an unambiguous uniqueness constraint',()=>{assert.match(fix,/on conflict on constraint ggc_push_deliveries_update_id_subscription_id_key/);});
test('iOS push preparation is attempted early but never blocks the enable tap',()=>{
 assert.match(ui,/preparePushNotifications\(client\)/);
 assert.match(ui,/disabled=\{busy\|\|\(!enabled&&!installedApp\(\)\)\}/);
 assert.doesNotMatch(ui,/PREPARING/);
 const enable=client.slice(client.indexOf('export async function enablePushNotifications'),client.indexOf('export async function disablePushNotifications'));
 assert.match(enable,/const prepared=preparedPush\|\|await preparePushNotifications\(client\)/);
 assert.ok(enable.indexOf('pushManager.subscribe')<enable.indexOf('ggc_register_push_subscription'));
 assert.doesNotMatch(enable,/ggc_push_public_key/);
});
test('iOS preparation never asks PushManager for a subscription before the tap',()=>{const prepare=client.slice(client.indexOf('export async function preparePushNotifications'),client.indexOf('export async function currentPushSubscription'));assert.doesNotMatch(prepare,/getSubscription/);assert.match(prepare,/preparedPush=\{registration,key,subscription:null\}/);assert.doesNotMatch(ui,/Promise\.all\(\[pushNotificationStatus/);});
