import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('membres, favoris, commentaires, médias et newsletter',async()=>{
 const root=path.resolve(import.meta.dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bz-test-'));
 const port=20000+Math.floor(Math.random()*20000),base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['server-v3.mjs'],{cwd:root,env:{...process.env,DATA_DIR:dir,PORT:String(port),ADMIN_PASSWORD:'test-administration-strong-2026'},stdio:['ignore','pipe','pipe']});
 let stderr='';server.stderr.on('data',b=>stderr+=b.toString());
 const call=async(p,method='GET',data,auth='')=>{const r=await fetch(base+p,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookies:r.headers.get('set-cookie')||''}};
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await call('/api/health')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'server started: '+stderr);
  const registered=await call('/api/shop/register','POST',{name:'Bela test',email:'test@example.org',password:'An-Example-Password-2026',privacyAccepted:true});
  assert.equal(registered.status,201,JSON.stringify(registered.body));const memberCookie=registered.cookies.split(';')[0];
  const posts=await call('/api/posts');const id=posts.body.posts[0].id;
  assert.equal((await call('/api/community/favorites/'+id,'PUT',null,memberCookie)).status,200);
  assert.deepEqual((await call('/api/community/favorites','GET',null,memberCookie)).body.ids,[id]);
  const comment=await call('/api/community/comments','POST',{post_id:id,body:'Un commentaire à modérer'},memberCookie);assert.equal(comment.status,201);
  assert.equal((await call('/api/community/comments?post='+id)).body.comments.length,0);
  const adminLogin=await call('/api/auth/login','POST',{password:'test-administration-strong-2026'});assert.equal(adminLogin.status,200);const adminCookie=adminLogin.cookies.split(';')[0];
  const pending=(await call('/api/community/admin/comments','GET',null,adminCookie)).body.comments[0];assert.equal(pending.status,'pending');
  assert.equal((await call('/api/community/admin/comments/'+pending.id,'PATCH',{status:'approved'},adminCookie)).status,200);
  assert.equal((await call('/api/community/comments?post='+id)).body.comments.length,1);
  const folder=await call('/api/community/admin/folders','POST',{name:'Podcasts'},adminCookie);assert.equal(folder.status,201);
  const sub=await call('/api/community/admin/folders','POST',{name:'Série',parent_id:folder.body.id},adminCookie);assert.equal(sub.status,201);
  assert.equal((await call('/api/community/admin/folders','GET',null,adminCookie)).body.folders.length,2);
  const pageA=await call('/api/admin/pages','POST',{title:'Notre démarche',nav_section:'about',status:'published',body:'## Présentation\nBienvenue.'},adminCookie);
  assert.equal(pageA.status,201,JSON.stringify(pageA.body));
  const pageB=await call('/api/admin/pages','POST',{title:'Nos principes',nav_section:'about',parent_id:pageA.body.page.id,status:'published',body:'Voir [[page:notre-demarche|Notre démarche]].'},adminCookie);
  assert.equal(pageB.status,201);
  assert.equal((await call('/api/pages')).body.pages.length,2);
  assert.equal((await call('/api/pages/nos-principes')).body.page.parent_id,pageA.body.page.id);
  assert.equal((await call('/api/admin/pages/'+pageA.body.page.id,'DELETE',null,adminCookie)).status,409);
  assert.equal((await call('/api/admin/pages/'+pageA.body.page.id,'PUT',{title:'Notre démarche',status:'published',parent_id:pageB.body.page.id},adminCookie)).status,400);
  const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
  const upload=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:adminCookie,'Content-Type':'image/png','X-Upload-Name':encodeURIComponent('couverture originale.png')},body:png});
  assert.equal(upload.status,201);const media=await upload.json();
  const beforeRename=await call('/api/community/admin/media','GET',null,adminCookie);
  assert.equal(beforeRename.body.files[0].original_name,'couverture originale.png');
  assert.equal((await call('/api/community/admin/media','PUT',{url:media.url,original_name:'couverture originale.png',folder_id:folder.body.id},adminCookie)).status,200);
  const listing=await call('/api/community/admin/media','GET',null,adminCookie);
  assert.equal(listing.body.files[0].original_name,'couverture originale.png');
  assert.equal(listing.body.files[0].folder_id,folder.body.id);
  const subscribe=await call('/api/community/newsletter','POST',{email:'reader@example.com'});assert.equal(subscribe.status,200);
  assert.equal((await call('/api/community/admin/newsletter','GET',null,adminCookie)).body.subscribers[0].subscribed,1);
  const link=new URL(subscribe.body.unsubscribe_url,base);
  assert.equal((await call('/api/community/newsletter/unsubscribe','POST',{email:link.searchParams.get('email'),token:link.searchParams.get('token')})).status,200);
  assert.equal((await call('/api/community/admin/newsletter','GET',null,adminCookie)).body.subscribers[0].subscribed,0);
  assert.equal((await call('/api/community/admin/newsletter','POST',{subject:'Bonjour',body:'Texte de test suffisamment long'},adminCookie)).status,503);
 }finally{server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(dir,{recursive:true,force:true})}
});
