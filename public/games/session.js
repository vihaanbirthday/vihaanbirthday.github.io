// Invitation adaptation: scores live only in this isolated game session.
(() => {
 const values = Object.create(null);
 const storage = {getItem:k=>Object.hasOwn(values,k)?values[k]:null,setItem:(k,v)=>{values[k]=String(v)},removeItem:k=>{delete values[k]},clear:()=>{for(const k of Object.keys(values))delete values[k]}};
 Object.defineProperty(window, 'localStorage', {value:storage});
 Object.defineProperty(document, 'cookie', {get:()=>'',set:()=>{},configurable:true});
})();

// Parent requests are authenticated by their window, including opaque sandbox origins.
window.invitationRegisterSession = ({ hasProgress, pause = () => {} }) => {
 window.addEventListener('message', event => {
  if (event.source !== window.parent) return;
  if (event.data?.type === 'invitation:check-exit') {
   window.parent.postMessage({ type: 'invitation:exit-state', requestId: event.data.requestId, hasProgress: !!hasProgress() }, '*');
  }
  if (event.data?.type === 'invitation:pause-game') pause();
 });
};

// Keep the parent hero visible until assets, fonts and the first paint are ready.
window.invitationGameReady = (() => {
 let sent = false;
 const loaded = new Promise(resolve => {
  if (document.readyState === 'complete') resolve();
  else window.addEventListener('load', resolve, {once:true});
 });
 return async () => {
  if (sent) return;
  sent = true;
  await loaded;
  if (document.fonts) await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => {
   window.parent.postMessage({type:'invitation:game-ready'}, '*');
  }));
 };
})();
