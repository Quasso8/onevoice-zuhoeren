import {relayOrigin} from './config.js'
const el=id=>document.getElementById(id)
const names={ru:'Русский',uk:'Українська',en:'English',es:'Español',fr:'Français',pl:'Polski',it:'Italiano',tr:'Türkçe',pt:'Português',nl:'Nederlands'}
for(const [id,name] of Object.entries(names))el('lang').add(new Option(name,id))
const query=new URLSearchParams(location.search).get('lang')
el('lang').value=Object.hasOwn(names,query)?query:'ru'
const player=el('voice')
let socket, reconnect, active=false, last=0, session='', currentUrl='', blocked=false
let selected=Object.hasOwn(names,query)
const queue=[]
const status=text=>{el('status').textContent=text}
function release(){
  if(currentUrl)URL.revokeObjectURL(currentUrl)
  currentUrl=''
}
function flush(){
  queue.length=0
  if(currentUrl){player.pause();release()}
  blocked=false;el('resume').hidden=true;el('audio-error').textContent=''
}
function startMedia(){
  const src=player.src
  return player.play().then(()=>{
    if(player.src===src){blocked=false;el('resume').hidden=true;el('audio-error').textContent=''}
  }).catch(()=>{
    if(active && player.src===src){
      blocked=true;el('resume').hidden=false
      el('audio-error').textContent='Die Wiedergabe wurde unterbrochen. Bitte den Ton wieder einschalten.'
    }
  })
}
function advance(){
  if(!active || blocked || currentUrl || !queue.length)return
  const message=queue.shift()
  const bytes=Uint8Array.from(atob(message.audio),c=>c.charCodeAt(0))
  currentUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}))
  player.src=currentUrl
  void startMedia()
}
player.onended=()=>{release();advance()}
player.onerror=()=>{if(currentUrl){release();el('audio-error').textContent='Audioabschnitt konnte nicht abgespielt werden.';advance()}}
el('resume').onclick=()=>{void startMedia()}
function connect(){
  clearTimeout(reconnect);flush()
  const url=new URL('/listen',relayOrigin);url.protocol='wss:';url.searchParams.set('lang',el('lang').value)
  const ws=new WebSocket(url);socket=ws;last=Date.now();status('Verbindung wird aufgebaut …')
  ws.onmessage=e=>{
    if(ws!==socket || !active)return
    last=Date.now()
    const data=JSON.parse(e.data)
    if(data.type==='state'){
      if(session!==data.session){flush();session=data.session;el('lines').replaceChildren();el('hint').hidden=false}
      const available=data.langs.filter(code=>Object.hasOwn(names,code))
      if(data.live && available.length && !selected && !available.includes(el('lang').value)){
        el('lang').value=available[0];ws.close();connect();return
      }
      if(data.muted && currentUrl)flush()
      status(!data.live?'Warten auf den Gottesdienst':data.muted?'Mikrofon stumm':data.langs.includes(el('lang').value)?'Live · Verbunden':'Diese Sprache ist gerade nicht aktiv')
    }else if(data.type==='audio'){
      const line=document.createElement('p');line.textContent=data.text;el('lines').append(line)
      if(el('lines').children.length>40)el('lines').firstChild.remove()
      el('hint').hidden=true
      queue.push(data)
      while(queue.length>1 && queue.reduce((sum,m)=>sum+(m.duration||3),0)>15)queue.shift()
      advance()
    }else if(data.type==='gap' || data.type==='mute'){flush()}
  }
  ws.onclose=()=>{if(ws!==socket||!active)return;flush();status('Verbindung unterbrochen · Neuer Versuch …');reconnect=setTimeout(connect,2500)}
}
setInterval(()=>{if(active&&Date.now()-last>30000)status('Sendepause · Warten auf Verbindung zum PC')},4000)
el('lang').onchange=()=>{
  selected=true
  el('lines').replaceChildren();el('hint').hidden=false
  if(active){socket?.close();connect()}
}
el('play').onclick=async()=>{
  if(active){active=false;player.pause();clearTimeout(reconnect);socket?.close();flush();status('Wiedergabe beendet');el('play').textContent='Zuhören starten';return}
  if(!relayOrigin){status('Die Zuhörerseite wird eingerichtet.');return}
  try{
    try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
    active=true;el('play').textContent='Zuhören beenden'
    connect()
    player.src='./start.wav';player.muted=false
    void startMedia()
  }catch{active=false;el('play').textContent='Zuhören starten';status('Audiowiedergabe oder Verbindung konnte nicht starten.')}
}
