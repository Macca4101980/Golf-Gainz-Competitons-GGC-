// The launcher badge is a reminder to open GGC, not a copy of the unread feed.
export async function clearLauncherBadge(nav=globalThis.navigator){
 if(!nav)return;
 try{if(nav.clearAppBadge)await nav.clearAppBadge();else if(nav.setAppBadge)await nav.setAppBadge(0)}catch{}
 // Android launchers may derive their dot from outstanding system notifications.
 try{const registration=await nav.serviceWorker?.getRegistration();const notifications=await registration?.getNotifications();for(const notification of notifications||[])notification.close()}catch{}
}
export function swipeRevealsDelete(dx,dy){return dx<=-55&&Math.abs(dx)>Math.abs(dy)*1.5}
