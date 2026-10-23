// Espace premium dédié aux publications acquises. Aucun lien ne contourne les droits d'accès.
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null;
let loadingLib=null;
function ensureLib(){
  if(window.ePub)return Promise.resolve();
  if(!loadingLib)loadingLib=(async()=>{
    for(const source of ['/jszip.min.js','/epub.min.js']){
      if(source.includes('jszip')&&window.JSZip)continue;
      if(source.includes('epub.min')&&window.ePub)continue;
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=source;script.onload=resolve;script.onerror=()=>reject(Error('Bibliothèque de lecture indisponible : '+source));
        document.head.appendChild(script);
      });
    }
    if(!window.ePub)throw Error('Le lecteur EPUB ne s’est pas chargé.');
  })().catch(err=>{loadingLib=null;throw err});
  return loadingLib;
}
async function getJson(url){
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Réponse serveur illisible'}));
 if(!res.ok)throw Error(data.error||'Erreur HTTP '+res.status);
 return data;
}
export async function productPage(id){
 current=null;
 try{
  const data=await getJson('/api/shop/me');
  if(!data.user)return '<section class="product-private"><h1>CONNEXION REQUISE</h1><p>Connectez-vous pour accéder à votre bibliothèque.</p><a class="red-button" data-link href="/mon-espace">MON ESPACE →</a></section>';
  const product=data.owned.find(p=>p.id===id);
  if(!product)return '<section class="product-private"><h1>ACCÈS RÉSERVÉ</h1><p>Cette publication n’est pas dans votre bibliothèque personnelle.</p><a class="red-button" data-link href="/mon-espace">RETOUR À LA BIBLIOTHÈQUE →</a></section>';
  current=product;
  document.title=product.title+' | Bibliothèque Bela Zara';
  const audio=product.kind==='audio',video=['video','formation'].includes(product.kind),ebook=product.kind==='ebook';
  const type=ebook?'LECTURE NUMÉRIQUE':audio?'PODCAST & AUDIO':'VIDÉO & FORMATION';
  return '<section class="product-private" data-reader-product="'+h(product.id)+'">'+
    '<a class="reader-back" href="/mon-espace" data-link>← MA BIBLIOTHÈQUE</a>'+
    '<div class="reader-heading"><div class="reader-heading-text"><span class="reader-eyebrow">BELA ZARA · '+type+'</span>'+
    '<h1>'+h(product.title)+'</h1><p>'+h(product.description)+'</p></div>'+
    (product.cover?'<img class="reader-cover" src="'+h(product.cover)+'" alt="Couverture de '+h(product.title)+'">':'')+'</div>'+
    '<div class="reader-workspace '+(audio||video?'reader-workspace-media':'')+'">'+
    '<aside class="reader-sidebar"><div class="reader-sidebar-title">'+(ebook?'TABLE DES MATIÈRES':'PLAYLIST')+'</div>'+
    '<div id="reader-index"><p>Chargement…</p></div></aside>'+
    '<div class="reader-content"><div id="reader-tools"></div><div id="reader-display" aria-live="polite">'+
    '<p class="reader-loading">Préparation de votre '+(ebook?'livre':'lecteur')+'…</p></div>'+
    '<p id="reader-status" class="reader-status" role="status"></p></div></div></section>';
 }catch(err){return '<section class="product-private"><h1>LECTURE INDISPONIBLE</h1><p>'+h(err.message)+'</p><a data-link href="/mon-espace">RETOUR À MON ESPACE</a></section>'}
}
export async function mountProductReader(id){
 const root=document.querySelector('[data-reader-product]');
 if(!root||!current||current.id!==id)return;
 const index=root.querySelector('#reader-index'),display=root.querySelector('#reader-display'),tools=root.querySelector('#reader-tools'),status=root.querySelector('#reader-status');
 const error=err=>{display.innerHTML='<div class="reader-error"><strong>Impossible d’ouvrir ce contenu.</strong><p>'+h(err.message||err)+'</p><button type="button" class="secondary-button" id="retry-reader">RÉESSAYER</button></div>';root.querySelector('#retry-reader')?.addEventListener('click',()=>mountProductReader(id));status.textContent=String(err.message||err)};
 try{
  if(current.kind==='ebook'){
   if(!current.has_file)throw Error('Aucun fichier EPUB ou PDF n’est encore associé à ce livre.');
   const url='/api/shop/download/'+id+'?lire=1';
   if(current.file_type==='pdf'){
    index.innerHTML='<p>Le PDF peut être lu en plein écran.</p>';
    tools.innerHTML='<a class="secondary-button" target="_blank" rel="noopener" href="'+url+'">AGRANDIR LE PDF ↗</a>';
    display.innerHTML='<iframe class="reader-pdf" title="Lecture du livre PDF" src="'+url+'"></iframe>';
    status.textContent='Lecture du PDF';return;
   }
   if(current.file_type!=='epub')throw Error('Format de livre non pris en charge : '+current.file_type);
   await ensureLib();
   const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok){const info=await response.json().catch(()=>({}));throw Error(info.error||'Le fichier EPUB ne peut être récupéré (HTTP '+response.status+').')}
   const bytes=await response.arrayBuffer();
   if(!bytes.byteLength)throw Error('Le fichier EPUB est vide.');
   const book=window.ePub(bytes);
   await book.ready;
   display.innerHTML='<div class="reader-paper" id="reader-epub"></div>';
   tools.innerHTML='<div class="reader-toolbar"><button type="button" data-reader-prev>←</button><span id="reader-location">Lecture</span><button type="button" data-reader-next>→</button><button type="button" data-reader-smaller>A−</button><button type="button" data-reader-bigger>A+</button><button type="button" data-reader-theme>CLAIR / SOMBRE</button></div>';
   const rendition=book.renderTo('reader-epub',{width:'100%',height:'72vh',flow:'paginated',spread:'none'});
   let fontSize=100,dark=false;
   rendition.themes.register('bela-night',{body:{color:'#f3eee4',background:'#181818'},a:{color:'#ee7676'}});
   tools.querySelector('[data-reader-prev]').onclick=()=>rendition.prev().catch(error);
   tools.querySelector('[data-reader-next]').onclick=()=>rendition.next().catch(error);
   tools.querySelector('[data-reader-smaller]').onclick=()=>{fontSize=Math.max(75,fontSize-10);rendition.themes.fontSize(fontSize+'%')};
   tools.querySelector('[data-reader-bigger]').onclick=()=>{fontSize=Math.min(180,fontSize+10);rendition.themes.fontSize(fontSize+'%')};
   tools.querySelector('[data-reader-theme]').onclick=()=>{dark=!dark;rendition.themes.select(dark?'bela-night':'default');display.classList.toggle('reader-dark',dark)};
   const nav=await book.loaded.navigation.catch(()=>null);
   const chapters=[];
   function flatten(items,depth=0){for(const item of items||[]){if(item.href)chapters.push({title:('　'.repeat(Math.min(depth,4)))+String(item.label||'Chapitre'),href:item.href});if(item.subitems)flatten(item.subitems,depth+1)}}
   flatten(nav?.toc||[]);
   index.innerHTML='';
   if(!chapters.length)index.innerHTML='<p>Sommaire non fourni dans cet EPUB. Utilisez les flèches de lecture.</p>';
   for(const item of chapters){
    const button=document.createElement('button');button.type='button';button.className='reader-chapter';button.textContent=item.title;
    button.onclick=()=>rendition.display(item.href).catch(error);
    index.appendChild(button);
   }
   rendition.on('relocated',location=>{
    const chapter=location?.start?.href||'',percentage=location?.start?.percentage;
    tools.querySelector('#reader-location').textContent=chapter.split('/').pop().split('#')[0]||'Lecture';
    status.textContent=Number.isFinite(percentage)?Math.round(percentage*100)+' % du chapitre':'Livre ouvert';
   });
   rendition.on('linkClicked',href=>{
    if(/^https?:\/\//i.test(String(href)))window.open(href,'_blank','noopener,noreferrer');
   });
   await rendition.display();
   status.textContent='EPUB chargé · '+chapters.length+' entrées au sommaire';
   return;
  }
  const data=await getJson('/api/shop/playlist/'+id);
  const tracks=data.tracks||[];
  if(!tracks.length){index.innerHTML='<p>Aucune piste publiée.</p>';throw Error('Ajoutez des épisodes à cette publication dans Administration → Boutique & Clients → Modifier.')}
  const isAudio=current.kind==='audio';
  display.innerHTML=isAudio?'<div class="reader-audio-art">'+(current.cover?'<img src="'+h(current.cover)+'" alt="">':'<span>BELA ZARA<br>PODCAST</span>')+'</div><audio id="reader-media" preload="metadata" controls controlsList="nodownload"></audio>':'<video id="reader-media" preload="metadata" controls playsinline controlsList="nodownload" '+(current.cover?'poster="'+h(current.cover)+'"':'')+'></video>';
  tools.innerHTML='<div class="reader-toolbar"><span id="reader-nowplaying">Sélectionnez une piste</span><button type="button" data-track-back>← PRÉCÉDENT</button><button type="button" data-track-next>SUIVANT →</button></div>';
  const player=display.querySelector('#reader-media');let position=0;
  index.innerHTML='';
  function select(i,play=false){
    position=(i+tracks.length)%tracks.length;
    const item=tracks[position];player.src=item.url;player.load();
    tools.querySelector('#reader-nowplaying').textContent=(position+1)+' / '+tracks.length+' · '+item.title;
    status.textContent=item.title;
    [...index.children].forEach((node,j)=>node.classList.toggle('active',j===position));
    if(play)player.play().catch(()=>{status.textContent='Appuyez sur lecture pour démarrer.'});
  }
  tracks.forEach((track,i)=>{
   const b=document.createElement('button');b.type='button';b.className='reader-chapter';
   b.textContent=String(i+1).padStart(2,'0')+'  '+track.title;b.onclick=()=>select(i,true);index.appendChild(b);
  });
  player.onended=()=>{if(position<tracks.length-1)select(position+1,true)};
  tools.querySelector('[data-track-back]').onclick=()=>select(Math.max(0,position-1),true);
  tools.querySelector('[data-track-next]').onclick=()=>select(Math.min(tracks.length-1,position+1),true);
  select(0,false);
 }catch(err){error(err)}
}
