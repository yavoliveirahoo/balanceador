/* Balanceador - service worker.
   Troque o número de CACHE quando publicar uma versão nova do app. */
const CACHE = 'balanceador-v17';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* Rede primeiro (pega versão nova quando online), cache como reserva (funciona offline). */
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET' || new URL(e.request.url).origin!==location.origin) return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const copia=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copia)); return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});

/* Lembrete de conferir saldos (melhor esforço: o Android decide quando roda). */
function lerLembrete(){
  return new Promise(res=>{
    const r=indexedDB.open('balanceador-lembrete',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('k');
    r.onerror=()=>res(null);
    r.onsuccess=()=>{ const g=r.result.transaction('k').objectStore('k').get('lembrete'); g.onsuccess=()=>res(g.result||null); g.onerror=()=>res(null); };
  });
}
self.addEventListener('periodicsync', e=>{
  if(e.tag!=='conferir-saldos') return;
  e.waitUntil((async()=>{
    const l=await lerLembrete(); if(!l||!l.ativo||!l.ultima) return;
    const dias=Math.floor((Date.now()-new Date(l.ultima+'T12:00:00').getTime())/864e5);
    if(dias>=l.dias) await self.registration.showNotification('Balanceador',{
      body:'Faz '+dias+' dias que você não confere os saldos. Dá uma olhada nas duas contas?',
      tag:'conferir-saldos', icon:'icon-192.png'
    });
  })());
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow('./')));
});
