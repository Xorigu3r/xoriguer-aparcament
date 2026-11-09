/* Xoriguer Aparcament — on he aparcat el cotxe? */
'use strict';

const CLAU_COTXE = 'xa.cotxe';
const CLAU_HIST = 'xa.historial';
const MAX_HIST = 15;
const AVIS_MIN = 10; // minuts d'avís abans que s'acabi el tiquet

const $ = (id) => document.getElementById(id);
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- Emmagatzematge ---------- */
function llegeix(clau, perDefecte) {
  try { const v = localStorage.getItem(clau); return v ? JSON.parse(v) : perDefecte; }
  catch { return perDefecte; }
}
function desa(clau, valor) {
  try { localStorage.setItem(clau, JSON.stringify(valor)); return true; }
  catch (e) { toast('No s\'ha pogut desar (memòria plena?)'); return false; }
}
let cotxe = llegeix(CLAU_COTXE, null);
const desaCotxe = () => cotxe ? desa(CLAU_COTXE, cotxe) : localStorage.removeItem(CLAU_COTXE);

/* ---------- Utilitats ---------- */
function toast(text, ms = 3500) {
  const t = document.createElement('div');
  t.className = 'avis-toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const hora = (t) => new Date(t).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
const dataHora = (t) => new Date(t).toLocaleString('ca', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function distancia(a, b) { // metres (haversine)
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function rumb(a, b) { // graus des del nord
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
const PUNTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const cardinal = (g) => PUNTS[Math.round(g / 45) % 8];
const fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

function enllacNavegar(p) {
  return esIOS
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
}
const enllacMapa = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/* ---------- GPS ---------- */
// Recull lectures durant uns segons i es queda amb la més precisa.
function posicioPrecisa(ms = 8000, objectiu = 12, onProgress) {
  return new Promise((resol, rebutja) => {
    if (!('geolocation' in navigator)) return rebutja(new Error('Aquest navegador no té GPS.'));
    let millor = null;
    const acaba = () => { navigator.geolocation.clearWatch(id); clearTimeout(tm); millor ? resol(millor) : rebutja(new Error('No s\'ha obtingut senyal GPS.')); };
    const id = navigator.geolocation.watchPosition((pos) => {
      const c = pos.coords;
      if (!millor || c.accuracy < millor.acc) millor = { lat: c.latitude, lng: c.longitude, acc: c.accuracy };
      onProgress && onProgress(millor);
      if (millor.acc <= objectiu) acaba();
    }, (err) => {
      if (millor) return acaba();
      navigator.geolocation.clearWatch(id); clearTimeout(tm);
      const msg = { 1: 'Cal donar permís d\'ubicació a l\'app.', 2: 'Ubicació no disponible.', 3: 'El GPS ha trigat massa.' }[err.code] || err.message;
      rebutja(new Error(msg));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: ms });
    const tm = setTimeout(acaba, ms);
  });
}

/* ---------- Aparcar ---------- */
$('btn-aparcar').addEventListener('click', async () => {
  const btn = $('btn-aparcar'), estat = $('estat-gps');
  btn.disabled = true;
  estat.textContent = 'Buscant senyal GPS…';
  try {
    const p = await posicioPrecisa(8000, 12, (m) => { estat.textContent = `Afinant posició… ±${Math.round(m.acc)} m`; });
    cotxe = { lat: p.lat, lng: p.lng, acc: p.acc, t: Date.now(), nota: '', foto: null, pq: null };
    desaCotxe();
    if (navigator.vibrate) navigator.vibrate(80);
    estat.textContent = '';
    mostra();
    toast('🅿 Posició guardada!');
  } catch (e) {
    estat.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Mapa ---------- */
let mapa, marcaCotxe, marcaJo, cercleCotxe, vigilant = null, jo = null, primerEncaix = true;

const SVG_COTXE = `<svg viewBox="0 0 48 60" width="48" height="60" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 58C24 58 4 37 4 22a20 20 0 0 1 40 0c0 15-20 36-20 36z" fill="#F2650F" stroke="#F6EFE2" stroke-width="3"/>
  <g transform="translate(2.6 -14.4) scale(.095)">
    <path d="M70 418L70 392Q72 374 94 370L132 364L178 330Q190 322 206 322L278 322Q296 322 308 334L340 364L356 367Q378 372 380 394L380 418Z" fill="#F6EFE2"/>
    <path d="M180 360L202 336Q206 332 214 332L250 332L250 360ZM260 332L280 332Q290 332 298 340L320 360L260 360Z" fill="#F2650F"/>
    <circle cx="128" cy="418" r="30" fill="#0A0B0E"/><circle cx="318" cy="418" r="30" fill="#0A0B0E"/>
  </g></svg>`;

function iniciaMapa() {
  if (mapa) return;
  mapa = L.map('mapa', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);

  marcaCotxe = L.marker([cotxe.lat, cotxe.lng], {
    draggable: true, zIndexOffset: 1000,
    icon: L.divIcon({ className: 'marcador-cotxe', html: SVG_COTXE, iconSize: [48, 60], iconAnchor: [24, 58] })
  }).addTo(mapa).bindTooltip('Arrossega per corregir', { direction: 'top', offset: [0, -56] });
  marcaCotxe.on('dragend', () => {
    const ll = marcaCotxe.getLatLng();
    cotxe.lat = ll.lat; cotxe.lng = ll.lng; cotxe.acc = 0;
    desaCotxe(); actualitzaCotxe(); toast('Posició corregida');
  });
  cercleCotxe = L.circle([cotxe.lat, cotxe.lng], { radius: cotxe.acc || 0, color: '#FFA82E', weight: 1, fillOpacity: .12 }).addTo(mapa);
  mapa.setView([cotxe.lat, cotxe.lng], 18);
}

function actualitzaCotxe() {
  marcaCotxe.setLatLng([cotxe.lat, cotxe.lng]);
  cercleCotxe.setLatLng([cotxe.lat, cotxe.lng]).setRadius(cotxe.acc || 0);
  $('btn-navegar').href = enllacNavegar(cotxe);
  $('hora-aparcat').textContent = hora(cotxe.t);
  $('precisio').textContent = cotxe.acc ? `Precisió en guardar: ±${Math.round(cotxe.acc)} m` : 'Posició ajustada a mà';
  actualitzaDistancia();
}

function actualitzaDistancia() {
  if (!jo || !cotxe) return;
  const d = distancia(jo, cotxe), g = rumb(jo, cotxe);
  $('distancia').textContent = d < 8 ? 'Hi ets!' : fmtDist(d);
  $('rumb').textContent = cardinal(g);
  $('fletxa').style.transform = `rotate(${g}deg)`;
}

function vigilaPosicio() {
  if (vigilant !== null || !('geolocation' in navigator)) return;
  vigilant = navigator.geolocation.watchPosition((pos) => {
    jo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (!marcaJo) {
      marcaJo = L.marker([jo.lat, jo.lng], {
        icon: L.divIcon({ className: 'marcador-jo', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] })
      }).addTo(mapa);
    } else marcaJo.setLatLng([jo.lat, jo.lng]);
    if (primerEncaix) {
      primerEncaix = false;
      mapa.invalidateSize();
      if (distancia(jo, cotxe) > 15) {
        mapa.fitBounds(L.latLngBounds([jo, cotxe]), { maxZoom: 18, paddingTopLeft: [40, 80], paddingBottomRight: [40, 30] });
      }
    }
    actualitzaDistancia();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
}
function paraVigilancia() {
  if (vigilant !== null) navigator.geolocation.clearWatch(vigilant);
  vigilant = null;
}

/* ---------- Compartir ---------- */
$('btn-compartir').addEventListener('click', async () => {
  const text = `El cotxe és aquí${cotxe.nota ? ` (${cotxe.nota})` : ''}`;
  const url = enllacMapa(cotxe);
  try {
    if (navigator.share) await navigator.share({ title: 'On és el cotxe', text, url });
    else { await navigator.clipboard.writeText(`${text}: ${url}`); toast('Enllaç copiat'); }
  } catch { /* cancel·lat */ }
});

/* ---------- Nota i foto ---------- */
$('nota').addEventListener('input', (e) => { cotxe.nota = e.target.value; desaCotxe(); pintaNota(); });

$('foto-input').addEventListener('change', async (e) => {
  const fitxer = e.target.files[0];
  e.target.value = '';
  if (!fitxer) return;
  try {
    cotxe.foto = await redueixFoto(fitxer, 1024, 0.7);
    if (!desaCotxe()) cotxe.foto = null;
    pintaNota();
  } catch { toast('No s\'ha pogut llegir la foto'); }
});
$('btn-treure-foto').addEventListener('click', () => { cotxe.foto = null; desaCotxe(); pintaNota(); });

function redueixFoto(fitxer, max, qualitat) {
  return new Promise((resol, rebutja) => {
    const img = new Image();
    const url = URL.createObjectURL(fitxer);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resol(c.toDataURL('image/jpeg', qualitat));
    };
    img.onerror = rebutja;
    img.src = url;
  });
}

function pintaNota() {
  $('nota').value = cotxe.nota || '';
  $('foto').hidden = !cotxe.foto;
  if (cotxe.foto) $('foto').src = cotxe.foto;
  $('btn-treure-foto').hidden = !cotxe.foto;
  const parts = [cotxe.nota && `“${cotxe.nota.slice(0, 28)}${cotxe.nota.length > 28 ? '…' : ''}”`, cotxe.foto && '📷'].filter(Boolean);
  $('resum-nota').textContent = parts.join(' ');
}

/* ---------- Parquímetre ---------- */
let rellotge = null, avisos = [];

document.querySelectorAll('.xip').forEach((b) => b.addEventListener('click', () => {
  posaTiquet(Date.now() + Number(b.dataset.min) * 60000);
}));
$('pq-hora').addEventListener('change', (e) => {
  if (!e.target.value) return;
  const [h, m] = e.target.value.split(':').map(Number);
  const fi = new Date(); fi.setHours(h, m, 0, 0);
  if (fi <= new Date()) fi.setDate(fi.getDate() + 1);
  posaTiquet(fi.getTime());
  e.target.value = '';
});
$('pq-cancel').addEventListener('click', () => { cotxe.pq = null; desaCotxe(); pintaParquimetre(); });
$('pq-calendari').addEventListener('click', () => baixaICS());

async function posaTiquet(fi) {
  cotxe.pq = { inici: Date.now(), fi };
  desaCotxe();
  pintaParquimetre();
  toast(`Tiquet fins a les ${hora(fi)}`);
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* */ }
  }
}

function arcSector(frac) { // sector des de dalt, en sentit horari
  if (frac <= 0) return '';
  if (frac >= 0.9999) return 'M50 4A46 46 0 1 1 49.99 4Z';
  const a = frac * 2 * Math.PI - Math.PI / 2;
  const x = 50 + 46 * Math.cos(a), y = 50 + 46 * Math.sin(a);
  return `M50 50L50 4A46 46 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}

function pintaParquimetre() {
  clearInterval(rellotge);
  avisos.forEach(clearTimeout); avisos = [];
  const pq = cotxe && cotxe.pq;
  $('pq-accions').hidden = !pq;
  $('pq-calendari').hidden = !pq;
  if (!pq) {
    $('pq-temps').textContent = 'Sense tiquet';
    $('pq-temps').className = 'pq-temps';
    $('pq-fins').textContent = 'Tria la durada o l\'hora de fi';
    $('pq-arc').setAttribute('d', '');
    $('pq-agulla').setAttribute('transform', 'rotate(0 50 50)');
    return;
  }
  programaAvisos(pq);
  const tic = () => {
    const resta = pq.fi - Date.now();
    const total = Math.max(1, pq.fi - pq.inici);
    const frac = Math.max(0, Math.min(1, resta / total));
    $('pq-arc').setAttribute('d', arcSector(frac));
    $('pq-agulla').setAttribute('transform', `rotate(${frac * 360} 50 50)`);
    const el = $('pq-temps');
    if (resta <= 0) {
      const passat = -resta;
      el.textContent = 'EXPIRAT';
      el.className = 'pq-temps expirat';
      $('pq-fins').textContent = `Fa ${Math.floor(passat / 60000)} min (${hora(pq.fi)})`;
      return;
    }
    const s = Math.floor(resta / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    el.textContent = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
    el.className = 'pq-temps' + (resta <= AVIS_MIN * 60000 ? ' avis' : '');
    $('pq-fins').textContent = `Fins a les ${hora(pq.fi)}`;
  };
  tic();
  rellotge = setInterval(tic, 1000);
}

function programaAvisos(pq) {
  const ara = Date.now();
  const prog = (quan, titol, cos) => {
    if (quan > ara) avisos.push(setTimeout(() => notifica(titol, cos), quan - ara));
  };
  prog(pq.fi - AVIS_MIN * 60000, `Queden ${AVIS_MIN} minuts`, `El tiquet s'acaba a les ${hora(pq.fi)}.`);
  prog(pq.fi, 'Tiquet expirat!', 'El temps del parquímetre s\'ha acabat.');
}

async function notifica(titol, cos) {
  toast(`⏰ ${titol} — ${cos}`, 8000);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opcions = { body: cos, icon: 'icons/icon-192.png', badge: 'icons/favicon.png', tag: 'parquimetre', renotify: true, vibrate: [300, 150, 300] };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(titol, opcions);
    new Notification(titol, opcions);
  } catch { /* */ }
}

// Alarma fiable: esdeveniment de calendari amb avisos (funciona amb l'app tancada).
function baixaICS() {
  const pq = cotxe.pq;
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Xoriguer//Aparcament//CA', 'BEGIN:VEVENT',
    `UID:xa-${pq.fi}@xoriguer`, `DTSTAMP:${f(Date.now())}`,
    `DTSTART:${f(pq.fi - 5 * 60000)}`, `DTEND:${f(pq.fi)}`,
    'SUMMARY:🅿 S\'acaba el parquímetre',
    `DESCRIPTION:El tiquet s'acaba a les ${hora(pq.fi)}.${cotxe.nota ? ' ' + cotxe.nota.replace(/[\r\n,;]/g, ' ') : ''}`,
    `LOCATION:${cotxe.lat.toFixed(6)}\\,${cotxe.lng.toFixed(6)}`,
    `URL:${enllacMapa(cotxe)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Parquímetre', `TRIGGER:-PT${AVIS_MIN - 5}M`, 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Parquímetre', 'TRIGGER:PT5M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'parquimetre.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- Recollir el cotxe ---------- */
$('btn-recollit').addEventListener('click', () => {
  if (!confirm('Has recollit el cotxe? La posició passarà a l\'historial.')) return;
  const hist = llegeix(CLAU_HIST, []);
  hist.unshift({ lat: cotxe.lat, lng: cotxe.lng, t: cotxe.t, fins: Date.now(), nota: cotxe.nota || '' });
  desa(CLAU_HIST, hist.slice(0, MAX_HIST));
  cotxe = null;
  desaCotxe();
  mostra();
});

function pintaHistorial() {
  const hist = llegeix(CLAU_HIST, []);
  const ol = $('historial');
  ol.innerHTML = '';
  $('historial-caixa').hidden = hist.length === 0;
  hist.forEach((h) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = enllacMapa(h); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = dataHora(h.t);
    li.append(a, document.createTextNode(h.nota ? ` — ${h.nota}` : ''));
    ol.appendChild(li);
  });
}

/* ---------- Vistes ---------- */
function mostra() {
  const hiHa = !!cotxe;
  $('vista-buida').hidden = hiHa;
  $('vista-cotxe').hidden = !hiHa;
  pintaHistorial();
  if (hiHa) {
    iniciaMapa();
    setTimeout(() => mapa.invalidateSize(), 50);
    actualitzaCotxe();
    pintaNota();
    pintaParquimetre();
    vigilaPosicio();
  } else {
    paraVigilancia();
    pintaParquimetre();
    if (mapa) { mapa.remove(); mapa = marcaCotxe = marcaJo = cercleCotxe = null; primerEncaix = true; }
  }
}

document.addEventListener('visibilitychange', () => {
  if (!cotxe) return;
  if (document.hidden) paraVigilancia();
  else { vigilaPosicio(); pintaParquimetre(); }
});

mostra();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
