const host=document.getElementById('learned-motion-host');
if(host){
  const frame=document.createElement('iframe');
  frame.title='Learned motion: paired 3D withdrawal and recorded object speed';
  frame.src='replay/?study=learned-motion&embed=1';frame.loading='lazy';
  frame.style.cssText='width:100%;height:1150px;border:0;display:block';host.append(frame);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='atlas-motion-height'||!Number.isFinite(event.data.height))return;
    frame.style.height=`${Math.max(300,Math.min(5000,event.data.height))}px`;
  });
}
