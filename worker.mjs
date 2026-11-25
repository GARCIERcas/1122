import assets from './assets.mjs';
const times = ['10:00', '13:00', '15:00'];
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const stamp = new Date(day + 'T00:00:00Z');
  return Number.isFinite(+stamp) && stamp.toISOString().startsWith(day);
}
async function viewings(request, db, url) {
  if (!['GET','POST'].includes(request.method)) return json({},405);
  const data = request.method === 'POST' ? await request.json().catch(() => null) : {};
  if (!data || typeof data !== 'object') return json({},400);
  const day = request.method === 'GET' ? url.searchParams.get('date') : data.date;
  if (!validDay(day)) return json({},400);
  await db.prepare('CREATE TABLE IF NOT EXISTS viewings (day TEXT, time TEXT, name TEXT NOT NULL, email TEXT NOT NULL, PRIMARY KEY(day,time))').run();
  const future = times.filter(time => Date.parse(day+'T'+time+':00Z') > Date.now());
  if (request.method === 'GET') {
    const {results} = await db.prepare('SELECT time FROM viewings WHERE day = ?').bind(day).all();
    return json({times:future.filter(time => !results.some(row => row.time === time))});
  }
  if (!future.includes(data.time) || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 || typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return json({},400);
  const saved = await db.prepare('INSERT INTO viewings(day,time,name,email) VALUES (?,?,?,?) ON CONFLICT(day,time) DO NOTHING').bind(day,data.time,data.name.trim(),data.email.trim()).run();
  return saved.meta.changes ? json({booked:true},201) : json({},409);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/viewings') return viewings(request, env.DB, url);
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!Array.isArray(asset)) return new Response('Page not found',{status:404});
    const bytes = Uint8Array.from(atob(asset[1]), c => c.charCodeAt(0));
    return new Response(bytes,{headers:{'Content-Type':asset[0]}});
  }
};
