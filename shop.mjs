import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function createShop({db,DATA,readBody,json,requireAdmin,isAllowedOrigin,staticFile}){
 const dir=path.join(DATA,'private-products');fs.mkdirSync(dir,{recursive:true});
 db.exec(`CREATE TABLE IF NOT EXISTS shop_users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shop_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expiry INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS shop_products(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL,price INTEGER NOT NULL,cover TEXT NOT NULL DEFAULT '',private_file TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS shop_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',stripe_session TEXT UNIQUE,payment_intent TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS shop_grants(user_id TEXT NOT NULL,product_id TEXT NOT NULL,order_id TEXT,PRIMARY KEY(user_id,product_id));
 CREATE TABLE IF NOT EXISTS shop_events(id TEXT PRIMARY KEY);`);
 // Migration compatible avec les comptes et achats existants.
 if(!db.prepare("PRAGMA table_info(shop_users)").all().some(c=>c.name==='suspended'))
   db.exec("ALTER TABLE shop_users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0");
 const bad=(message,status=400)=>Object.assign(new Error(message),{status});
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 const token=()=>crypto.randomBytes(32).toString('hex');
 const email=s=>{if(typeof s!=='string'||s.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()))throw bad('Adresse e-mail invalide');return s.trim().toLowerCase()};
 const hashed=p=>{if(typeof p!=='string'||p.length<12||p.length>200)throw bad('Choisissez un mot de passe de 12 caractères minimum');const salt=crypto.randomBytes(16).toString('hex');return `${salt}$${crypto.scryptSync(p,salt,64,{N:32768,maxmem:64*1024*1024}).toString('hex')}`};
 const verify=(p,stored)=>{if(typeof p!=='string'||p.length>200||!stored)return false;const [salt,hex]=stored.split('$');if(!salt||!hex)return false;const b=Buffer.from(hex,'hex'),a=crypto.scryptSync(p,salt,64,{N:32768,maxmem:64*1024*1024});return a.length===b.length&&crypto.timingSafeEqual(a,b)};
 const cook=req=>req.headers.cookie?.match(/(?:^|;\s*)bz_client=([a-f0-9]{64})(?:;|$)/)?.[1];
 const me=req=>{const t=cook(req);return t?db.prepare('SELECT u.id,u.email,u.name FROM shop_users u JOIN shop_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expiry>? AND u.suspended=0').get(sha(t),Date.now()):null};
 const secure=req=>(req.socket.encrypted||req.headers['x-forwarded-proto']==='https')?'; Secure':'';
 const login=(req,res,u)=>{const t=token();db.prepare('INSERT INTO shop_sessions VALUES(?,?,?)').run(sha(t),u.id,Date.now()+604800000);res.setHeader('Set-Cookie',`bz_client=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure(req)}`)};
 const data=async req=>{try{return JSON.parse((await readBody(req,65536)).toString())}catch{throw bad('Données invalides')}};
 const required=req=>{const u=me(req);if(!u)throw bad('Connectez-vous à votre espace client',401);return u};
 const setting=k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value||'';
 const legal=()=>['legalMentions','legalPrivacy','legalTerms'].every(k=>setting(k).length>=100)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setting('contactEmail'));
 const ready=()=>legal()&&process.env.SHOP_SALES_ENABLED==='true'&&!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET&&/^https:\/\//.test(process.env.SITE_ORIGIN||'');
 const products=()=>db.prepare('SELECT * FROM shop_products ORDER BY rowid DESC').all();
 const pub=p=>{const {private_file,...rest}=p;return {...rest,has_file:!!private_file,file_type:private_file.split('.').pop()||'',active:!!p.active,can_buy:!!p.active&&!!private_file&&ready()}};
 const access=(u,p)=>!!db.prepare("SELECT 1 FROM shop_grants g LEFT JOIN shop_orders o ON o.id=g.order_id WHERE g.user_id=? AND g.product_id=? AND (g.order_id IS NULL OR o.status='paid')").get(u.id,p.id);
 const valid=b=>{if(typeof b.title!=='string'||b.title.trim().length<2||b.title.length>150||typeof b.description!=='string'||b.description.length>6000||!['ebook','audio','video','formation'].includes(b.kind)||!Number.isSafeInteger(b.price)||b.price<50||b.price>10000000)throw bad('Titre, type ou prix invalide')};
 const cover=s=>typeof s==='string'&&(/^\/(?:assets|uploads)\/[\w./-]+$/.test(s)||/^https:\/\//.test(s))?s.slice(0,2000):'';
 const events=new Map();const limit=(req,key,max=15)=>{const id=key+':'+req.socket.remoteAddress,e=events.get(id)||{n:0,until:Date.now()+900000};if(e.until<Date.now()){e.n=0;e.until=Date.now()+900000}if(++e.n>max)throw bad('Trop de tentatives, réessayez plus tard',429);events.set(id,e);if(events.size>10000)events.clear()};
 const stripeSigned=(raw,header)=>{const pieces=String(header||'').split(',').map(s=>s.trim().split('=')),t=pieces.find(p=>p[0]==='t')?.[1];if(!t||!/^\d+$/.test(t)||Math.abs(Date.now()/1000-Number(t))>300)return false;const digest=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(t+'.').update(raw).digest();return pieces.filter(p=>p[0]==='v1').some(p=>/^[0-9a-f]{64}$/i.test(p[1]||'')&&crypto.timingSafeEqual(digest,Buffer.from(p[1],'hex')))};
 return async function route(req,res,url){
  if(url==='/api/shop/webhook'&&req.method==='POST'){
   if(!process.env.STRIPE_WEBHOOK_SECRET)throw bad('Paiement non configuré',503);const raw=await readBody(req,2097152);
   if(!stripeSigned(raw,req.headers['stripe-signature']))throw bad('Signature Stripe invalide',400);
   const event=JSON.parse(raw.toString()),o=event.data?.object||{};if(typeof event.id!=='string')throw bad('Événement invalide');
   if(db.prepare('SELECT 1 FROM shop_events WHERE id=?').get(event.id))return json(res,{received:true});
   db.exec('BEGIN IMMEDIATE');try{
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&o.payment_status==='paid'){
     const order=db.prepare('SELECT * FROM shop_orders WHERE stripe_session=?').get(o.id);
     if(!order||order.total!==o.amount_total||o.currency!=='eur')throw bad('Commande et paiement incohérents');
     if(order.status==='pending'){
      db.prepare("UPDATE shop_orders SET status='paid',payment_intent=? WHERE id=?").run(typeof o.payment_intent==='string'?o.payment_intent:null,order.id);
      for(const id of JSON.parse(order.items))db.prepare('INSERT OR IGNORE INTO shop_grants VALUES(?,?,?)').run(order.user_id,id,order.id);
     }
    }
    if(event.type==='checkout.session.async_payment_failed')db.prepare("UPDATE shop_orders SET status='failed' WHERE stripe_session=? AND status='pending'").run(o.id);
    if(event.type==='charge.refunded'&&o.refunded===true&&o.payment_intent)db.prepare("UPDATE shop_orders SET status='refunded' WHERE payment_intent=?").run(o.payment_intent);
    db.prepare('INSERT INTO shop_events VALUES(?)').run(event.id);db.exec('COMMIT');
   }catch(ex){db.exec('ROLLBACK');throw ex}return json(res,{received:true});
  }
  if(!url.startsWith('/api/shop/'))return false;
  if(!['GET','HEAD'].includes(req.method)&&!isAllowedOrigin(req))throw bad('Origine interdite',403);
  if(url==='/api/shop/catalog'&&req.method==='GET')return json(res,{products:products().filter(p=>p.active).map(pub),salesReady:ready(),registrationReady:true,legalReady:legal()});
  if(url==='/api/shop/me'&&req.method==='GET'){
   const u=me(req);return json(res,{user:u,owned:u?products().filter(p=>access(u,p)).map(pub):[],orders:u?db.prepare('SELECT id,total,status,created_at FROM shop_orders WHERE user_id=? ORDER BY created_at DESC').all(u.id):[]});
  }
  if(url==='/api/shop/register'&&req.method==='POST'){
   // Les inscriptions de test sont autorisées pendant la construction ; les ventes restent verrouillées par ready().
   limit(req,'register',6);const b=await data(req),mail=email(b.email),name=String(b.name||'').trim();
   if(name.length<2||name.length>100||b.privacyAccepted!==true)throw bad('Nom ou consentement invalide');if(db.prepare('SELECT 1 FROM shop_users WHERE email=?').get(mail))throw bad('Adresse déjà inscrite',409);
   const u={id:crypto.randomUUID(),name,email:mail};db.prepare('INSERT INTO shop_users (id,name,email,password) VALUES(?,?,?,?)').run(u.id,u.name,u.email,hashed(b.password));login(req,res,u);return json(res,{user:u},201);
  }
  if(url==='/api/shop/login'&&req.method==='POST'){
   limit(req,'login');const b=await data(req),u=db.prepare('SELECT * FROM shop_users WHERE email=?').get(email(b.email));
   if(!verify(b.password,u?.password||hashed('faux-mot-de-passe'))||!u)throw bad('Identifiants incorrects',401);if(u.suspended)throw bad('Ce compte est suspendu. Contactez le magazine.',403);login(req,res,u);return json(res,{user:{id:u.id,name:u.name,email:u.email}});
  }
  if(url==='/api/shop/profile'&&req.method==='PUT'){
   const u=required(req),b=await data(req),name=String(b.name||'').trim();
   if(name.length<2||name.length>100)throw bad('Le nom doit compter entre 2 et 100 caractères');
   db.prepare('UPDATE shop_users SET name=? WHERE id=?').run(name,u.id);
   return json(res,{user:{...u,name}});
  }
  if(url==='/api/shop/password'&&req.method==='PUT'){
   const u=required(req);limit(req,'password',8);const b=await data(req);
   const current=db.prepare('SELECT password FROM shop_users WHERE id=?').get(u.id);
   if(!verify(b.currentPassword,current?.password))throw bad('Mot de passe actuel incorrect',401);
   const updated=hashed(b.newPassword);
   if(verify(b.newPassword,current.password))throw bad('Le nouveau mot de passe doit être différent');
   db.prepare('UPDATE shop_users SET password=? WHERE id=?').run(updated,u.id);
   const t=cook(req);
   db.prepare('DELETE FROM shop_sessions WHERE user_id=? AND token_hash!=?').run(u.id,sha(t));
   return json(res,{ok:true});
  }
  if(url==='/api/shop/logout'&&req.method==='POST'){const t=cook(req);if(t)db.prepare('DELETE FROM shop_sessions WHERE token_hash=?').run(sha(t));res.setHeader('Set-Cookie',`bz_client=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure(req)}`);return json(res,{ok:true});}
  if(url==='/api/shop/checkout'&&req.method==='POST'){
   limit(req,'checkout');const u=required(req);if(!ready())throw bad('Paiements non activés',503);
   const b=await data(req);if(b.termsAccepted!==true||b.immediateAccess!==true||!Array.isArray(b.items)||!b.items.length||b.items.length>20||b.items.some(x=>typeof x!=='string'))throw bad('Panier ou consentement invalide');
   const items=[...new Set(b.items)].map(id=>db.prepare('SELECT * FROM shop_products WHERE id=?').get(id));
   if(items.some(p=>!p||!p.active||!p.private_file||access(u,p)))throw bad('Produit indisponible ou déjà acheté');
   const id=crypto.randomUUID(),total=items.reduce((n,p)=>n+p.price,0);db.prepare('INSERT INTO shop_orders(id,user_id,items,total) VALUES(?,?,?,?)').run(id,u.id,JSON.stringify(items.map(p=>p.id)),total);
   const origin=new URL(process.env.SITE_ORIGIN).origin,params=new URLSearchParams({mode:'payment',success_url:origin+'/mon-espace?paiement=retour',cancel_url:origin+'/boutique',customer_email:u.email,client_reference_id:id,'metadata[orderId]':id,'payment_method_types[0]':'card'});
   items.forEach((p,i)=>{params.set(`line_items[${i}][price_data][currency]`,'eur');params.set(`line_items[${i}][price_data][product_data][name]`,p.title);params.set(`line_items[${i}][price_data][unit_amount]`,String(p.price));params.set(`line_items[${i}][quantity]`,'1')});
   try{const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(20000)});const s=await response.json();if(!response.ok||!s.id||!s.url)throw bad('Erreur du prestataire de paiement',502);db.prepare('UPDATE shop_orders SET stripe_session=? WHERE id=?').run(s.id,id);return json(res,{url:s.url})}catch(e){db.prepare("UPDATE shop_orders SET status='failed' WHERE id=?").run(id);throw e}
  }
  const dl=url.match(/^\/api\/shop\/download\/([a-f0-9-]{36})$/);
  if(dl&&['GET','HEAD'].includes(req.method)){
   const u=required(req),p=db.prepare('SELECT * FROM shop_products WHERE id=?').get(dl[1]);if(!p||!access(u,p)||!/^[a-f0-9-]{36}\.(epub|pdf|mp3|m4a|mp4|webm)$/.test(p.private_file))throw bad('Fichier réservé à son acheteur',403);
   const reading=new URL(req.url,'http://localhost').searchParams.has('lire');
   if(p.private_file.endsWith('.epub')&&!reading)throw bad('Ce livre EPUB se lit dans votre espace personnel.',403);
   res.setHeader('Cache-Control','private, no-store');if(!reading)res.setHeader('Content-Disposition',`attachment; filename="${p.private_file}"`);return staticFile(res,dir,'/'+p.private_file,req);
  }
  if(url==='/api/shop/admin'&&req.method==='GET'){
   if(!requireAdmin(req,res))return;return json(res,{products:products().map(pub),clients:db.prepare('SELECT id,name,email,suspended FROM shop_users ORDER BY rowid DESC LIMIT 500').all(),orders:db.prepare('SELECT o.id,o.total,o.status,o.created_at,u.email FROM shop_orders o JOIN shop_users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 500').all()});
  }
  const memberAction=url.match(/^\/api\/shop\/admin\/members\/([a-f0-9-]{36})\/status$/);
  if(memberAction&&req.method==='PUT'){
   if(!requireAdmin(req,res))return;
   const b=await data(req);
   if(typeof b.suspended!=='boolean')throw bad('Statut invalide');
   const user=db.prepare('SELECT id FROM shop_users WHERE id=?').get(memberAction[1]);
   if(!user)throw bad('Membre introuvable',404);
   db.prepare('UPDATE shop_users SET suspended=? WHERE id=?').run(b.suspended?1:0,user.id);
   if(b.suspended)db.prepare('DELETE FROM shop_sessions WHERE user_id=?').run(user.id);
   return json(res,{ok:true});
  }
  const memberDelete=url.match(/^\/api\/shop\/admin\/members\/([a-f0-9-]{36})$/);
  if(memberDelete&&req.method==='DELETE'){
   if(!requireAdmin(req,res))return;
   const id=memberDelete[1],user=db.prepare('SELECT id,name FROM shop_users WHERE id=?').get(id);
   if(!user)throw bad('Membre introuvable',404);
   if(db.prepare('SELECT 1 FROM shop_orders WHERE user_id=? LIMIT 1').get(id))
    throw bad('Ce membre possède un historique de commandes. Suspendez son compte : sa suppression nécessite une procédure de conservation des justificatifs.',409);
   db.exec('BEGIN IMMEDIATE');
   try{
    db.prepare('DELETE FROM shop_sessions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM shop_grants WHERE user_id=?').run(id);
    db.prepare('DELETE FROM shop_users WHERE id=?').run(id);
    db.exec('COMMIT');
   }catch(err){db.exec('ROLLBACK');throw err;}
   return json(res,{ok:true});
  }
  if(url==='/api/shop/admin/products'&&req.method==='POST'){
   if(!requireAdmin(req,res))return;const b=await data(req);valid(b);const id=crypto.randomUUID();db.prepare('INSERT INTO shop_products(id,title,description,kind,price,cover,active) VALUES(?,?,?,?,?,?,?)').run(id,b.title.trim(),b.description.trim(),b.kind,b.price,cover(b.cover),b.active?1:0);return json(res,{id},201);
  }
  const prod=url.match(/^\/api\/shop\/admin\/products\/([a-f0-9-]{36})$/);
  if(prod&&req.method==='PUT'){
   if(!requireAdmin(req,res))return;const b=await data(req);valid(b);db.prepare('UPDATE shop_products SET title=?,description=?,kind=?,price=?,cover=?,active=? WHERE id=?').run(b.title.trim(),b.description.trim(),b.kind,b.price,cover(b.cover),b.active?1:0,prod[1]);return json(res,{ok:true});
  }
  if(prod&&req.method==='DELETE'){
   if(!requireAdmin(req,res))return;if(db.prepare('SELECT 1 FROM shop_grants WHERE product_id=?').get(prod[1])||db.prepare('SELECT 1 FROM shop_orders WHERE items LIKE ?').get('%'+prod[1]+'%'))throw bad('Des clients possèdent ce produit : masquez-le',409);db.prepare('DELETE FROM shop_products WHERE id=?').run(prod[1]);return json(res,{ok:true});
  }
  const upload=url.match(/^\/api\/shop\/admin\/upload\/([a-f0-9-]{36})$/);
  if(upload&&req.method==='POST'){
   if(!requireAdmin(req,res))return;if(!db.prepare('SELECT id FROM shop_products WHERE id=?').get(upload[1]))throw bad('Produit introuvable',404);
   const ext=path.extname(decodeURIComponent(String(req.headers['x-upload-name']||''))).toLowerCase(),size={'.epub':60,'.pdf':60,'.mp3':100,'.m4a':100,'.mp4':200,'.webm':200}[ext];if(!size)throw bad('Fichier EPUB, PDF, MP3, M4A, MP4 ou WebM attendu',415);
   const filename=crypto.randomUUID()+ext,temp=path.join(dir,'.'+filename+'.part'),dest=path.join(dir,filename);
   let fd,total=0,head=Buffer.alloc(0);
   try{
    fd=await fs.promises.open(temp,'wx',0o600);
    for await(const chunk of req){
     total+=chunk.length;
     if(total>size*1024*1024)throw bad('Fichier trop volumineux ('+size+' Mo maximum)',413);
     if(head.length<32)head=Buffer.concat([head,chunk.subarray(0,32-head.length)]);
     let offset=0;
     while(offset<chunk.length){const written=await fd.write(chunk,offset,chunk.length-offset);offset+=written.bytesWritten;}
    }
    const ascii=head.toString('ascii',0,8);
    const valid=(ext==='.epub'&&ascii.startsWith('PK'))||(ext==='.pdf'&&ascii.startsWith('%PDF'))||(ext==='.mp3'&&(ascii.startsWith('ID3')||(head[0]===255&&(head[1]&224)===224)))||(ext==='.webm'&&head.subarray(0,4).equals(Buffer.from([26,69,223,163])))||(['.mp4','.m4a'].includes(ext)&&ascii.slice(4,8)==='ftyp');
    if(!total||!valid)throw bad('Format du fichier non reconnu',415);
    await fd.close();fd=null;
    await fs.promises.rename(temp,dest);
    db.prepare('UPDATE shop_products SET private_file=? WHERE id=?').run(filename,upload[1]);
    return json(res,{ok:true},201);
   }catch(error){
    if(fd)await fd.close().catch(()=>{});
    await fs.promises.unlink(temp).catch(()=>{});
    throw error;
   }
  }
  if(url==='/api/shop/admin/grant'&&req.method==='POST'){
   if(!requireAdmin(req,res))return;const b=await data(req),u=db.prepare('SELECT id FROM shop_users WHERE email=?').get(email(b.email)),p=db.prepare('SELECT id FROM shop_products WHERE id=?').get(b.productId);if(!u||!p)throw bad('Compte ou produit introuvable',404);db.prepare('INSERT OR IGNORE INTO shop_grants VALUES(?,?,NULL)').run(u.id,p.id);return json(res,{ok:true});
  }
  throw bad('Route boutique inconnue',404);
 };
}
