export function assess(data, job, command) {
  if (data.schema !== 'atlas-manufacturing-proposition-v1' || !Object.hasOwn(data.jobs, job)) throw Error('Unknown workload.');
  const item=data.jobs[job], point=item.timing.find(p=>p.command_ms===command);
  if(!point) throw Error('This timing has not been tested.');
  for(const key of ['reference','selected']) {
    if(point[key].length!==point.trials || point[key].some(v=>typeof v!=='boolean')) throw Error('Incomplete trial evidence.');
    if(!Number.isFinite(point.model_fault_cases?.[key])) throw Error('Missing fault accounting.');
  }
  const reference=point.reference.filter(Boolean).length, selected=point.selected.filter(Boolean).length;
  const target=Math.ceil(data.required_pass_fraction*point.trials);
  const referenceMeets=reference>=target && point.model_fault_cases.reference===0;
  const selectedMeets=selected>=target && point.model_fault_cases.selected===0;
  return {item,point,reference,selected,target,status:referenceMeets?(selectedMeets?'both':'reference'):(selectedMeets?'selected':'neither')};
}

if (typeof document !== 'undefined') {
  const $=id=>document.getElementById(id), text=(id,value)=>{$(id).textContent=value;};
  let data,current,frame,mode='video',inspect=false;
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow||event.data?.type!=='atlas-arm-replay-height'||!Number.isFinite(event.data.height))return;
    frame.style.height=`${Math.max(160,Math.min(2200,event.data.height))}px`;
  });
  function createReplay(){
    if(frame)frame.remove();
    frame=document.createElement('iframe');frame.title='Reference and selected actuator at your chosen payload and timing';
    frame.src=`replay/?embed=1&job=${encodeURIComponent($('job').value)}&command=${current.point.command_ms}${inspect?'&inspect=1':''}`;
    frame.allow='fullscreen';$('replay-panel').replaceChildren(frame);
  }
  function note(){
    text('viewer-note',`${current.item.payload_kg} kg · ${current.point.command_ms} ms sideways move. ${mode==='video'?'Slow-motion film':'Recorded 3D motion'} of the first trial; the counts include all 32.`);
  }
  function setMode(value,atDeadline=false){
    mode=value;inspect=atDeadline;
    $('mode-video').setAttribute('aria-pressed',String(mode==='video'));
    $('mode-3d').setAttribute('aria-pressed',String(mode==='3d'));
    $('video-panel').hidden=mode!=='video';$('replay-panel').hidden=mode!=='3d';
    if(mode==='3d'){$('arm-video').pause();createReplay();}
    else if(frame){frame.remove();frame=null;}
    note();
  }
  function update(){
    current=assess(data,$('job').value,Number($('command').value));
    const {item,point,reference,selected,target,status}=current;
    text('job-sentence',`Move ${item.payload_kg} kg across the table in ${point.command_ms} ms.`);
    text('move-time',`${point.command_ms} ms`);text('target-count',`${target} / ${point.trials} trials`);
    text('mass-note',item.mass_added_kg.toFixed(2));
    text('reference-count',`${reference} / ${point.trials}`);text('selected-count',`${selected} / ${point.trials}`);
    $('reference-bar').style.width=`${100*reference/point.trials}%`;$('selected-bar').style.width=`${100*selected/point.trials}%`;
    text('decision-label','What the trials show');
    text('decision-title',({selected:'The selected actuator meets this timing.',reference:'The reference meets this timing.',both:'Both meet this timing.',neither:'Neither meets the 90% target.'})[status]);
    text('decision-copy',status==='neither'?`Selected: ${selected}/32. Reference: ${reference}/32. Each needs ${target} passes to meet the target at this setting.`:`Selected: ${selected}/32. Reference: ${reference}/32. Same arm, motion command and controller.`);
    const alternative=item.timing.map(p=>assess(data,$('job').value,p.command_ms)).find(r=>r.status==='selected'||r.status==='both');
    $('timing-fix').hidden=status!=='neither'||!alternative;
    if(status==='neither'&&alternative){
      const ms=alternative.point.command_ms,extra=ms-point.command_ms;
      text('decision-title',extra>0?`Allow ${extra} ms more.`:'The other tested timing settles better.');
      text('decision-copy',`At ${point.command_ms} ms, the selected actuator passes ${selected}/32. At ${ms} ms, it passes ${alternative.selected}/32 and meets the observed 90% target.`);
      text('timing-fix',`Use ${ms} ms ↗`);$('timing-fix').onclick=()=>{$('command').value=ms;update();};
    }
    $('workbench').dataset.decision=status;
    text('deadline-open',point.reference[0]?'Inspect this trial’s deadline ↗':'See why the reference misses ↗');
    const video=$('arm-video');video.pause();video.poster=point.poster;video.src=point.video;video.load();
    if(mode==='3d')createReplay();note();
    for(const key of ['reference','selected']){
      text(`timing-${key}-count`,`${current[key]} / ${point.trials}`);
      const grid=$(`timing-${key}`);grid.setAttribute('aria-label',`${key}: ${current[key]} of ${point.trials} trials pass at ${point.command_ms} milliseconds`);
      grid.replaceChildren(...point[key].map((pass,i)=>{const square=document.createElement('span');square.className=pass?'passed':'missed';square.title=`Trial ${i+1}: ${pass?'passes':'misses'}`;return square;}));
    }
    text('timing-note',`${item.payload_kg} kg · ${point.command_ms} ms move + 100 ms settling. These are the same settings shown in the film and 3D replay.`);
  }
  function changeJob(){
    const index=Math.max(0,$('command').selectedIndex);
    $('command').replaceChildren(...data.jobs[$('job').value].timing.map((p,i)=>{const option=document.createElement('option');option.value=p.command_ms;option.textContent=`${p.command_ms} ms${i?' · 25 ms more':''}`;return option;}));
    $('command').selectedIndex=Math.min(index,$('command').options.length-1);update();
  }
  $('job').addEventListener('change',changeJob);$('command').addEventListener('change',update);
  $('mode-video').addEventListener('click',()=>setMode('video'));$('mode-3d').addEventListener('click',()=>setMode('3d'));
  $('deadline-open').addEventListener('click',()=>setMode('3d',true));
  fetch('assets/research/manufacturing/data.json').then(r=>{if(!r.ok)throw Error('The recorded trials could not be loaded.');return r.json();}).then(value=>{
    data=value;changeJob();$('workbench').setAttribute('aria-busy','false');
    for(const id of ['job','command','mode-video','mode-3d','deadline-open'])$(id).disabled=false;
  }).catch(e=>{$('load-error').hidden=false;text('load-error',e.message);text('decision-title','Evidence unavailable.');text('decision-copy','Reload to load the recorded trials.');$('workbench').setAttribute('aria-busy','false');});
}
