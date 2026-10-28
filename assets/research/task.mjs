const host=document.getElementById('task-host');
if(host){
  const frame=document.createElement('iframe');
  frame.title='Set the robot task: payload, timing, reach and actuator comparison';
  frame.src='replay/?study=task&embed=1';frame.loading='lazy';
  frame.style.cssText='width:100%;height:1200px;border:0;display:block';host.append(frame);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='atlas-task-height'||!Number.isFinite(event.data.height))return;
    frame.style.height=`${Math.max(300,Math.min(5000,event.data.height))}px`;
  });
}
