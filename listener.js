import {relayOrigin} from './config.js'
const el=id=>document.getElementById(id)
const names={de:'Deutsch',ru:'Русский',uk:'Українська',en:'English',es:'Español',fr:'Français',pl:'Polski',it:'Italiano',tr:'Türkçe',pt:'Português',nl:'Nederlands'}
for(const [id,name] of Object.entries(names))el('lang').add(new Option(name,id))
const query=new URLSearchParams(location.search).get('lang')
el('lang').value=Object.hasOwn(names,query)?query:'ru'
let context, socket, reconnect, active=false, generation=0, next=0, last=0, session='', chain=Promise.resolve()
const sources=new Set()
const status=text=>{el('status').textContent=text}
function flush(){
  generation++;next=0;chain=Promise.resolve()
  for(const node of sources){try{node.stop()}catch{}}
  sources.clear()
}
async function play(message,version){
  if(version!==generation)return
  const bytes=Uint8Array.from(atob(message.audio),c=>c.charCodeAt(0))
  const audio=await context.decodeAudioData(bytes.buffer)
  if(version!==generation)return
  if(next>context.currentTime+15){flush()}
  const node=context.createBufferSource();node.buffer=audio;node.connect(context.destination)
  sources.add(node);node.onended=()=>{sources.delete(node);node.disconnect()}
  next=Math.max(next,context.currentTime+.05);node.start(next);next+=audio.duration
}
function connect(){
  clearTimeout(reconnect);flush()
  const url=new URL('/listen',relayOrigin);url.protocol='wss:';url.searchParams.set('lang',el('lang').value)
  const ws=new WebSocket(url);socket=ws;last=Date.now();status('Verbindung wird aufgebaut …')
  ws.onmessage=e=>{
    if(ws!==socket)return
    last=Date.now()
    const data=JSON.parse(e.data)
    if(data.type==='state'){
      if(session!==data.session){flush();session=data.session;el('lines').replaceChildren();el('hint').hidden=false}
      if(data.muted && sources.size)flush()
      status(!data.live?'Warten auf den Gottesdienst':data.muted?'Mikrofon stumm':data.langs.includes(el('lang').value)?'Live · Verbunden':'Diese Sprache ist gerade nicht aktiv')
    }else if(data.type==='audio'){
      const line=document.createElement('p');line.textContent=data.text;el('lines').append(line)
      if(el('lines').children.length>40)el('lines').firstChild.remove()
      el('hint').hidden=true
      const version=generation;chain=chain.then(()=>play(data,version)).catch(()=>status('Ton konnte nicht abgespielt werden. Die Mitschrift läuft weiter.'))
    }else if(data.type==='gap' || data.type==='mute'){flush()}
  }
  ws.onclose=()=>{if(ws!==socket||!active)return;flush();status('Verbindung unterbrochen · Neuer Versuch …');reconnect=setTimeout(connect,2500)}
}
setInterval(()=>{if(active&&Date.now()-last>30000)status('Sendepause · Warten auf Verbindung zum PC')},4000)
el('lang').onchange=()=>{
  el('lines').replaceChildren();el('hint').hidden=false
  if(active){socket?.close();connect()}
}
el('play').onclick=async()=>{
  if(active){active=false;clearTimeout(reconnect);socket?.close();flush();status('Wiedergabe beendet');el('play').textContent='Zuhören starten';return}
  if(!relayOrigin){status('Die Zuhörerseite wird eingerichtet.');return}
  try{
    context ||= new AudioContext();await context.resume()
    active=true;el('play').textContent='Zuhören beenden';connect()
  }catch{active=false;el('play').textContent='Zuhören starten';status('Audiowiedergabe oder Verbindung konnte nicht starten.')}
}
