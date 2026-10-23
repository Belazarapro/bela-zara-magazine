const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>(n/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
let registrationReady=false;let products=[],account={user:null,owned:[],orders:[]},admin={products:[],clients:[],orders:[]};
async function api(url,method='GET',body){const headers=body instanceof Blob?{'Content-Type':'application/octet-stream','X-Upload-Name':encodeURIComponent(body.name)}:{'Content-Type':'application/json'};const response=await fetch(url,{method,headers,body:body instanceof Blob?body:body?JSON.stringify(body):undefined});let data;try{data=await response.json()}catch{throw Error(response.ok?'Le serveur a renvoyé une réponse inattendue. Vérifiez le fichier et réessayez.':`Le serveur a interrompu la requête (HTTP ${response.status}). ${response.status===502||response.status===503?'Service temporairement indisponible ou téléversement interrompu.':'Réessayez après vérification.'}`)};if(!response.ok)throw Error(data.error||`Erreur du serveur (HTTP ${response.status})`);return data}
export async function loadShop(){const [a,b]=await Promise.all([api('/api/shop/catalog'),api('/api/shop/me')]);products=a.products;registrationReady=!!a.registrationReady;account=b}
export async function loadShopAdmin(){admin=await api('/api/shop/admin')}
export function boutique(){document.title='Boutique | Bela Zara';return `<section class="page"><span class="eyebrow">LES PUBLICATIONS DE BELA ZARA</span><h1 class="page-heading">LA <span>BOUTIQUE</span></h1><p class="page-intro">Découvrez les livres numériques, podcasts et formations de Bela Zara. Les ebooks se lisent directement dans votre bibliothèque personnelle.</p>${products.length?`<div class="shop-grid">${products.map(p=>`<article class="shop-card">${p.cover?`<img src="${esc(p.cover)}" alt="Couverture">`:'<div class="shop-fallback">BELA ZARA<br>ÉDITIONS</div>'}<small>${esc(p.kind.toUpperCase())}</small><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><strong>${euro(p.price)}</strong>${account.owned.some(x=>x.id===p.id)?'<a data-link class="red-button" href="/mon-espace">DÉJÀ ACHETÉ →</a>':p.can_buy?`<button class="red-button" data-buy="${p.id}">ACHETER →</button>`:`<button class="red-button" type="button" disabled aria-disabled="true" title="Paiements en préparation">ACHETER (BIENTÔT)</button><span class="upload-hint">Les paiements ne sont pas encore activés. Aucun achat réel possible.</span>`}</article>`).join('')}</div>`:'<div class="empty-state">Les premiers livres et formations apparaîtront ici dès leur publication.</div>'}</section>`}
export function espace(){document.title='Mon espace | Bela Zara';if(!account.user)return `<section class="page"><span class="eyebrow">ESPACE CLIENT INDÉPENDANT</span><h1 class="page-heading">MON <span>ESPACE</span></h1><p class="page-intro">Connectez-vous ou créez votre compte Bela Zara Magazine.</p><div class="shop-auth"><form data-shop-form="login" class="admin-panel"><h2>CONNEXION</h2><label>Adresse e-mail<input name="email" type="email" required autocomplete="email"></label><label>Mot de passe<input name="password" type="password" required></label><button class="red-button">SE CONNECTER</button></form><form data-shop-form="register" class="admin-panel"><h2>CRÉER UN COMPTE</h2>${!registrationReady?'<p class="error-box">Les inscriptions sont temporairement indisponibles : les informations légales du magazine doivent d’abord être publiées.</p>':''}<label>Votre nom<input name="name" minlength="2" required></label><label>Adresse e-mail<input type="email" name="email" required></label><label>Mot de passe, 12 caractères minimum<input name="password" type="password" minlength="12" required></label><p class="upload-hint">Espace en construction. Les données saisies (nom, e-mail, mot de passe protégé) servent à gérer votre compte. N’utilisez pas de données personnelles réelles pour les essais tant que la politique de confidentialité n’est pas finalisée.</p><label class="checkbox-inline"><input name="privacyAccepted" type="checkbox" required> Je comprends que mes informations sont utilisées pour créer et gérer mon compte. <a data-link href="/confidentialite">Informations de confidentialité</a>.</label><button class="red-button">CRÉER MON COMPTE</button></form></div></section>`;
return `<section class="page"><span class="eyebrow">BIBLIOTHÈQUE PRIVÉE</span><h1 class="page-heading">MON <span>ESPACE</span></h1><div class="action-row">Bienvenue, ${esc(account.user.name)} <button class="secondary-button" data-shop-logout>DÉCONNEXION</button></div><h2>MES LIVRES ET FORMATIONS (${account.owned.length})</h2>${account.owned.length?`<div class="shop-grid">${account.owned.map(p=>`<div class="shop-card"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><a class="red-button" data-link href="/bibliotheque/${p.id}">${p.kind==='ebook'?'OUVRIR MON LIVRE':p.kind==='audio'?'ÉCOUTER MES ÉPISODES':'VOIR MA FORMATION'} →</a></div>`).join('')}</div>`:'<p>Aucun achat dans votre bibliothèque.</p>'}<h2>MON PROFIL</h2><form data-shop-form="profile" class="admin-panel"><label>Nom affiché<input name="name" required minlength="2" maxlength="100" value="${esc(account.user.name)}"></label><p>Adresse e-mail : <strong>${esc(account.user.email)}</strong></p><button class="red-button">ENREGISTRER MON PROFIL</button></form><h2>SÉCURITÉ DU COMPTE</h2><form data-shop-form="password" class="admin-panel"><label>Mot de passe actuel<input type="password" name="currentPassword" required autocomplete="current-password"></label><label>Nouveau mot de passe (12 caractères minimum)<input type="password" name="newPassword" minlength="12" required autocomplete="new-password"></label><button class="red-button">MODIFIER MON MOT DE PASSE</button></form><h2>MES COMMANDES</h2>${account.orders.length?account.orders.map(o=>`<p>${esc(o.created_at)} · ${euro(o.total)} · ${esc(o.status)}</p>`).join(''):'<p>Aucune commande.</p>'}</section>`}
export function shopAdmin(){return `<div class="admin-panel"><div class="admin-head"><h2>BOUTIQUE (${admin.products.length} PRODUITS)</h2><button class="red-button" data-new-product>+ NOUVEAU PRODUIT</button></div><p class="admin-intro">Téléversez les fichiers payants depuis « FICHIER PRIVÉ ». Les EPUB seront réservés au lecteur des clients, sans bouton de téléchargement.</p>${admin.products.map(p=>`<div class="post-admin"><div><strong>${esc(p.title)}</strong><br><small>${euro(p.price)} · ${esc(p.kind)} · ${p.has_file?'Fichier prêt':'Fichier manquant'} · ${p.active?'VISIBLE':'MASQUÉ'}</small></div><div class="post-admin-actions"><button data-edit-product="${p.id}" class="small-button">MODIFIER</button><button data-upload-product="${p.id}" class="small-button">FICHIER PRIVÉ</button><button data-delete-product="${p.id}" class="small-button danger">SUPPRIMER</button></div></div>`).join('')}<input id="private-product-file" hidden type="file" accept=".epub,.pdf,.mp3,.m4a,.mp4,.webm"><h2>CLIENTS (${admin.clients.length})</h2>${admin.clients.map(u=>`<p>${esc(u.name)} · ${esc(u.email)}</p>`).join('')}<h2>COMMANDES (${admin.orders.length})</h2>${admin.orders.map(o=>`<p>${esc(o.email)} · ${euro(o.total)} · ${esc(o.status)}</p>`).join('')}<h2>ATTRIBUER UN LIVRE À UN CLIENT</h2><form data-shop-form="grant" class="form-grid"><label>Adresse e-mail<input name="email" type="email" required></label><label>Produit<select name="productId">${admin.products.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></label><button class="red-button">ATTRIBUER L’ACCÈS</button></form></div>`}
function productForm(p={}){return `<div class="admin-panel"><h2>${p.id?'MODIFIER LE':'NOUVEAU'} PRODUIT</h2><form data-shop-form="product" data-id="${p.id||''}"><label>Titre<input name="title" minlength="2" maxlength="150" required value="${esc(p.title||'')}"></label><label>Description<textarea name="description" rows="5">${esc(p.description||'')}</textarea></label><label>Type<select name="kind">${[['ebook','EPUB ou PDF'],['audio','Audio'],['video','Vidéo'],['formation','Formation vidéo']].map(([k,v])=>`<option value="${k}" ${p.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Prix en euros<input name="priceEuros" type="number" min="0.50" max="100000" step="0.01" required value="${p.price==null?'9.90':(p.price/100).toFixed(2)}"></label><div class="shop-product-upload"><h3>IMAGE DU PRODUIT</h3><input id="shop-cover-file" name="coverFile" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" hidden><button type="button" class="secondary-button" data-choose-shop-file="coverFile">TÉLÉVERSER UNE IMAGE</button><p class="upload-hint" data-selected-shop-file="coverFile">JPG, PNG, WebP ou GIF (12 Mo maximum)</p></div>${p.cover?`<div class="shop-cover-preview"><img src="${esc(p.cover)}" alt="Couverture actuelle" style="max-width:160px;max-height:220px;object-fit:contain"><p>Couverture actuelle. Choisissez un autre fichier pour la remplacer.</p></div>`:'' }<label>Ou adresse d’une image existante (facultatif)<input name="cover" value="${esc(p.cover||'')}" placeholder="/uploads/... ou https://..."></label><div class="shop-product-upload"><h3>FICHIER DU PRODUIT</h3><p class="upload-hint">Téléversez directement votre ebook, podcast ou formation depuis cette fiche. Le fichier sera importé au moment où vous enregistrerez le produit.</p>${p.has_file?`<p class="upload-hint">✓ Fichier existant : ${esc(p.file_type.toUpperCase())}. Vous pouvez le remplacer ci-dessous.</p>`:'<p class="upload-hint">Aucun fichier numérique associé pour le moment.</p>'}<input id="shop-product-file" type="file" name="productFile" accept=".epub,.pdf,.mp3,.m4a,.mp4,.webm" hidden><button type="button" class="secondary-button" data-choose-shop-file="productFile">TÉLÉVERSER UN FICHIER</button><p class="upload-hint" data-selected-shop-file="productFile">EPUB/PDF : 60 Mo · Audio : 100 Mo · Vidéo : 200 Mo</p></div><div class="shop-product-upload"><h3>PLAYLIST AUDIO / VIDÉO</h3><p class="upload-hint">Ajoutez plusieurs pistes ou leçons. Les fichiers sont transférés dans l’ordre choisi, depuis cette fiche. Audio : MP3/M4A ; vidéo : MP4/WebM. Pour les ebooks, le sommaire est lu directement depuis le fichier EPUB.</p><input id="shop-playlist-files" type="file" name="playlistFiles" accept=".mp3,.m4a,.mp4,.webm" multiple hidden><button type="button" class="secondary-button" data-choose-shop-file="playlistFiles">+ AJOUTER DES ÉPISODES / LEÇONS</button><p class="upload-hint" data-selected-shop-file="playlistFiles">Aucune piste supplémentaire sélectionnée</p>${p.tracks?.length?`<div class="shop-track-list"><h4>ÉPISODES ENREGISTRÉS (${p.tracks.length})</h4>${p.tracks.map(t=>`<div class="shop-track-row"><span>${esc(t.title)}</span><button type="button" class="small-button" data-track-rename="${t.id}">RENOMMER</button><button type="button" class="small-button danger" data-track-delete="${t.id}">SUPPRIMER</button></div>`).join('')}</div>`:''}</div><label class="checkbox-inline"><input type="checkbox" name="active" ${p.active?'checked':''}> Afficher dans la boutique</label><div class="action-row"><button type="submit" class="red-button">ENREGISTRER ET TÉLÉVERSER</button><button type="button" class="secondary-button" data-shop-back>RETOUR</button></div></form></div>`}
let readerLoader;async function epubLib(){if(window.ePub)return;readerLoader??=(async()=>{for(const url of ['/jszip.min.js','/epub.min.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})})();return readerLoader}
export async function shopClick(event,{navigate,refresh,toast}){
const b=event.target.closest('[data-buy],[data-shop-logout],[data-shop-read],[data-shop-play],[data-new-product],[data-edit-product],[data-upload-product],[data-delete-product],[data-shop-back],[data-choose-shop-file],[data-track-delete],[data-track-rename]');if(!b)return false;
try{
 if(b.dataset.trackDelete){
  if(!confirm('Supprimer définitivement cet épisode de la playlist ?'))return true;
  const productId=document.querySelector('form[data-shop-form="product"]')?.dataset.id;
  await api('/api/shop/admin/tracks/'+b.dataset.trackDelete,'DELETE');
  await loadShopAdmin();
  const product=admin.products.find(p=>p.id===productId);
  document.querySelector('#admin-content').innerHTML=product?productForm(product):shopAdmin();
  toast('Épisode supprimé');return true;
 }
 if(b.dataset.trackRename){
  const productId=document.querySelector('form[data-shop-form="product"]')?.dataset.id;
  const product=admin.products.find(p=>p.id===productId);
  const track=product?.tracks?.find(t=>t.id===b.dataset.trackRename);
  const title=prompt('Nouveau titre de l’épisode',track?.title||'');
  if(title===null)return true;
  if(!title.trim()){toast('Le titre ne peut pas être vide');return true}
  await api('/api/shop/admin/tracks/'+b.dataset.trackRename,'PUT',{title:title.trim()});
  await loadShopAdmin();
  document.querySelector('#admin-content').innerHTML=productForm(admin.products.find(p=>p.id===productId));
  toast('Titre modifié');return true;
 }
 if(b.dataset.chooseShopFile){const form=b.closest('form[data-shop-form="product"]');form?.elements[b.dataset.chooseShopFile]?.click();return true;}
 if(b.dataset.buy){if(!account.user){navigate('/mon-espace');toast('Connectez-vous pour acheter');return true}const agreed=confirm('Confirmez-vous les conditions de vente et votre demande d’accès immédiat au contenu numérique ?');if(!agreed)return true;const response=await api('/api/shop/checkout','POST',{items:[b.dataset.buy],termsAccepted:true,immediateAccess:true});location.assign(response.url)}
 else if(b.hasAttribute('data-shop-logout')){await api('/api/shop/logout','POST');await refresh()}
 else if(b.dataset.shopRead){
  const box=document.getElementById('reader-'+b.dataset.shopRead);
  if(!box)return true;
  box.hidden=false;
  if(b.dataset.format==='pdf'){
   box.innerHTML=`<div class="shop-reader-toolbar"><strong>LECTURE DU PDF</strong><a class="secondary-button" href="/api/shop/download/${b.dataset.shopRead}?lire=1" target="_blank" rel="noopener">OUVRIR EN GRAND →</a></div><iframe title="Lecture du PDF" class="shop-pdf" src="/api/shop/download/${b.dataset.shopRead}?lire=1"></iframe>`;
   return true;
  }
  if(b.dataset.format!=='epub')throw Error('Le fichier de ce livre n’est pas un EPUB ou PDF reconnu.');
  box.innerHTML='<p>Chargement de votre EPUB complet…</p>';
  await epubLib();
  const book=window.ePub('/api/shop/download/'+b.dataset.shopRead+'?lire=1');
  await book.ready;
  box.innerHTML=`<div class="shop-reader-toolbar">
   <label for="toc-${b.dataset.shopRead}">SOMMAIRE</label>
   <select id="toc-${b.dataset.shopRead}" class="shop-toc"><option value="">Choisir un chapitre</option></select>
   <button type="button" class="secondary-button" data-prev>← PRÉCÉDENT</button>
   <button type="button" class="secondary-button" data-next>SUIVANT →</button>
   </div><div class="shop-book" tabindex="0" aria-label="Contenu complet du livre"></div>
   <p class="upload-hint">Faites défiler le livre pour lire tout le chapitre. Utilisez le sommaire pour accéder aux autres parties.</p>`;
  const viewport=box.querySelector('.shop-book');
  const rendition=book.renderTo(viewport,{width:'100%',height:'70vh',flow:'scrolled-doc',spread:'none'});
  const toc=box.querySelector('.shop-toc');
  function addChapters(items,depth=0){
   for(const item of items||[]){
    if(item.href){
     const option=document.createElement('option');
     option.value=item.href;option.textContent='　'.repeat(Math.min(depth,4))+String(item.label||'Chapitre');
     toc.appendChild(option);
    }
    if(item.subitems?.length)addChapters(item.subitems,depth+1);
   }
  }
  try{const nav=await book.loaded.navigation;addChapters(nav?.toc||book.navigation?.toc||[])}catch(err){console.warn('Sommaire EPUB indisponible',err)}
  toc.addEventListener('change',()=>{if(toc.value)rendition.display(toc.value).catch(err=>toast('Chapitre inaccessible : '+err.message))});
  for(const key of ['prev','next']){
   box.querySelector('[data-'+key+']').addEventListener('click',()=>rendition[key]().catch(err=>toast('Navigation impossible : '+err.message)));
  }
  rendition.on('linkClicked',href=>{
   const link=String(href||'');
   if(/^https?:\/\//i.test(link)){
    try{window.open(link,'_blank','noopener,noreferrer')}catch{}
   }else if(link&&!/^(?:javascript:|data:)/i.test(link)){
    rendition.display(link).catch(()=>{});
   }
  });
  rendition.on('relocated',location=>{
   const chapter=location?.start?.href;
   if(chapter){const match=[...toc.options].find(o=>o.value&&o.value.split('#')[0]===chapter.split('#')[0]);if(match)toc.value=match.value;}
  });
  await rendition.display();
 }
 else if(b.dataset.shopPlay){const box=document.getElementById('reader-'+b.dataset.shopPlay);box.hidden=false;box.innerHTML=b.dataset.kind==='audio'?`<audio controls src="/api/shop/download/${b.dataset.shopPlay}?lire=1"></audio>`:`<video controls playsinline src="/api/shop/download/${b.dataset.shopPlay}?lire=1"></video>`}
 else if(b.hasAttribute('data-new-product'))document.querySelector('#admin-content').innerHTML=productForm();
 else if(b.dataset.editProduct)document.querySelector('#admin-content').innerHTML=productForm(admin.products.find(p=>p.id===b.dataset.editProduct));
 else if(b.dataset.uploadProduct){const input=document.getElementById('private-product-file');input.dataset.id=b.dataset.uploadProduct;input.click()}
 else if(b.dataset.deleteProduct){if(confirm('Supprimer ce produit ?')){await api('/api/shop/admin/products/'+b.dataset.deleteProduct,'DELETE');await loadShopAdmin();document.querySelector('#admin-content').innerHTML=shopAdmin()}}
 else if(b.hasAttribute('data-shop-back'))document.querySelector('#admin-content').innerHTML=shopAdmin();
}catch(ex){toast(ex.message)}return true}
export async function shopSubmit(event,{refresh,toast}){const f=event.target;if(!f.matches('[data-shop-form]'))return false;event.preventDefault();const b=Object.fromEntries(new FormData(f));try{switch(f.dataset.shopForm){case 'login':await api('/api/shop/login','POST',b);await refresh();break;case 'register':await api('/api/shop/register','POST',{...b,privacyAccepted:f.elements.privacyAccepted.checked});await refresh();break;case 'profile':await api('/api/shop/profile','PUT',b);await refresh();toast('Profil mis à jour');break;case 'password':await api('/api/shop/password','PUT',b);f.reset();toast('Mot de passe modifié. Les autres sessions ont été fermées.');break;case 'grant':await api('/api/shop/admin/grant','POST',b);toast('Accès accordé');break;case 'product':{
 const price=Math.round(Number(b.priceEuros)*100);
 if(!Number.isSafeInteger(price)||price<50)throw Error('Prix invalide');
 const coverFile=f.elements.coverFile?.files?.[0];
 if(coverFile){
  const ext=coverFile.name.split('.').pop().toLowerCase();
  if(!['jpg','jpeg','png','webp','gif'].includes(ext))throw Error('La couverture doit être une image JPG, PNG, WebP ou GIF.');
  if(coverFile.size>12*1024*1024)throw Error('Image de couverture trop volumineuse (12 Mo maximum).');
 }
 const playlistFiles=[...(f.elements.playlistFiles?.files||[])];
 if(playlistFiles.length>20)throw Error('20 pistes maximum par envoi.');
 for(const mediaFile of playlistFiles){
  const ext=mediaFile.name.split('.').pop().toLowerCase();
  const allowedTracks=b.kind==='audio'?['mp3','m4a']:['mp4','webm'];
  if(!allowedTracks.includes(ext))throw Error('La playlist doit contenir des fichiers '+allowedTracks.join(' ou ')+'.');
  if(mediaFile.size>(b.kind==='audio'?100:200)*1024*1024)throw Error('Un fichier de la playlist dépasse la taille autorisée.');
 }
 const file=f.elements.productFile?.files?.[0];
 const allowed={ebook:['epub','pdf'],audio:['mp3','m4a'],video:['mp4','webm'],formation:['mp4','webm']};
 if(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(!allowed[b.kind]?.includes(ext))throw Error('Type de fichier incompatible avec ce produit.');
  const max=ext==='epub'||ext==='pdf'?60:ext==='mp3'||ext==='m4a'?100:200;
  if(file.size>max*1024*1024)throw Error('Fichier trop volumineux (maximum '+max+' Mo).');
 }
 const submit=f.querySelector('button[type="submit"],button:not([type])');
 if(submit)submit.disabled=true;
 try{
  let cover=b.cover;
  if(coverFile){
   toast('Import de la couverture en cours…');
   const uploaded=await api('/api/admin/upload','POST',coverFile);
   if(!uploaded.url)throw Error('Adresse de couverture non reçue après import.');
   cover=uploaded.url;
  }
  const result=await api('/api/shop/admin/products'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',{title:b.title,description:b.description,kind:b.kind,price,cover,active:f.elements.active.checked});
  const id=f.dataset.id||result.id;
  if(file){
   toast('Produit enregistré. Import du fichier en cours…');
   try{await api('/api/shop/admin/upload/'+id,'POST',file)}
   catch(uploadError){
    await loadShopAdmin();document.querySelector('#admin-content').innerHTML=shopAdmin();
    throw Error('Produit enregistré, mais import échoué : '+uploadError.message+'. Réessayez avec « FICHIER PRIVÉ ».');
   }
  }
  let added=0;
  for(const episode of playlistFiles){
    toast('Import de la playlist : '+(added+1)+' / '+playlistFiles.length);
    try{await api('/api/shop/admin/playlist/'+id,'POST',episode);added++}
    catch(err){
      await loadShopAdmin();document.querySelector('#admin-content').innerHTML=productForm(admin.products.find(p=>p.id===id));
      throw Error(added+' piste(s) enregistrée(s), puis erreur sur '+episode.name+' : '+err.message+'. Les fichiers déjà importés sont conservés.');
    }
  }
  await loadShopAdmin();document.querySelector('#admin-content').innerHTML=shopAdmin();
  toast('Produit enregistré'+(added?' · '+added+' épisode(s) ajouté(s)':'')+'.');
 }finally{if(submit&&submit.isConnected)submit.disabled=false}
 break;
}}}catch(ex){toast(ex.message)}return true}
export async function shopFileChange(event,{toast}){if(event.target.closest('form[data-shop-form="product"]')&&['productFile','coverFile','playlistFiles'].includes(event.target.name)){const selected=event.target.closest('form').querySelector('[data-selected-shop-file="'+event.target.name+'"]');if(selected)selected.textContent=event.target.files?.length?'Sélectionné : '+[...event.target.files].map(f=>f.name).join(' · ')+' · import lors de l’enregistrement':'Aucun fichier sélectionné';return true;}if(event.target.id!=='private-product-file')return false;const f=event.target,file=f.files[0];if(file)try{toast('Import privé en cours…');await api('/api/shop/admin/upload/'+f.dataset.id,'POST',file);await loadShopAdmin();document.querySelector('#admin-content').innerHTML=shopAdmin();toast('Fichier privé ajouté')}catch(ex){toast(ex.message)}return true}
