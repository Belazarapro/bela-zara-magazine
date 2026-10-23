import crypto from 'node:crypto';

// Magazine community features share the shop account system: one member login.
export function createCommunity({db,readJson,json,requireAdmin,UPLOADS}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS magazine_folders(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES magazine_folders(id), name TEXT NOT NULL, UNIQUE(parent_id,name));
    CREATE TABLE IF NOT EXISTS magazine_media(url TEXT PRIMARY KEY, original_name TEXT NOT NULL, folder_id INTEGER REFERENCES magazine_folders(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS magazine_favorites(user_id TEXT NOT NULL,post_id INTEGER NOT NULL,PRIMARY KEY(user_id,post_id));
    CREATE TABLE IF NOT EXISTS magazine_comments(id INTEGER PRIMARY KEY AUTOINCREMENT,post_id INTEGER NOT NULL,user_id TEXT NOT NULL,parent_id INTEGER,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS magazine_newsletter(email TEXT PRIMARY KEY, subscribed INTEGER NOT NULL DEFAULT 0,token_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS magazine_mailings(id INTEGER PRIMARY KEY AUTOINCREMENT,subject TEXT NOT NULL,body TEXT NOT NULL,sent INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  const bad=(message,status=400)=>Object.assign(new Error(message),{status});
  const trim=(s,max)=>String(s??'').trim().slice(0,max);
  const email=s=>{const x=trim(s,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))throw bad('Adresse e-mail invalide');return x};
  const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
  let secret=db.prepare("SELECT value FROM settings WHERE key='magazine_newsletter_secret'").get()?.value;
  if(!secret){secret=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('magazine_newsletter_secret',secret)}
  const unsubscribeToken=address=>crypto.createHmac('sha256',secret).update(address).digest('hex');
  const me=req=>{const token=req.headers.cookie?.match(/(?:^|;\s*)bz_client=([a-f0-9]{64})(?:;|$)/)?.[1];return token?db.prepare('SELECT u.id,u.name,u.email FROM shop_users u JOIN shop_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expiry>? AND u.suspended=0').get(digest(token),Date.now()):null};
  const member=req=>{const u=me(req);if(!u)throw bad('Connectez-vous à votre espace membre',401);return u};
  const post=id=>{const p=db.prepare("SELECT id FROM posts WHERE id=? AND status='published'").get(id);if(!p)throw bad('Publication introuvable',404);return p};
  const throttle=new Map();
  function limited(req,tag,limit=8){const key=tag+':'+(req.socket.remoteAddress||'?'),now=Date.now();let x=throttle.get(key);if(!x||now-x.start>3600000)x={start:now,n:0};x.n++;throttle.set(key,x);if(x.n>limit)throw bad('Trop de demandes. Réessayez plus tard.',429);if(throttle.size>10000)throttle.clear()}
  const mediaRow=r=>({...r,type:/\.(mp4|webm)$/i.test(r.url)?'video':/\.(mp3|m4a|ogg|wav)$/i.test(r.url)?'audio':/\.epub$/i.test(r.url)?'epub':'image'});
  return async(req,res,url)=>{
    const p=url.pathname,method=req.method;
    if(method!=='GET'&&method!=='HEAD'&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host}catch{}if(origin!==req.headers.host)throw bad('Origine non autorisée',403)}
    if(p==='/api/community/me'&&method==='GET')return json(res,{user:me(req)});
    if(p==='/api/community/favorites'&&method==='GET'){const u=member(req);return json(res,{ids:db.prepare('SELECT post_id FROM magazine_favorites WHERE user_id=?').all(u.id).map(x=>x.post_id)});}
    const fav=p.match(/^\/api\/community\/favorites\/(\d+)$/);
    if(fav&&['PUT','DELETE'].includes(method)){const u=member(req),id=Number(fav[1]);post(id);if(method==='PUT')db.prepare('INSERT OR IGNORE INTO magazine_favorites VALUES(?,?)').run(u.id,id);else db.prepare('DELETE FROM magazine_favorites WHERE user_id=? AND post_id=?').run(u.id,id);return json(res,{ok:true});}
    if(p==='/api/community/comments'&&method==='GET'){
      const id=Number(url.searchParams.get('post'));post(id);
      return json(res,{comments:db.prepare(`SELECT c.id,c.parent_id,c.body,c.created_at,u.name FROM magazine_comments c JOIN shop_users u ON u.id=c.user_id WHERE c.post_id=? AND c.status='approved' ORDER BY c.id ASC LIMIT 500`).all(id),canComment:!!me(req)});
    }
    if(p==='/api/community/comments'&&method==='POST'){
      const u=member(req);limited(req,'comment',20);const input=await readJson(req),id=Number(input.post_id),body=trim(input.body,3000);post(id);
      if(body.length<3)throw bad('Commentaire trop court');
      let parent=null;if(input.parent_id!=null){parent=Number(input.parent_id);if(!db.prepare("SELECT 1 FROM magazine_comments WHERE id=? AND post_id=? AND status='approved'").get(parent,id))throw bad('Réponse introuvable');}
      db.prepare('INSERT INTO magazine_comments(post_id,user_id,parent_id,body) VALUES(?,?,?,?)').run(id,u.id,parent,body);
      return json(res,{ok:true,message:'Commentaire envoyé en modération'},201);
    }
    if(p==='/api/community/admin/comments'&&method==='GET'){if(!requireAdmin(req,res))return;return json(res,{comments:db.prepare(`SELECT c.*,u.name,p.title FROM magazine_comments c JOIN shop_users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id ORDER BY c.id DESC LIMIT 500`).all()});}
    const mod=p.match(/^\/api\/community\/admin\/comments\/(\d+)$/);
    if(mod&&method==='PATCH'){if(!requireAdmin(req,res))return;const status=(await readJson(req)).status;if(!['approved','rejected','pending'].includes(status))throw bad('Statut invalide');db.prepare('UPDATE magazine_comments SET status=? WHERE id=?').run(status,Number(mod[1]));return json(res,{ok:true});}
    if(mod&&method==='DELETE'){if(!requireAdmin(req,res))return;db.prepare('DELETE FROM magazine_comments WHERE id=? OR parent_id=?').run(Number(mod[1]),Number(mod[1]));return json(res,{ok:true});}
    if(p==='/api/community/admin/folders'&&method==='GET'){if(!requireAdmin(req,res))return;return json(res,{folders:db.prepare('SELECT * FROM magazine_folders ORDER BY name').all()});}
    if(p==='/api/community/admin/folders'&&method==='POST'){
      if(!requireAdmin(req,res))return;const b=await readJson(req),name=trim(b.name,100),parent=b.parent_id==null?null:Number(b.parent_id);
      if(!name||/[\/\\<>]/.test(name))throw bad('Nom de dossier invalide');if(parent!==null&&!db.prepare('SELECT 1 FROM magazine_folders WHERE id=?').get(parent))throw bad('Dossier parent introuvable');
      const result=db.prepare('INSERT INTO magazine_folders(parent_id,name) VALUES(?,?)').run(parent,name);return json(res,{id:Number(result.lastInsertRowid)},201);
    }
    const folder=p.match(/^\/api\/community\/admin\/folders\/(\d+)$/);
    if(folder&&method==='DELETE'){if(!requireAdmin(req,res))return;const id=Number(folder[1]);if(db.prepare('SELECT 1 FROM magazine_folders WHERE parent_id=?').get(id)||db.prepare('SELECT 1 FROM magazine_media WHERE folder_id=?').get(id))throw bad('Videz ce dossier et ses sous-dossiers avant suppression',409);db.prepare('DELETE FROM magazine_folders WHERE id=?').run(id);return json(res,{ok:true});}
    if(p==='/api/community/admin/media'&&method==='GET'){
      if(!requireAdmin(req,res))return;
      const fs=await import('node:fs');const path=await import('node:path');const files=fs.readdirSync(UPLOADS).filter(x=>/^[a-f\d-]{36}\.(jpg|png|webp|gif|mp3|m4a|ogg|wav|mp4|webm|epub)$/i.test(x)).map(x=>{
        const url='/uploads/'+x,st=fs.statSync(path.join(UPLOADS,x)),row=db.prepare('SELECT original_name,folder_id FROM magazine_media WHERE url=?').get(url);
        return mediaRow({url,original_name:row?.original_name||x,folder_id:row?.folder_id??null,bytes:st.size,created_at:st.birthtime.toISOString()});
      });return json(res,{files});
    }
    if(p==='/api/community/admin/media'&&method==='PUT'){
      if(!requireAdmin(req,res))return;const b=await readJson(req),url=trim(b.url,160),original=trim(b.original_name,255),folder=b.folder_id==null?null:Number(b.folder_id);
      if(!/^\/uploads\/[a-f\d-]{36}\.(jpg|png|webp|gif|mp3|m4a|ogg|wav|mp4|webm|epub)$/i.test(url))throw bad('Fichier invalide');
      const fs=await import('node:fs');const path=await import('node:path');if(!fs.existsSync(path.join(UPLOADS,path.basename(url))))throw bad('Fichier introuvable',404);
      if(folder!==null&&!db.prepare('SELECT 1 FROM magazine_folders WHERE id=?').get(folder))throw bad('Dossier invalide');
      db.prepare('INSERT INTO magazine_media(url,original_name,folder_id) VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET original_name=excluded.original_name,folder_id=excluded.folder_id').run(url,original||path.basename(url),folder);return json(res,{ok:true});
    }
    if(p==='/api/community/newsletter'&&method==='POST'){
      limited(req,'subscribe',12);const b=await readJson(req),address=email(b.email),token=unsubscribeToken(address);
      db.prepare('INSERT INTO magazine_newsletter(email,subscribed,token_hash) VALUES(?,1,?) ON CONFLICT(email) DO UPDATE SET subscribed=1,token_hash=excluded.token_hash').run(address,digest(token));
      return json(res,{ok:true,unsubscribe_url:`/newsletter/desabonnement?email=${encodeURIComponent(address)}&token=${token}`});
    }
    if(p==='/api/community/newsletter/unsubscribe'&&method==='POST'){
      limited(req,'unsubscribe',30);const b=await readJson(req),address=email(b.email),token=trim(b.token,128);if(token!==unsubscribeToken(address))throw bad('Lien de désabonnement invalide',403);db.prepare('UPDATE magazine_newsletter SET subscribed=0 WHERE email=?').run(address);return json(res,{ok:true});
    }
    if(p==='/api/community/admin/newsletter'&&method==='GET'){if(!requireAdmin(req,res))return;return json(res,{subscribers:db.prepare('SELECT email,subscribed,created_at FROM magazine_newsletter ORDER BY created_at DESC').all(),mailings:db.prepare('SELECT * FROM magazine_mailings ORDER BY id DESC LIMIT 30').all(),configured:!!(process.env.BREVO_API_KEY&&process.env.NEWSLETTER_SENDER_EMAIL)});}
    if(p==='/api/community/admin/newsletter'&&method==='POST'){
      if(!requireAdmin(req,res))return;const b=await readJson(req),subject=trim(b.subject,180),body=trim(b.body,25000);
      if(subject.length<3||body.length<10)throw bad('Objet ou contenu trop court');
      if(!process.env.BREVO_API_KEY||!process.env.NEWSLETTER_SENDER_EMAIL)throw bad('Configurez BREVO_API_KEY et NEWSLETTER_SENDER_EMAIL avant tout envoi',503);
      const origin=process.env.SITE_ORIGIN;if(!origin||!/^https:\/\//.test(origin))throw bad('SITE_ORIGIN HTTPS requis');
      const subs=db.prepare('SELECT email,token_hash FROM magazine_newsletter WHERE subscribed=1').all();if(subs.length>500)throw bad('Envoi limité à 500 abonnés par opération');
      const mailing=db.prepare('INSERT INTO magazine_mailings(subject,body) VALUES(?,?)').run(subject,body);let sent=0,failed=0;
      for(const recipient of subs){
        const token=unsubscribeToken(recipient.email);
        const link=`${origin.replace(/\/$/,'')}/newsletter/desabonnement?email=${encodeURIComponent(recipient.email)}&token=${token}`;
        try{
          const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({sender:{email:process.env.NEWSLETTER_SENDER_EMAIL,name:'Bela Zara Magazine'},to:[{email:recipient.email}],subject,textContent:body+'\n\nSe désabonner : '+link}),signal:AbortSignal.timeout(15000)});
          if(!response.ok)throw new Error('Échec fournisseur '+response.status);sent++;
        }catch(error){failed++;console.error('Newsletter:',error.message)}
      }
      db.prepare('UPDATE magazine_mailings SET sent=?,failed=? WHERE id=?').run(sent,failed,mailing.lastInsertRowid);return json(res,{sent,failed});
    }
    return json(res,{error:'Route inconnue'},404);
  };
}
