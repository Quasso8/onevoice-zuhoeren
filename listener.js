import {relayOrigin} from './config.js'
const el=id=>document.getElementById(id)
const names={ru:'Русский',uk:'Українська',en:'English',es:'Español',fr:'Français',pl:'Polski',it:'Italiano',tr:'Türkçe',pt:'Português',nl:'Nederlands'}
const player=el('voice')
let socket, reconnect, active=false, last=0, session='', currentUrl='', blocked=false
let preferred=new URLSearchParams(location.search).get('lang')
function setLanguages(langs){
  const menu=el('lang'), available=langs.filter(code=>Object.hasOwn(names,code))
  const choice=available.includes(preferred)?preferred:available[0]||''
  if([...menu.options].map(option=>option.value).join(',')!==available.join(',')){
    menu.replaceChildren(...available.map(code=>new Option(names[code],code)))
  }
  menu.value=choice
  menu.disabled=!choice
  el('play').disabled=!choice&&!active
}
const transcript=new LiveTranscript(el('lines'))
function selectTranscript(lang){
  transcript.select(session,lang)
  el('hint').hidden=transcript.channel.rows.length>0
}
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
  const channel=active?el('lang').value:''
  const url=new URL(channel?'/listen':'/languages',relayOrigin);url.protocol='wss:'
  if(channel)url.searchParams.set('lang',channel)
  socket?.close()
  const ws=new WebSocket(url);socket=ws;last=Date.now();status('Verbindung wird aufgebaut …')
  ws.onmessage=e=>{
    if(ws!==socket)return
    last=Date.now()
    const data=JSON.parse(e.data)
    if(data.type==='state'){
      if(data.session && session!==data.session){flush();session=data.session}
      setLanguages(data.langs)
      if(el('lang').value)selectTranscript(el('lang').value)
      if(active && el('lang').value!==channel){connect();return}
      if(data.muted && currentUrl)flush()
      status(!el('lang').value?'Warten auf aktive Sprachen vom PC':!active?'Bereit zum Zuhören':!data.live?'Warten auf den Gottesdienst':data.muted?'Mikrofon stumm':'Live · Verbunden')
    }else if(active && data.type==='audio'){
      selectTranscript(channel)
      if(!transcript.add(data.id,data.text))return
      el('hint').hidden=true
      queue.push(data)
      while(queue.length>1 && queue.reduce((sum,m)=>sum+(m.duration||3),0)>15)queue.shift()
      advance()
    }else if(data.type==='gap' || data.type==='mute'){flush()}
  }
  ws.onclose=()=>{if(ws!==socket)return;flush();setLanguages([]);status('Verbindung unterbrochen · Neuer Versuch …');reconnect=setTimeout(connect,2500)}
}
setInterval(()=>{if(Date.now()-last>30000){setLanguages([]);flush();status('Warten auf Verbindung zum PC')}},4000)
el('lang').onchange=()=>{
  preferred=el('lang').value
  selectTranscript(preferred)
  if(active){socket?.close();connect()}
}
el('play').onclick=async()=>{
  if(active){active=false;player.pause();connect();el('play').textContent='Zuhören starten';return}
  if(!relayOrigin){status('Die Zuhörerseite wird eingerichtet.');return}
  try{
    try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
    active=true;el('play').textContent='Zuhören beenden'
    connect()
    player.src='./start.wav';player.muted=false
    void startMedia()
  }catch{active=false;el('play').textContent='Zuhören starten';status('Audiowiedergabe oder Verbindung konnte nicht starten.')}
}
if(relayOrigin)connect()
