const details=document.getElementById('capability-explorer');
const host=document.getElementById('capability-host');
let frame;
details?.addEventListener('toggle',()=>{
  if(details.open&&!frame){
    frame=document.createElement('iframe');frame.title='Atlas Drive: capability map, actuator challenge and recorded torque inspection';
    frame.src='replay/?study=capability&embed=1';frame.style.cssText='width:100%;height:730px;border:0;display:block';host.append(frame);
  }else if(!details.open&&frame){frame.remove();frame=null;}
});
const openFromLink=()=>{if(location.hash==='#capability-explorer'&&details){document.getElementById('recorded-example').open=true;details.open=true;}};
window.addEventListener('hashchange',openFromLink);
openFromLink();
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='atlas-capability-height'||!Number.isFinite(event.data.height))return;
  frame.style.height=`${Math.max(200,Math.min(5000,event.data.height))}px`;
});
