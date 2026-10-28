const host=document.getElementById('olympics-host');
if(host){
  const frame=document.createElement('iframe');
  frame.title='Robot Olympics: courses, actuators, videos and 3D replays';
  frame.src='replay/?study=olympics&embed=1';frame.loading='lazy';
  frame.style.cssText='width:100%;height:1500px;border:0;display:block';host.append(frame);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='atlas-olympics-height'||!Number.isFinite(event.data.height))return;
    frame.style.height=`${Math.max(300,Math.min(6000,event.data.height))}px`;
  });
}
