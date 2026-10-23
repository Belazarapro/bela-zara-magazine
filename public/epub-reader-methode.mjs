// EPUB.js 0.3.93 renders private unpacked publications; the original ZIP is never requested.
let active=null,enginePromise;
const defaults={fontSize:100,font:'serif',theme:'sepia',lineHeight:1.7,margin:24,align:'left',flow:'paginated',spread:'auto'};
const colors={yellow:'#ffe090',green:'#b9dfb4',pink:'#f5bbd2',blue:'#b8d9fa'};
const fonts={publisher:'inherit',serif:'Georgia, serif',sans:'Arial, sans-serif',readable:'Verdana, sans-serif'};
function shellCleanup(a){a.shell?.classList.remove('epub-fullscreen');document.body.classList.remove('epub-reader-fullscreen');}
async function engine(){
 if(window.ePub)return window.ePub;
 for(const [src,check] of [['/jszip.min.js',()=>window.JSZip],['/epub.min.js',()=>window.ePub]]){
  if(check())continue;
  await new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=src;tag.onload=resolve;tag.onerror=()=>reject(Error('Impossible de charger le moteur de lecture : '+src));document.head.appendChild(tag)});
 }
 if(!window.ePub)throw Error('Le lecteur EPUB ne répond pas.');
 return window.ePub;
}
export function epubReaderPage(id,title,e){return `<section class="epub-section"><div class="epub-shell" id="epub-shell" data-book="${e(id)}"><header class="epub-bar"><a href="/mon-espace" data-link class="epub-back" aria-label="Retour à ma bibliothèque">←</a><div class="epub-title"><span>LA BIBLIOTHÈQUE · BELA ZARA</span><h1>${e(title)}</h1></div><div class="epub-actions"><button data-epub-panel="toc" aria-controls="epub-panel" aria-expanded="false">☰ <span>Sommaire</span></button><button data-epub-panel="search" aria-controls="epub-panel" aria-expanded="false">⌕ <span>Rechercher</span></button><button data-epub-panel="marks" aria-controls="epub-panel" aria-expanded="false">☆ <span>Mes repères</span></button><button data-epub-panel="settings" aria-controls="epub-panel" aria-expanded="false">Aa <span>Réglages</span></button><button data-epub-action="fullscreen" aria-label="Afficher le lecteur en plein écran"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/></svg></button></div></header><div class="epub-workspace"><div class="epub-main"><div class="epub-chapter"><span id="epub-chapter">Ouverture du livre…</span><div><button data-epub-action="bookmark" aria-label="Ajouter un signet à cette position">☆ Signet</button></div></div><div id="epub-viewer" class="epub-viewer" aria-label="Texte de l’ebook"></div><div id="epub-selection" class="epub-selection" hidden><span>Passage sélectionné</span><button data-epub-action="highlight">Surligner</button><button data-epub-action="note">Ajouter une note</button><button data-epub-action="clear-selection" aria-label="Fermer la sélection">×</button></div><div class="epub-status" id="epub-status" role="status" aria-live="polite">Chargement de votre ebook…</div></div><aside id="epub-panel" class="epub-panel" hidden aria-label="Options du lecteur"><div class="epub-panel-head"><h2 id="epub-panel-title">Sommaire</h2><button data-epub-action="close-panel" aria-label="Fermer le panneau">×</button></div><div id="epub-panel-content"></div></aside></div><footer class="epub-bottom"><button data-epub-action="prev" aria-label="Page précédente">← <span>Précédente</span></button><div class="epub-progress"><label for="epub-progress">Progression dans le livre <span id="epub-percent">—</span></label><input id="epub-progress" type="range" min="0" max="100" step="1" value="0" disabled><span id="epub-save">Votre lecture vous attend ici.</span></div><button data-epub-action="next" aria-label="Page suivante"><span>Suivante</span> →</button></footer></div></section>`;}
export function destroyEpubReader(){
 if(!active)return;const a=active;if(a.data)void a.persist?.().catch(()=>{});active=null;a.dead=true;for(const timer of ['saveTimer','prefTimer','controlsTimer','clickTimer'])clearTimeout(a[timer]);cancelAnimationFrame(a.resizeFrame);a.resize?.disconnect();a.abort.abort();shellCleanup(a);try{a.rendition?.destroy();a.book?.destroy();}catch{}
}
export async function mountEpubReader(id,{api,send,e}){
 destroyEpubReader();const shell=document.getElementById('epub-shell');if(!shell)return;
 const a=active={id,shell,api,send,e,abort:new AbortController(),prefs:{...defaults},annotations:[],panel:'',cfi:'',selected:null,dead:false,saveTimer:null,searchTicket:0};
 const $=q=>shell.querySelector(q);a.$=$;
 const status=message=>{if(!a.dead)$('#epub-status').textContent=message;};a.status=status;
 const target=$('#epub-viewer');target.tabIndex=0;target.setAttribute('aria-description','Double-cliquez ou touchez deux fois le texte pour afficher les commandes. Échap les affiche également.');
 function resizeReader(){
  cancelAnimationFrame(a.resizeFrame);a.resizeFrame=requestAnimationFrame(async()=>{if(a.dead||!a.rendition||a.rebuilding)return;const width=target.clientWidth,height=target.clientHeight;if(width>0&&height>0&&(width!==a.width||height!==a.height)){
   const rendition=a.rendition;let position=a.cfi;try{position=(await rendition.currentLocation())?.start?.cfi||position;}catch{}if(a.dead||a.rebuilding||a.rendition!==rendition)return;
   a.width=width;a.height=height;rendition.resize(width,height,position||undefined);
  }});
 }
 function waitForLayout(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
 function scheduleHide(){clearTimeout(a.controlsTimer);if(!a.panel&&!a.selected)a.controlsTimer=setTimeout(()=>{if(!a.dead&&!a.panel&&!a.selected)setControls(false);},6000);}
 function setControls(visible){
  if(!visible&&a.panel)panel(a.panel);clearTimeout(a.controlsTimer);shell.classList.toggle('epub-quiet',!visible);
  for(const node of shell.querySelectorAll('.epub-bar,.epub-chapter,.epub-bottom'))node.inert=!visible;
  if(!visible)target.focus({preventScroll:true});else scheduleHide();resizeReader();
 }
 function toggleControls(){if(Date.now()-(a.lastToggle||0)<400)return;a.lastToggle=Date.now();a.ignoreSelectionUntil=Date.now()+500;clearTimeout(a.clickTimer);clearSelection();setControls(shell.classList.contains('epub-quiet'));}
 function installReadingGestures(node,signal=a.abort.signal){
  let touch=null,lastTap=null;
  const interactive=event=>event.target.closest?.('a,button,input,textarea,select,[contenteditable=true]');
  node.addEventListener('dblclick',event=>{if(interactive(event))return;event.preventDefault();toggleControls();},{signal});
  node.addEventListener('click',event=>{if(interactive(event)||event.detail>1||a.panel||a.selected)return;clearTimeout(a.clickTimer);a.clickTimer=setTimeout(()=>{if(!a.dead&&!a.selected&&!a.panel&&!shell.classList.contains('epub-quiet'))setControls(false);},320);},{signal});
  node.addEventListener('touchstart',event=>{if(event.touches.length!==1||interactive(event)){touch=null;return;}const t=event.touches[0];touch={x:t.clientX,y:t.clientY,time:Date.now(),swiping:false};},{passive:true,signal});
  node.addEventListener('touchmove',event=>{if(!touch||event.touches.length!==1){touch=null;return;}const t=event.touches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(!a.selected&&Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.5){touch.swiping=true;if(event.cancelable)event.preventDefault();}},{passive:false,signal});
  node.addEventListener('touchend',event=>{
   if(!touch)return;const t=event.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y,duration=Date.now()-touch.time;const swiping=touch.swiping;touch=null;
   if(swiping&&duration<900&&Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.5){event.preventDefault();lastTap=null;if(a.swipeBusy)return;a.swipeBusy=true;clearSelection();const reverse=a.rendition.settings.direction==='rtl';void action((dx<0)!==reverse?'next':'prev').then(()=>{if(!a.dead)setControls(false);}).catch(err=>status(err.message)).finally(()=>{a.swipeBusy=false;});return;}
   if(duration<300&&Math.abs(dx)<15&&Math.abs(dy)<15){if(lastTap&&Date.now()-lastTap.time<350&&Math.abs(t.clientX-lastTap.x)<28&&Math.abs(t.clientY-lastTap.y)<28){event.preventDefault();lastTap=null;toggleControls();}else lastTap={time:Date.now(),x:t.clientX,y:t.clientY};}else lastTap=null;
  },{passive:false,signal});
  node.addEventListener('touchcancel',()=>{touch=null;lastTap=null;},{passive:true,signal});
 }
 installReadingGestures(target);
 function panel(kind){
  if(kind)setControls(true);
  const same=a.panel===kind;a.panel=same?'':kind;$('#epub-panel').hidden=!a.panel;shell.classList.toggle('epub-panel-open',!!a.panel);
  shell.querySelectorAll('[data-epub-panel]').forEach(b=>{const selected=b.dataset.epubPanel===a.panel;b.setAttribute('aria-expanded',String(selected));b.classList.toggle('active',selected);});
  if(a.panel){clearTimeout(a.controlsTimer);renderPanel();}else scheduleHide();resizeReader();
 }
 function renderPanel(){
  const labels={toc:'Sommaire',search:'Rechercher',marks:'Mes repères',settings:'Votre confort de lecture'};$('#epub-panel-title').textContent=labels[a.panel]||'';
  const c=$('#epub-panel-content');
  if(a.panel==='toc'){const build=list=>`<ol class="epub-toc">${list.map(item=>`<li><button data-epub-href="${e(item.href)}">${e(item.label)}</button>${item.subitems?.length?build(item.subitems):''}</li>`).join('')}</ol>`;c.innerHTML=build(a.toc||[]);}
  if(a.panel==='search')c.innerHTML=`<form id="epub-search-form"><label class="epub-label" for="epub-query">Un mot ou une expression</label><div class="epub-search-row"><input id="epub-query" name="query" type="search" minlength="2" maxlength="100" required placeholder="Ex. : sous-texte"><button type="submit">Chercher</button></div></form><p id="epub-search-status" class="epub-hint" role="status"></p><div id="epub-results"></div>`;
  if(a.panel==='marks'){
   const selected=a.selected;
   c.innerHTML=`<p class="epub-hint">Sélectionnez un passage dans le livre pour le surligner ou l’annoter.</p>${selected?`<form id="epub-note-form"><blockquote>${e(selected.quote.slice(0,4000))}</blockquote><label class="epub-label" for="epub-note">Votre note personnelle</label><textarea id="epub-note" name="note" rows="4" maxlength="8000" placeholder="Une idée, une question, un exemple à retenir…">${e(a.editing?.note||'')}</textarea><label class="epub-label" for="epub-color">Couleur du surlignage</label><select id="epub-color" name="color">${[['yellow','Jaune'],['green','Vert'],['pink','Rose'],['blue','Bleu']].map(([v,l])=>`<option value="${v}" ${a.editing?.color===v?'selected':''}>${l}</option>`).join('')}</select><button class="epub-primary" type="submit">Enregistrer ce passage</button></form>`:''}<div class="epub-marks-top"><strong>${a.annotations.length} repère${a.annotations.length>1?'s':''}</strong>${a.annotations.length?'<button data-epub-action="export-notes">Exporter mes notes</button>':''}</div>${a.annotations.length?a.annotations.map(n=>`<article class="epub-mark"><span class="epub-mark-type">${n.kind==='bookmark'?'☆ SIGNET':'PASSAGE SURLIGNÉ'}</span>${n.quote?`<blockquote>${e(n.quote)}</blockquote>`:''}${n.note?`<p>${e(n.note)}</p>`:''}<div><button data-epub-cfi="${e(n.cfi)}">Revenir au passage</button><button data-epub-edit="${e(n.id)}">Modifier</button><button data-epub-delete="${e(n.id)}" aria-label="Supprimer ce repère">Supprimer</button></div></article>`).join(''):'<p class="epub-empty">Votre premier signet ou votre première note apparaîtra ici.</p>'}`;
  }
  if(a.panel==='settings'){
   const p=a.prefs,options=(arr,value)=>arr.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('');
   c.innerHTML=`<div class="epub-setting"><span class="epub-label">Ambiance</span><div class="epub-themes">${[['light','Blanc'],['sepia','Papier']].map(([t,l])=>`<button data-epub-theme="${t}" class="theme-${t}" aria-pressed="${p.theme===t}">${l}</button>`).join('')}</div></div><label class="epub-setting">Police<select data-epub-pref="font">${options([['publisher','Police du livre'],['serif','Georgia · classique'],['sans','Arial · sobre'],['readable','Verdana · lisible']],p.font)}</select></label><label class="epub-setting">Taille du texte <output>${p.fontSize} %</output><input type="range" data-epub-pref="fontSize" min="70" max="240" step="10" value="${p.fontSize}"></label><label class="epub-setting">Interligne <output>${p.lineHeight.toFixed(1)}</output><input type="range" data-epub-pref="lineHeight" min="1.2" max="2.4" step="0.1" value="${p.lineHeight}"></label><label class="epub-setting">Marges <output>${p.margin} px</output><input type="range" data-epub-pref="margin" min="8" max="80" step="4" value="${p.margin}"></label><label class="epub-setting">Alignement<select data-epub-pref="align">${options([['left','Aligné à gauche'],['justify','Justifié']],p.align)}</select></label><label class="epub-setting">Double page sur grand écran<select data-epub-pref="spread">${options([['auto','Automatique'],['none','Une seule page']],p.spread)}</select></label><button data-epub-action="reset">Réinitialiser mes réglages</button><p class="epub-hint mt-2">Raccourcis : ← → pour tourner les pages, F pour le plein écran, Échap pour afficher les commandes ou fermer ce panneau ; double-clic ou double toucher dans le texte pour masquer ou afficher les commandes.</p>`;
  }
 }
 function applyTheme(contents){
  const p=a.prefs,theme={light:['#ffffff','#25231f'],sepia:['#f7f0df','#30281d']}[p.theme],doc=contents.document;
  // EPUB authors can specify black text inline with !important. Inherit alone cannot override it.
  for(const element of doc.querySelectorAll('body, body *')){
   if(element.closest('svg,math')||['style','script'].includes(element.localName))continue;
   element.style.setProperty('color',element.closest('a')?'#8c2925':theme[1],'important');
   element.style.setProperty('background-color',element===doc.body?theme[0]:'transparent','important');
   if(p.font!=='publisher'&&a.book.package.metadata.layout!=='pre-paginated')element.style.setProperty('font-family',fonts[p.font],'important');
  }
  doc.documentElement.style.setProperty('background-color',theme[0],'important');
  if(a.book.package.metadata.layout!=='pre-paginated')doc.documentElement.style.setProperty('font-size',p.fontSize+'%','important');
 }
 function prepareTypography(contents){
  if(a.book.package.metadata.layout==='pre-paginated')return;
  // Word/Google exports set point sizes on nested spans. Make these sizes follow the reader's root size.
  const relative=style=>{const value=style.getPropertyValue('font-size'),match=value.match(/^([\d.]+)(px|pt)$/i);if(match)style.setProperty('font-size',(Number(match[1])*(match[2].toLowerCase()==='pt'?4/3:1)/16)+'rem',style.getPropertyPriority('font-size'));};
  const rules=list=>{for(const rule of list){if(rule.style&&rule.selectorText)relative(rule.style);if(rule.cssRules)rules(rule.cssRules);}};
  for(const sheet of contents.document.styleSheets)try{rules(sheet.cssRules);}catch{}
  for(const node of contents.document.querySelectorAll('[style]'))relative(node.style);
 }
 function themeRules(){
  const p=a.prefs,theme={light:['#ffffff','#25231f'],sepia:['#f7f0df','#30281d']}[p.theme];shell.dataset.theme=p.theme;
  return {'html':{'background':theme[0]+' !important','color':theme[1]+' !important','font-size':p.fontSize+'% !important'},'body':{'color':theme[1]+' !important','background':theme[0]+' !important',...(p.font==='publisher'?{}:{'font-family':fonts[p.font]+' !important'}),'font-size':'1rem !important','line-height':p.lineHeight+' !important','padding-top':p.margin+'px !important','padding-bottom':p.margin+'px !important',},'p, li, blockquote':{'font-size':'1em !important','line-height':p.lineHeight+' !important','text-align':p.align+' !important'},'a':{'color':'#8c2925 !important'},'img':{'max-width':'100% !important','height':'auto'},'::selection':{'background':'#f0d484'}};
 }
 function chapterLabel(location){
  const entries=[],flatten=list=>{for(const item of list){entries.push(item);flatten(item.subitems||[]);}};flatten(a.toc||[]);
  const sameFile=href=>href.split('#')[0]===location.start.href.split('#')[0];let label=entries.find(item=>sameFile(item.href))?.label||a.data.title;
  try{
   const contents=a.rendition.getContents().find(c=>c.sectionIndex===location.start.index)||a.rendition.getContents()[0];if(!contents)return label;
   const range=contents.range(location.start.cfi),container=range.startContainer,node=container.nodeType===1?(container.childNodes[range.startOffset]||container):container;let previous=null;
   for(const item of entries){if(!sameFile(item.href))continue;const fragment=item.href.split('#')[1];if(!fragment)continue;const heading=contents.document.getElementById(decodeURIComponent(fragment));
    if(heading&&(heading.contains(node)||(heading.compareDocumentPosition(node)&4))&&(!previous||(previous.compareDocumentPosition(heading)&4))){label=item.label;previous=heading;}
   }
   if(a.tocTarget){const item=entries.find(item=>item.href===a.tocTarget),id=item?.href.split('#')[1],heading=id&&contents.document.getElementById(decodeURIComponent(id));const end=contents.range(location.end.cfi),endNode=end.endContainer;
    if(heading&&((node.compareDocumentPosition(heading)&4)||heading.contains(node))&&((heading.compareDocumentPosition(endNode)&4)||heading.contains(endNode)))label=item.label;
   }
  }catch{}return label;
 }
 async function applyPreferences(){
  const run=async()=>{if(a.dead||!a.book)return;const layoutKey=JSON.stringify(['flow','spread','font','fontSize','lineHeight','margin','align'].map(key=>a.prefs[key]));
   if(!a.rendition||layoutKey!==a.layoutKey){let position=a.cfi;try{position=(await a.rendition?.currentLocation())?.start?.cfi||position;}catch{}await createRendition(position);a.layoutKey=layoutKey;}else{a.rendition.themes.default(themeRules());for(const contents of a.rendition.getContents())applyTheme(contents);}
  };
  a.preferenceTask=(a.preferenceTask||Promise.resolve()).catch(()=>{}).then(run);return a.preferenceTask;
 }
 async function save(){if(a.dead||!a.data)return;try{await send('/epub/'+id+'/state',{cfi:a.cfi,prefs:a.prefs},'PUT');if(!a.dead)$('#epub-save').textContent='Position et réglages enregistrés.';}catch(err){if(!a.dead)$('#epub-save').textContent='Enregistrement en attente : '+err.message;}}
 a.persist=()=>send('/epub/'+id+'/state',{cfi:a.cfi,prefs:{...a.prefs}},'PUT');
 window.addEventListener('pagehide',()=>{if(a.data)void fetch('/api/shop/epub/'+id+'/state',{method:'PUT',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-Requested-With':'bela-zara-magazine'},body:JSON.stringify({cfi:a.cfi,prefs:a.prefs})}).catch(()=>{});},{signal:a.abort.signal});
 function queueSave(){clearTimeout(a.saveTimer);a.saveTimer=setTimeout(()=>void save(),350);}
 function refreshHighlights(){
  if(!a.rendition)return;for(const n of a.annotations)if(n.kind==='highlight')try{a.rendition.annotations.highlight(n.cfi,{id:n.id},()=>{if(a.panel!=='marks')panel('marks');else{setControls(true);renderPanel();}},'mc-epub-highlight',{fill:colors[n.color],'fill-opacity':'0.32','mix-blend-mode':'multiply'});}catch{}
 }
 async function annotate(kind,note='',color='yellow'){
  const selected=a.selected,position=kind==='bookmark'?a.cfi:selected?.cfi;if(!position){status('Sélectionnez d’abord un passage dans le livre.');return;}
  const quote=kind==='bookmark'?$('#epub-chapter').textContent:selected.quote;
  try{const result=await send('/epub/'+id+'/annotations',{cfi:position,quote:quote.slice(0,4000),note,color,kind});if(a.dead)return;a.annotations.unshift(result.annotation);refreshHighlights();a.selected=null;$('#epub-selection').hidden=true;if(a.panel==='marks')renderPanel();status(kind==='bookmark'?'Signet ajouté à cette position.':'Passage enregistré dans vos repères.');}
  catch(err){status(err.message);}
 }
 async function search(query){
  const ticket=++a.searchTicket,found=[];const resultBox=$('#epub-results'),label=$('#epub-search-status');label.textContent='Recherche dans le livre…';resultBox.innerHTML='';
  try{for(const section of a.book.spine.spineItems){if(a.dead||ticket!==a.searchTicket||a.panel!=='search')return;const wasLoaded=!!section.document;await section.load(a.book.load.bind(a.book));const matches=section.find(query);found.push(...matches.slice(0,100-found.length));if(!wasLoaded)section.unload();if(found.length>=100)break;}
   if(a.dead||ticket!==a.searchTicket||a.panel!=='search')return;label.textContent=found.length?`${found.length}${found.length>=100?' premiers':''} résultat${found.length>1?'s':''}`:'Aucun résultat.';resultBox.innerHTML=found.map(f=>`<button class="epub-search-result" data-epub-cfi="${e(f.cfi)}">${e(f.excerpt)}</button>`).join('');
  }catch(err){if(!a.dead&&label.isConnected)label.textContent='La recherche a échoué. Réessayez.';}
 }
 function clearSelection(){a.selected=null;$('#epub-selection').hidden=true;for(const c of a.rendition?.getContents()||[])c.window.getSelection()?.removeAllRanges();}
 async function action(kind){
  switch(kind){
   case 'prev':await a.preferenceTask;a.tocTarget=null;clearSelection();await a.rendition?.prev();break;
   case 'next':await a.preferenceTask;a.tocTarget=null;clearSelection();await a.rendition?.next();break;
   case 'close-panel':panel(a.panel);break;
   case 'fullscreen':if(shell.classList.contains('epub-fullscreen')){shellCleanup(a);setControls(true);}else if(document.fullscreenElement===shell){await document.exitFullscreen();setControls(true);}else{try{if(!shell.requestFullscreen)throw Error('Fullscreen unsupported');await shell.requestFullscreen();}catch{shell.classList.add('epub-fullscreen');document.body.classList.add('epub-reader-fullscreen');}setControls(false);}resizeReader();break;
   case 'bookmark':await annotate('bookmark');break;
   case 'highlight':await annotate('highlight');break;
   case 'note':if(!a.selected){status('Sélectionnez d’abord un passage.');break;}if(a.panel!=='marks')panel('marks');else renderPanel();$('#epub-note')?.focus();break;
   case 'clear-selection':clearSelection();break;
   case 'reset':a.prefs={...defaults};await applyPreferences();renderPanel();queueSave();break;
   case 'export-notes':{const text=a.data.title+' — Mes notes\n\n'+a.annotations.map(n=>(n.kind==='bookmark'?'Signet':'Passage')+'\n'+n.quote+'\n'+n.note).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='mes-notes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
  }
 }
 const listenerOptions={signal:a.abort.signal};
 shell.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  try{
   if(button.dataset.epubPanel)panel(button.dataset.epubPanel);
   if(button.dataset.epubAction)await action(button.dataset.epubAction);
   if(button.dataset.epubTheme){a.prefs.theme=button.dataset.epubTheme;await applyPreferences();renderPanel();queueSave();}
   if(button.dataset.epubHref||button.dataset.epubCfi){await a.preferenceTask;a.tocTarget=button.dataset.epubHref||null;if(a.panel){panel(a.panel);await waitForLayout();}await a.rendition.display(button.dataset.epubHref||button.dataset.epubCfi);const location=await a.rendition.currentLocation();a.cfi=location?.start?.cfi||a.cfi;if(location?.start)$('#epub-chapter').textContent=chapterLabel(location);queueSave();}
   if(button.dataset.epubEdit){a.editing=a.annotations.find(n=>n.id===button.dataset.epubEdit);a.selected={cfi:a.editing.cfi,quote:a.editing.quote};renderPanel();$('#epub-note')?.focus();}
   if(button.dataset.epubDelete){const n=a.annotations.find(x=>x.id===button.dataset.epubDelete);await send('/epub/'+id+'/annotations/'+n.id,{},'DELETE');a.annotations=a.annotations.filter(x=>x.id!==n.id);if(n.kind==='highlight')a.rendition.annotations.remove(n.cfi,'highlight');renderPanel();status('Repère supprimé.');}
  }catch(err){status(err.message||'Cette action n’a pas abouti.');}
 },listenerOptions);
 shell.addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='epub-search-form')void search(new FormData(event.target).get('query').trim());if(event.target.id==='epub-note-form'){const v=new FormData(event.target);if(a.editing){const old=a.editing;void send('/epub/'+id+'/annotations/'+old.id,{note:v.get('note'),color:v.get('color')},'PUT').then(result=>{a.annotations=a.annotations.map(n=>n.id===old.id?result.annotation:n);a.rendition.annotations.remove(old.cfi,'highlight');a.editing=null;a.selected=null;refreshHighlights();renderPanel();status('Note modifiée.');}).catch(err=>status(err.message));}else void annotate('highlight',v.get('note'),v.get('color'));}},listenerOptions);
 shell.addEventListener('input',event=>{
  const key=event.target.dataset.epubPref;if(!key)return;const numeric=['fontSize','lineHeight','margin'].includes(key);a.prefs[key]=numeric?Number(event.target.value):event.target.value;
  const out=event.target.closest('label')?.querySelector('output');if(out)out.textContent=key==='fontSize'?a.prefs[key]+' %':key==='margin'?a.prefs[key]+' px':a.prefs[key].toFixed(1);
  clearTimeout(a.prefTimer);a.prefTimer=setTimeout(()=>{void applyPreferences().then(queueSave).catch(err=>status(err.message));},160);
 },listenerOptions);
 shell.addEventListener('change',event=>{if(event.target.id==='epub-progress'&&a.book.locations.length())void a.rendition.display(a.book.locations.cfiFromPercentage(Math.min(0.999,Number(event.target.value)/100))).catch(err=>status(err.message));},listenerOptions);
 const keyboard=event=>{if(event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(event.key==='ArrowLeft'){event.preventDefault();void action('prev').catch(err=>status(err.message));}if(event.key==='ArrowRight'){event.preventDefault();void action('next').catch(err=>status(err.message));}if(event.key.toLowerCase()==='f'){event.preventDefault();void action('fullscreen').catch(err=>status(err.message));}if(event.key==='Escape'){if(a.panel)panel(a.panel);setControls(true);}if(event.key==='Enter'&&event.target===target){event.preventDefault();toggleControls();}};shell.addEventListener('keydown',keyboard,listenerOptions);
 shell.addEventListener('pointerdown',event=>{if(event.target.closest('.epub-bar,.epub-bottom,.epub-chapter'))scheduleHide();},listenerOptions);
 document.addEventListener('fullscreenchange',()=>{const full=document.fullscreenElement===shell||shell.classList.contains('epub-fullscreen');$('[data-epub-action=fullscreen]').setAttribute('aria-label',full?'Quitter le plein écran':'Afficher le lecteur en plein écran');resizeReader();},listenerOptions);
 window.addEventListener('resize',resizeReader,listenerOptions);
 window.visualViewport?.addEventListener('resize',resizeReader,listenerOptions);
 a.abort.signal.addEventListener('abort',()=>a.renditionAbort?.abort(),{once:true});
 async function createRendition(position){
  a.rebuilding=true;clearSelection();a.renditionAbort?.abort();a.rendition?.destroy();target.replaceChildren();
  try{
   await waitForLayout();if(a.dead)return;a.width=target.clientWidth;a.height=target.clientHeight;
   const rendition=a.book.renderTo(target,{width:a.width,height:a.height,flow:'paginated',spread:a.prefs.spread,minSpreadWidth:900,gap:a.prefs.margin*2,allowScriptedContent:false,allowPopups:false});a.rendition=rendition;a.renditionAbort=new AbortController();
   rendition.themes.default(themeRules());
   rendition.hooks.content.register(contents=>{
    const signal=a.renditionAbort.signal;
    contents.document.addEventListener('copy',event=>event.preventDefault(),{signal});contents.document.addEventListener('contextmenu',event=>event.preventDefault(),{signal});contents.document.addEventListener('keydown',keyboard,{signal});
    contents.document.documentElement.lang=a.book.package?.metadata?.language||'fr';contents.document.documentElement.style.touchAction='pan-y pinch-zoom';contents.document.body.style.touchAction='pan-y pinch-zoom';prepareTypography(contents);applyTheme(contents);installReadingGestures(contents.document,signal);
   });
   rendition.on('selected',(cfi,contents)=>{if(a.dead||a.rendition!==rendition||Date.now()<(a.ignoreSelectionUntil||0))return;const quote=contents.window.getSelection()?.toString().trim();if(!quote)return;clearTimeout(a.clickTimer);clearTimeout(a.controlsTimer);a.editing=null;a.selected={cfi,quote:quote.slice(0,4000)};$('#epub-selection').hidden=false;});
   rendition.on('relocated',location=>{
    if(a.dead||a.rendition!==rendition)return;a.cfi=location.start.cfi;const percentage=a.book.locations.length()?a.book.locations.percentageFromCfi(a.cfi):location.start.percentage;
    if(Number.isFinite(percentage)){$('#epub-percent').textContent=Math.round(percentage*100)+' %';$('#epub-progress').value=Math.round(percentage*100);}
    $('#epub-chapter').textContent=chapterLabel(location);
    $('[data-epub-action=prev]').disabled=location.atStart;$('[data-epub-action=next]').disabled=location.atEnd;if(!(a.panel==='marks'&&a.selected))clearSelection();queueSave();status('');
   });
   refreshHighlights();await rendition.display(position||undefined).catch(()=>rendition.display());
  }finally{a.rebuilding=false;resizeReader();}
 }
 try{
  const [data,ePub]=await Promise.all([api('/epub/'+id),engine()]);if(a.dead)return;a.data=data;a.annotations=data.annotations;a.prefs={...defaults,...data.prefs,flow:'paginated'};if(!['sepia','light'].includes(a.prefs.theme))a.prefs.theme='sepia';delete a.prefs.voice;delete a.prefs.rate;a.cfi=data.cfi;
  const file=await fetch('/api/shop/download/'+id+'?lire=1',{credentials:'same-origin',cache:'no-store'});
  if(!file.ok){const detail=await file.json().catch(()=>({}));throw Error(detail.error||'Fichier EPUB indisponible (HTTP '+file.status+')');}
  const bytes=await file.arrayBuffer();
  if(!bytes.byteLength)throw Error('Ce livre EPUB est vide.');
  a.book=ePub(bytes);await a.book.ready;if(a.dead)return;
  const navigation=await a.book.loaded.navigation;if(a.dead)return;a.toc=navigation.toc;await applyPreferences();if(a.dead)return;status('Les commandes se masquent pendant la lecture. Double-cliquez ou touchez deux fois le texte pour les retrouver.');scheduleHide();
  a.resize=new ResizeObserver(resizeReader);a.resize.observe(target);
  void a.book.locations.generate(1200).then(()=>{if(!a.dead){$('#epub-progress').disabled=false;const p=a.book.locations.percentageFromCfi(a.cfi);if(Number.isFinite(p)){$('#epub-percent').textContent=Math.round(p*100)+' %';$('#epub-progress').value=Math.round(p*100);}}}).catch(()=>{});
 }catch(err){status(err.message||'Le livre ne peut pas être ouvert. Vérifiez le fichier EPUB dans l’administration.');}
}
