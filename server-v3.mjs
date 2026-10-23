import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {createShop} from './shop.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT,'data'));
const UPLOADS = path.join(DATA, 'uploads');
fs.mkdirSync(UPLOADS, {recursive:true});
const db = new DatabaseSync(path.join(DATA, 'magazine.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Société',
 type TEXT NOT NULL DEFAULT 'article', image TEXT NOT NULL DEFAULT '',
 media_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'published',
 featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
const readSetting = db.prepare('SELECT value FROM settings WHERE key=?');
const putSetting = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
const defaultSettings = {
  siteTitle: 'BELA ZARA', subtitle: 'IDÉES · SOCIÉTÉ · LITTÉRATURE · PAMPHLETS',
  motto: 'Interroger le monde pour mieux le transformer.',
  quote: 'Écrire, c’est refuser le silence qu’on impose.',
  about: 'Un magazine indépendant d’idées, de critique sociale et de littérature. Articles, pamphlets, essais, podcasts et vidéos.',
  footer: 'Un espace libre pour penser, écrire et débattre.',
  heroId: '',
  sidebarPosition: 'right',
  sidebarVisible: 'yes',
  homeCardCount: '4',
  homeFirst: 'hero',
  mastheadImage: '/assets/regards.jpg',
  quoteImage: '/assets/regards.jpg',
  aboutImage: '',
  sidebarImage: '',
  defaultCover: '/assets/archives.jpg',
  navHome: 'ACCUEIL', navArticles: 'ARTICLES', navDossiers: 'GRANDS DOSSIERS',
  navPodcasts: 'PODCASTS & VIDÉOS', navLivres: 'LIVRES', navAbout: 'À PROPOS',
  navShowArticles: 'yes', navShowDossiers: 'yes', navShowPodcasts: 'yes',
  navShowLivres: 'yes', navShowAbout: 'yes',
  contactEmail: '', legalMentions: '', legalPrivacy: '', legalTerms: '',
};
for(const [k,v] of Object.entries(defaultSettings)) if(!readSetting.get(k)) putSetting.run(k,v);
if(db.prepare('SELECT count(*) AS n FROM posts').get().n === 0) {
  const samples = [
    ['Les racisés qui ne baissent pas le regard', 'Pourquoi le regard peut devenir un acte politique et déranger ceux qui attendent la déférence.', 'Société','article','/assets/regards.jpg',1,1],
    ['Le Musulman fantasmé','De l’ennemi intérieur à la figure commode : anatomie d’un portrait imaginaire.','Pamphlets','article','/assets/oeil.jpg',0,2],
    ['Le deux poids, deux mesures français','Pourquoi certaines vies semblent compter plus que d’autres ?','Société','article','/assets/manif.jpg',0,3],
    ['Mes livres','Pamphlets, essais, fictions : une autre manière d’explorer le réel.','Littérature','book','/assets/livres.jpg',0,4],
    ['Conversations nécessaires','Analyses, entretiens et lectures en images.','Vidéos','video','/assets/video.jpg',0,5],
    ['Qui a le droit d’être Français ?','Identité, appartenance et égalité : les questions qui traversent notre société.','Société','article','/assets/manif.jpg',0,6],
    ['Les oubliés de la République','Regards sur les mémoires, les exclusions et les récits nationaux.','Histoire','article','/assets/archives.jpg',0,7],
    ['La fabrique des boucs émissaires','À qui profite la fabrication de l’ennemi ?','Pamphlets','article','/assets/oeil.jpg',0,8],
    ['Le Musulman fantasmé : podcast','Une version audio à accompagner de ton propre fichier ou lien de podcast.','Podcasts','podcast','/assets/micro.jpg',0,9],
  ];
  const add = db.prepare(`INSERT INTO posts (slug,title,excerpt,body,category,type,image,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const [title, excerpt, category, type, image, featured, order] of samples) {
    const slug = uniqueSlug(title);
    add.run(slug,title,excerpt,`## ${title}\n\nCeci est un contenu de démonstration. Tu peux le remplacer dans l’espace d’administration par ton véritable article.\n\n${excerpt}\n\nAjoute ici ton texte, tes intertitres et tes références.`, category,type,image,featured,order);
  }
}
function slugify(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'article';}
function uniqueSlug(title, ignoreId=0) {
  const base=slugify(title); let slug=base, i=2;
  while(db.prepare('SELECT id FROM posts WHERE slug=? AND id!=?').get(slug,ignoreId)) slug=base+'-'+i++;
  return slug;
}
function settings() {const out={}; for(const {key,value} of db.prepare('SELECT key,value FROM settings').all()) out[key]=value;return out;}
function publicPost(row){return {...row, featured:!!row.featured};}
const sessions = new Map();
// Limiteur simple d'essais de connexion (en mémoire, par adresse IP).
const failedLogins = new Map();
function visitorIp(req) { return String(req.socket.remoteAddress || 'unknown'); }
function attemptsFor(ip) {
  const now=Date.now(); let entry=failedLogins.get(ip);
  if(!entry || entry.reset < now) {entry={count:0,reset:now+15*60*1000}; failedLogins.set(ip,entry);}
  return entry;
}
setInterval(()=>{
  const now=Date.now();
  for (const [ip,entry] of failedLogins) if(entry.reset<now) failedLogins.delete(ip);
  for (const [token,entry] of sessions) if(entry.exp<now) sessions.delete(token);
}, 10*60*1000).unref();
const MAX_BYTES = 6*1024*1024;
function parseCookies(raw=''){return Object.fromEntries(raw.split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(v=>v.length===2));}
function authorized(req){const token=parseCookies(req.headers.cookie).bela_session;const s=token&&sessions.get(token);return !!(s&&s.exp>Date.now());}
function json(res,data,status=200,extra={}){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin',...extra});res.end(body);}
async function readBody(req,max=MAX_BYTES){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max) throw Object.assign(new Error('Fichier trop volumineux'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
async function readJson(req){const body=await readBody(req,1024*1024);try{return JSON.parse(body.toString('utf8'))}catch {throw Object.assign(new Error('JSON invalide'),{status:400});}}
function requireAdmin(req,res){if(!authorized(req)){json(res,{error:'Connexion administrateur requise'},401);return false}return true;}
function clean(value,n=1000){return typeof value==='string'?value.trim().slice(0,n):'';}
function assetPath(value){const s=clean(value,2048);return /^https:\/\//i.test(s)||/^http:\/\//i.test(s)||/^\/(?:assets|uploads)\/[\w.\-\/]+$/.test(s)?s:'';}
function savePost(input,id=null){
  const title=clean(input.title,160);if(!title) throw Object.assign(new Error('Le titre est obligatoire'),{status:400});
  const type=['article','podcast','video','book'].includes(input.type)?input.type:'article';
  const status=input.status==='draft'?'draft':'published';
  const category=clean(input.category,45)||'Société';
  const excerpt=clean(input.excerpt,400);const body=clean(input.body,100000);
  const image=assetPath(input.image); const media_url=assetPath(input.media_url);
  const featured=input.featured?1:0;
  const sort_order=Number.isFinite(Number(input.sort_order))?Number(input.sort_order):100;
  if(featured) db.exec('UPDATE posts SET featured=0');
  if(id){
    const existing=db.prepare('SELECT * FROM posts WHERE id=?').get(id);if(!existing) throw Object.assign(new Error('Publication introuvable'),{status:404});
    const slug=(existing.title!==title)?uniqueSlug(title,id):existing.slug;
    db.prepare(`UPDATE posts SET slug=?, title=?,excerpt=?,body=?,category=?,type=?,image=?,media_url=?,status=?,featured=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(slug,title,excerpt,body,category,type,image,media_url,status,featured,sort_order,id);
    return publicPost(db.prepare('SELECT * FROM posts WHERE id=?').get(id));
  }
  const result=db.prepare(`INSERT INTO posts(slug,title,excerpt,body,category,type,image,media_url,status,featured,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uniqueSlug(title),title,excerpt,body,category,type,image,media_url,status,featured,sort_order);
  return publicPost(db.prepare('SELECT * FROM posts WHERE id=?').get(result.lastInsertRowid));
}
function passwordValid(password) {const configured=process.env.ADMIN_PASSWORD; if(!configured||configured.length<12)return false;
  const a=crypto.scryptSync(Buffer.from(String(password)),Buffer.from('bela-zara-admin'),64);
  const b=crypto.scryptSync(Buffer.from(configured),Buffer.from('bela-zara-admin'),64);
  return crypto.timingSafeEqual(a,b);
}
function isAllowedOrigin(req) {const origin=req.headers.origin;if(!origin)return true;try {const o=new URL(origin);return o.host===req.headers.host;}catch{return false;}}
function mime(filename){const ext=path.extname(filename).toLowerCase();return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.epub':'application/epub+zip'})[ext]||'application/octet-stream';}
function staticFile(res,root,relative,req){const file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep))return json(res,{error:'Accès refusé'},403);
  let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw 0;}catch{return json(res,{error:'Fichier introuvable'},404)}
  const headers={'Content-Type':mime(file),'Content-Length':stat.size,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('.html')?'no-cache':'public, max-age=600','Referrer-Policy':'strict-origin-when-cross-origin'};
  const range=req?.headers.range;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match)return res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();
    let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
    if(start===null&&end!==null){start=Math.max(0,stat.size-end);end=stat.size-1;}else {start??=0;end??=stat.size-1;}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=stat.size||start>end)return res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();
    end=Math.min(end,stat.size-1);headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;headers['Content-Length']=end-start+1;
    res.writeHead(206,headers);if(req?.method==='HEAD')return res.end();return fs.createReadStream(file,{start,end}).pipe(res);
  }
  res.writeHead(200,headers);if(req?.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}
const uploadFormats={
  '.jpg':['image/jpeg','image',12],'.jpeg':['image/jpeg','image',12],'.png':['image/png','image',12],'.webp':['image/webp','image',12],'.gif':['image/gif','image',12],
  '.mp3':['audio/mpeg','podcast',100],'.m4a':['audio/mp4','podcast',100],'.ogg':['audio/ogg','podcast',100],'.wav':['audio/wav','podcast',100],
  '.mp4':['video/mp4','video',200],'.webm':['video/webm','video',200],'.epub':['application/epub+zip','book',60]
};
function validMagic(ext,b){
  const ascii=(a,z)=>b.toString('ascii',a,z);
  if(ext==='.jpg'||ext==='.jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
  if(ext==='.png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(ext==='.webp')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
  if(ext==='.gif')return ascii(0,3)==='GIF';
  if(ext==='.mp3')return ascii(0,3)==='ID3'||(b[0]===255&&(b[1]&0xe0)===0xe0);
  if(ext==='.ogg')return ascii(0,4)==='OggS';
  if(ext==='.wav')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';
  if(ext==='.m4a'||ext==='.mp4')return ascii(4,8)==='ftyp';
  if(ext==='.webm')return b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(ext==='.epub')return ascii(0,2)==='PK'&&b.includes(Buffer.from('application/epub+zip'));
  return false;
}
async function uploadMedia(req){
  let declared='';try{declared=decodeURIComponent(clean(req.headers['x-upload-name'],300));}catch{throw Object.assign(new Error('Nom de fichier invalide'),{status:400});}
  const ext=path.extname(declared).toLowerCase();const format=uploadFormats[ext];
  if(!format)throw Object.assign(new Error('Formats autorisés : JPG, PNG, WebP, GIF, MP3, M4A, OGG, WAV, MP4, WebM et EPUB'),{status:415});
  const kind=(req.headers['content-type']||'').split(';')[0].toLowerCase();
  if(kind!==format[0]&&kind!=='application/octet-stream')throw Object.assign(new Error('Le type du fichier ne correspond pas à son extension'),{status:415});
  const max=format[2]*1024*1024;const name=crypto.randomUUID()+(ext==='.jpeg'?'.jpg':ext);
  const temp=path.join(UPLOADS,'.'+name+'.part');const dest=path.join(UPLOADS,name);
  let handle,total=0,head=Buffer.alloc(0);
  try{
    handle=await fs.promises.open(temp,'wx');
    for await(const chunk of req){total+=chunk.length;if(total>max)throw Object.assign(new Error(`Fichier trop volumineux (${format[2]} Mo maximum pour ce format)`),{status:413});
      if(head.length<512)head=Buffer.concat([head,chunk.subarray(0,512-head.length)]);
      let written=0;while(written<chunk.length){const out=await handle.write(chunk,written,chunk.length-written);written+=out.bytesWritten;}
    }
    if(!total||!validMagic(ext,head))throw Object.assign(new Error('Format de fichier invalide ou contenu non reconnu'),{status:415});
    await handle.close();handle=null;await fs.promises.rename(temp,dest);
    return {url:'/uploads/'+name,type:format[1],bytes:total};
  }catch(err){if(handle)await handle.close().catch(()=>{});await fs.promises.unlink(temp).catch(()=>{});throw err;}
}
const shop=createShop({db,DATA,readBody,json,requireAdmin,isAllowedOrigin,staticFile});
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'); const pathname=url.pathname;
    if(pathname.startsWith('/api/shop/'))return await shop(req,res,pathname);
    if(req.method!=='GET'&&req.method!=='HEAD'&&!isAllowedOrigin(req))return json(res,{error:'Origine refusée'},403);
    if(pathname==='/api/health')return json(res,{ok:true});
    if(pathname==='/api/site'&&req.method==='GET')return json(res,{settings:settings()});
    if(pathname==='/api/posts'&&req.method==='GET') {
      const type=clean(url.searchParams.get('type'),40),category=clean(url.searchParams.get('category'),45),q=clean(url.searchParams.get('q'),120).toLowerCase();
      let list=db.prepare("SELECT * FROM posts WHERE status='published' ORDER BY featured DESC,sort_order ASC,created_at DESC").all();
      if(type)list=list.filter(p=>p.type===type);if(category)list=list.filter(p=>p.category===category);if(q)list=list.filter(p=>(p.title+' '+p.excerpt+' '+p.category+' '+p.body).toLowerCase().includes(q));
      return json(res,{posts:list.map(publicPost)});
    }
    if(pathname.startsWith('/api/posts/')&&req.method==='GET'){
      const slug=decodeURIComponent(pathname.slice('/api/posts/'.length));const row=db.prepare("SELECT * FROM posts WHERE slug=? AND status='published'").get(slug);
      return row?json(res,{post:publicPost(row)}):json(res,{error:'Article introuvable'},404);
    }
    if(pathname==='/api/auth/session'&&req.method==='GET')return json(res,{authenticated:authorized(req),configured:!!(process.env.ADMIN_PASSWORD&&process.env.ADMIN_PASSWORD.length>=12)});
    if(pathname==='/api/auth/login'&&req.method==='POST') {
      const {password}=await readJson(req);const ip=visitorIp(req);const attempt=attemptsFor(ip);
      if(attempt.count>=8)return json(res,{error:'Trop de tentatives. Réessayez plus tard.'},429,{'Retry-After':'900'});
      if(!passwordValid(password)){
        attempt.count++;
        return json(res,{error:'Mot de passe incorrect ou administration non configurée'},401);
      }
      failedLogins.delete(ip);
      const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{exp:Date.now()+1000*60*60*12});
      const secure=(req.socket.encrypted||req.headers['x-forwarded-proto']==='https')?'; Secure':'';
      return json(res,{ok:true},200,{'Set-Cookie':`bela_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`});
    }
    if(pathname==='/api/auth/logout'&&req.method==='POST'){
      const t=parseCookies(req.headers.cookie).bela_session;if(t)sessions.delete(t);
      return json(res,{ok:true},200,{'Set-Cookie':'bela_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});
    }
    if(pathname==='/api/admin/posts'&&req.method==='GET'){
      if(!requireAdmin(req,res))return;
      return json(res,{posts:db.prepare('SELECT * FROM posts ORDER BY sort_order ASC,id ASC').all().map(publicPost)});
    }
    if(pathname==='/api/admin/posts'&&req.method==='POST'){
      if(!requireAdmin(req,res))return;
      return json(res,{post:savePost(await readJson(req))},201);
    }
    const match=pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
    if(match&&(req.method==='PUT'||req.method==='DELETE')){
      if(!requireAdmin(req,res))return;const id=Number(match[1]);
      if(req.method==='DELETE'){db.prepare('DELETE FROM posts WHERE id=?').run(id);return json(res,{ok:true});}
      return json(res,{post:savePost(await readJson(req),id)});
    }
    if(pathname==='/api/admin/reorder'&&req.method==='PUT'){
      if(!requireAdmin(req,res))return;const input=await readJson(req);
      if(!Array.isArray(input.ids))return json(res,{error:'Liste d’identifiants invalide'},400);
      const stmt=db.prepare('UPDATE posts SET sort_order=? WHERE id=?');for(let i=0;i<input.ids.length&&i<500;i++)stmt.run(i+1,Number(input.ids[i]));
      return json(res,{ok:true});
    }
    if(pathname==='/api/admin/settings'&&req.method==='PUT'){
      if(!requireAdmin(req,res))return;const input=await readJson(req);
      for(const key of Object.keys(defaultSettings)) if(typeof input[key]==='string'){
        const value=key.toLowerCase().includes('image')||key==='defaultCover'?assetPath(input[key]):clean(input[key],key==='about'?800:250);
        putSetting.run(key,key.startsWith('legal')?clean(input[key],30000):value);
      }
      return json(res,{settings:settings()});
    }
    if(pathname==='/api/admin/upload'&&req.method==='POST'){
      if(!requireAdmin(req,res))return;
      return json(res,await uploadMedia(req),201);
    }
    if(pathname==='/api/admin/media'&&req.method==='GET'){
      if(!requireAdmin(req,res))return;
      const files=fs.readdirSync(UPLOADS,{withFileTypes:true}).filter(f=>f.isFile()&&!f.name.startsWith('.')&&uploadFormats[path.extname(f.name).toLowerCase()]).map(f=>{
        const meta=fs.statSync(path.join(UPLOADS,f.name));return {url:'/uploads/'+f.name,type:uploadFormats[path.extname(f.name).toLowerCase()][1],bytes:meta.size,created_at:meta.birthtime.toISOString()};
      }).sort((a,b)=>b.created_at.localeCompare(a.created_at));
      return json(res,{files});
    }
    const mediaDel=pathname.match(/^\/api\/admin\/media\/([a-f\d-]{36}\.(?:jpg|png|webp|gif|mp3|m4a|ogg|wav|mp4|webm|epub))$/i);
    if(mediaDel&&req.method==='DELETE'){
      if(!requireAdmin(req,res))return;const filename=mediaDel[1],url='/uploads/'+filename;
      const used=db.prepare('SELECT 1 FROM posts WHERE image=? OR media_url=? LIMIT 1').get(url,url);
      const settingUsed=db.prepare('SELECT 1 FROM settings WHERE value=? LIMIT 1').get(url);
      if(used||settingUsed)return json(res,{error:'Ce fichier est utilisé par une publication ou une photo du site. Retirez-le de cet emplacement avant de le supprimer.'},409);
      try{fs.unlinkSync(path.join(UPLOADS,filename));}catch(e){if(e.code!=='ENOENT')throw e;}
      return json(res,{ok:true});
    }
    if(pathname.startsWith('/uploads/')&&(req.method==='GET'||req.method==='HEAD'))return staticFile(res,UPLOADS,pathname.slice('/uploads'.length),req);
    if(req.method!=='GET')return json(res,{error:'Route inconnue'},404);
    const staticPath=pathname==='/'?'/index.html':pathname;
    if(staticPath==='/admin')return staticFile(res,PUBLIC,'/index.html',req);
    if(!path.extname(staticPath))return staticFile(res,PUBLIC,'/index.html',req);
    return staticFile(res,PUBLIC,staticPath,req);
  }catch(e){console.error(e);return json(res,{error:e.message||'Erreur serveur'},e.status||500)}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Bela Zara Magazine : http://localhost:${port} (${process.env.ADMIN_PASSWORD?.length>=12?'administration activée':'administration désactivée : renseigner ADMIN_PASSWORD'})`));
