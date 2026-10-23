export function createPages({db,readJson,json,requireAdmin}){
 db.exec(`CREATE TABLE IF NOT EXISTS magazine_pages(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',parent_id INTEGER,nav_section TEXT NOT NULL DEFAULT 'articles',status TEXT NOT NULL DEFAULT 'draft',sort_order INTEGER NOT NULL DEFAULT 100,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
 const clean=(s,n)=>String(s??'').trim().slice(0,n);
 const bad=(message,status=400)=>Object.assign(new Error(message),{status});
 const slug=s=>clean(s,150).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
 return async(req,res,url)=>{
  const p=url.pathname,m=req.method;
  if(m!=='GET'&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host}catch{}if(origin!==req.headers.host)throw bad('Origine non autorisée',403)}
  if(p==='/api/pages'&&m==='GET')return json(res,{pages:db.prepare("SELECT id,slug,title,parent_id,nav_section,sort_order FROM magazine_pages WHERE status='published' ORDER BY sort_order,id").all()});
  if(p.startsWith('/api/pages/')&&m==='GET'){const item=db.prepare("SELECT * FROM magazine_pages WHERE slug=? AND status='published'").get(decodeURIComponent(p.slice('/api/pages/'.length)));return item?json(res,{page:item}):json(res,{error:'Page introuvable'},404)}
  if(p==='/api/admin/pages'&&m==='GET'){if(!requireAdmin(req,res))return;return json(res,{pages:db.prepare('SELECT * FROM magazine_pages ORDER BY sort_order,id').all()})}
  if(p==='/api/admin/pages'&&m==='POST'){if(!requireAdmin(req,res))return;return save(await readJson(req),null,res)}
  const match=p.match(/^\/api\/admin\/pages\/(\d+)$/);if(match&&['PUT','DELETE'].includes(m)){
    if(!requireAdmin(req,res))return;const id=Number(match[1]);
    if(m==='DELETE'){if(db.prepare('SELECT 1 FROM magazine_pages WHERE parent_id=?').get(id))throw bad('Déplacez les sous-pages avant suppression',409);db.prepare('DELETE FROM magazine_pages WHERE id=?').run(id);return json(res,{ok:true})}
    return save(await readJson(req),id,res);
  }
  return json(res,{error:'Route inconnue'},404);
  function save(b,id,res){const creating=id==null;const title=clean(b.title,160),body=clean(b.body,100000),requested=slug(b.slug||title),parent=b.parent_id?Number(b.parent_id):null;
   if(!title||!requested)throw bad('Titre de page obligatoire');if(parent!==null){if(parent===id)throw bad('Une page ne peut pas être sa propre sous-page');let ancestor=parent;const seen=new Set();while(ancestor!=null){if(seen.has(ancestor)||ancestor===id)throw bad('Hiérarchie circulaire interdite');seen.add(ancestor);const r=db.prepare('SELECT parent_id FROM magazine_pages WHERE id=?').get(ancestor);if(!r)throw bad('Page parente introuvable');ancestor=r.parent_id}}
   const nav=['home','articles','dossiers','podcasts','livres','about'].includes(b.nav_section)?b.nav_section:'articles',status=b.status==='published'?'published':'draft';
   const order=Number.isInteger(Number(b.sort_order))?Number(b.sort_order):100;
   try{if(id){if(!db.prepare('SELECT id FROM magazine_pages WHERE id=?').get(id))throw bad('Page introuvable',404);db.prepare('UPDATE magazine_pages SET slug=?,title=?,body=?,parent_id=?,nav_section=?,status=?,sort_order=? WHERE id=?').run(requested,title,body,parent,nav,status,order,id)}
    else {const r=db.prepare('INSERT INTO magazine_pages(slug,title,body,parent_id,nav_section,status,sort_order) VALUES(?,?,?,?,?,?,?)').run(requested,title,body,parent,nav,status,order);id=Number(r.lastInsertRowid)}
   }catch(e){if(e.code==='ERR_SQLITE_ERROR'&&/UNIQUE/.test(e.message))throw bad('Cette adresse de page existe déjà',409);throw e}
   return json(res,{page:db.prepare('SELECT * FROM magazine_pages WHERE id=?').get(id)},creating?201:200)
  }
 };
}
