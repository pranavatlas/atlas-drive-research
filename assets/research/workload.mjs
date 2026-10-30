const $=id=>document.getElementById(id);
const fields={torque_Nm:'drive-torque',speed_rpm:'drive-speed',run_s:'drive-duration',supply_V:'drive-voltage',peak_current_A:'drive-current'};
const name=id=>id==='proposed-design'?'Proposed design':id.replace('candidate-','Candidate ');
const apiOrigin=document.querySelector('meta[name="atlas-drive-api"]')?.content||'';
let token,report,revision=0,timer;
const hardware=document.createElement('iframe');
hardware.title='Compare joint actuator construction';hardware.src='replay/?study=joint-hardware';hardware.loading='lazy';
hardware.style.cssText='width:100%;height:850px;border:0;display:block';$('drive-hardware-host').append(hardware);
function syncHardware(){
  hardware.contentWindow?.postMessage({type:'atlas-joint-designs',selection:report?{
    selectedId:$('drive-candidate').value,choice:report.choice,inputs:report.inputs,
    models:report.models.map(({id,meets,model_fault,delivered_Nm,current_A,copper_J,hardware})=>({id,meets,model_fault,delivered_Nm,current_A,copper_J,hardware}))
  }:null},location.origin);
}
function invalidateHardware(){$('drive-hardware-host').hidden=true;syncHardware();}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==hardware.contentWindow)return;
  if(event.data?.type==='atlas-joint-hardware-ready')syncHardware();
  if(event.data?.type==='atlas-joint-hardware-height'&&Number.isFinite(event.data.height))hardware.style.height=`${Math.max(200,Math.min(2600,event.data.height))}px`;
  if(event.data?.type==='atlas-joint-inspect'&&report?.models.some(m=>m.id===event.data.id)){$('drive-candidate').value=event.data.id;inspect();$('drive-chart').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
});
async function api(path,options={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),apiOrigin?60000:10000);
  try{return await fetch(apiOrigin?new URL(path,apiOrigin+'/'):path,{...options,signal:controller.signal,cache:'no-store'});}
  catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('The calculator connection was interrupted. Use “Reconnect & compare” to try again.');throw e;}
  finally{clearTimeout(timeout);}
}
async function connect(){
  const response=await api('api/drive/status');
  if(!response.ok)throw Error('The calculator is temporarily unavailable. Use “Reconnect & compare” to try again.');
  const state=await response.json();
  if(!state.available||!state.session_token)throw Error(state.message||'The calculator is temporarily unavailable.');
  token=state.session_token;
  $('drive-service').textContent=apiOrigin?state.privacy:'Calculated here. Your inputs are not saved or sent to Atlas.';
}
async function calculate(inputs){
  if(!token)await connect();
  const send=()=>api('api/drive/screen',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Session':token},body:JSON.stringify({operating_point:inputs})});
  let response=await send();
  // A preview restart invalidates the previous token. Refresh once, without
  // making the visitor reload the page or lose their entered requirements.
  if(response.status===403){token=undefined;await connect();response=await send();}
  const result=await response.json();if(!response.ok)throw Error(result.error||'The calculator is temporarily unavailable.');
  return result;
}
function values(){return Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,Number($(id).value)]));}
function error(message){$('drive-error').textContent=message;$('drive-error').hidden=false;}
function inspect(){
  if(!report)return;
  const model=report.models.find(m=>m.id===$('drive-candidate').value),wanted=report.inputs;
  const svg=$('drive-chart');svg.replaceChildren();
  const node=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
  const high=Math.max(wanted.torque_Nm,...model.curve.map(p=>p.delivered_Nm),1)*1.15;
  const maxSpeed=model.curve.at(-1).rpm||1,x=s=>48+540*s/maxSpeed,y=v=>205-165*v/high;
  for(const v of [0,high/2,high]){node('line',{x1:48,x2:588,y1:y(v),y2:y(v),stroke:'#463b40'});node('text',{x:5,y:y(v)+4,fill:'#aaa6a6','font-size':11}).textContent=v.toFixed(0);}
  node('line',{x1:48,x2:588,y1:y(wanted.torque_Nm),y2:y(wanted.torque_Nm),stroke:'#bbb5b9','stroke-dasharray':'5 5'});
  let path='',pen=false;for(const point of model.curve){if(point.model_fault){pen=false;continue;}path+=`${pen?'L':'M'}${x(point.rpm)},${y(point.delivered_Nm)} `;pen=true;}
  node('path',{d:path,fill:'none',stroke:'#f65893','stroke-width':2.5});
  node('line',{x1:x(wanted.speed_rpm),x2:x(wanted.speed_rpm),y1:25,y2:205,stroke:'#70505f','stroke-dasharray':'3 3'});
  if(!model.model_fault)node('circle',{cx:x(wanted.speed_rpm),cy:y(model.delivered_Nm),r:5,fill:'#f65893'});
  for(const [xx,yy,label]of [[48,18,'Output torque · Nm'],[48,235,'0 rpm'],[535,235,`${maxSpeed.toFixed(0)} rpm`]])node('text',{x:xx,y:yy,fill:'#aaa6a6','font-size':11}).textContent=label;
  $('drive-delivered').textContent=model.model_fault?'Outside speed range':`${model.delivered_Nm.toFixed(1)} Nm`;
  $('drive-heat').textContent=model.model_fault?'—':`${model.copper_J.toFixed(0)} J`;
  $('drive-current-result').textContent=model.model_fault?'—':`${model.current_A.toFixed(1)} A`;
  $('drive-candidate-note').textContent=`${name(model.id)} ${model.meets?'meets':'does not meet'} ${wanted.torque_Nm} Nm at ${wanted.speed_rpm} rpm. The curve shows delivered torque for that same request across speeds. Heat is modeled copper loss over ${wanted.run_s} seconds; temperature is held at 25°C.`;
  $('drive-hardware-host').hidden=false;syncHardware();
}
function render(){
  const choice=report.choice,point=report.inputs;
  const power=report.power_proposal;
  $('drive-result-title').textContent=choice?`${name(choice)} meets your demand.`:power?`Proposed supply: ${power.inputs.supply_V} V.`:'This demand exceeds the searched designs.';
  $('drive-result-copy').textContent=choice?`We checked ${report.search.evaluated_designs} winding and gearing combinations for ${point.torque_Nm} Nm at ${point.speed_rpm} rpm. ${report.search.feasible_designs} qualify. This proposal has the lowest modeled copper loss across the designs compared.`:power?`A proposed design meets ${point.torque_Nm} Nm at ${point.speed_rpm} rpm with ${power.inputs.supply_V} V and the same ${point.peak_current_A} A drive limit. Keep the job; review the power change below.`:`No design in this bounded search meets ${point.torque_Nm} Nm at ${point.speed_rpm} rpm. The evaluated operating points below offer alternatives; Atlas can assess a different motor size.`;
  $('drive-power-proposal').hidden=!power;
  $('drive-compare-label').textContent=power?`Inspect designs at your current ${point.supply_V} V limit`:'Compare designs';
  if(power){$('drive-proposal-spec').textContent=`${point.torque_Nm} Nm · ${point.speed_rpm} rpm · ${power.inputs.supply_V} V · ${power.inputs.peak_current_A} A cap`;$('drive-proposal-note').textContent=`Modeled output ${power.model.delivered_Nm.toFixed(1)} Nm, ${power.model.current_A.toFixed(1)} A phase current. ${power.inputs.supply_V} V is the first passing supply on the searched grid. Your current ${point.supply_V} V limit remains active until you apply it.`;}
  $('drive-candidate').replaceChildren(...report.models.map(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=`${name(m.id)} · ${m.meets?'meets demand':'falls short'}`;return o;}));
  $('drive-candidate').value=choice||report.closest;
  $('drive-adjustments').replaceChildren();
  for(const a of report.adjustments){
    const b=document.createElement('button');b.type='button';b.className='drive-adjustment';
    const action=a.kind==='speed'?'Keep torque, reduce speed':a.kind==='torque'?'Keep speed, reduce torque':'Reduce torque and speed';
    b.textContent=`${action}: ${a.torque_Nm.toFixed(2)} Nm at ${a.speed_rpm.toFixed(2)} rpm ↗`;
    b.addEventListener('click',()=>{$('drive-torque').value=a.torque_Nm;$('drive-speed').value=a.speed_rpm;submit();});$('drive-adjustments').append(b);
  }
  $('drive-adjustments-note').hidden=!report.adjustments.length;
  $('drive-power').textContent=`${(point.torque_Nm*point.speed_rpm*Math.PI/30).toFixed(0)} W required at the shaft`;
  $('drive-results-content').hidden=false;inspect();
}
async function submit(){
  clearTimeout(timer);if(!$('drive-form').reportValidity())return;
  const rev=++revision;report=null;invalidateHardware();$('drive-results-content').hidden=true;$('drive-error').hidden=true;$('drive-run').disabled=true;
  $('drive-result-title').textContent='Designing around your inputs…';$('drive-result-copy').textContent='Searching winding and gearing combinations.';
  try{
    const result=await calculate(values());if(rev!==revision)return;
    report=result;render();$('drive-run').textContent='Compare actuator designs ↗';
  }catch(e){if(rev===revision){token=undefined;error(e.message);$('drive-service').textContent='Calculator connection unavailable. Your inputs are still here.';$('drive-result-title').textContent='Reconnect to calculate your answer.';$('drive-result-copy').textContent='Your inputs are still here.';$('drive-run').textContent='Reconnect & compare ↗';}}
  finally{if(rev===revision)$('drive-run').disabled=false;}
}
$('drive-form').addEventListener('submit',event=>{event.preventDefault();submit();});
for(const id of Object.values(fields))$(id).addEventListener('input',()=>{revision++;report=null;invalidateHardware();clearTimeout(timer);$('drive-results-content').hidden=true;$('drive-result-title').textContent='Updating your answer…';$('drive-result-copy').textContent='';timer=setTimeout(()=>{if($('drive-form').checkValidity())submit();else $('drive-result-title').textContent='Complete the inputs within the shown ranges.';},450);});
$('drive-candidate').addEventListener('change',inspect);
$('drive-apply-power').addEventListener('click',()=>{if(!report?.power_proposal)return;$('drive-voltage').value=report.power_proposal.inputs.supply_V;$('drive-current').value=report.power_proposal.inputs.peak_current_A;$('drive-form').querySelector('.drive-supply').open=true;submit();});
function applyPreset(id){
  const presets={arm:[30,30,10],fast:[8,100,5],heavy:[90,50,10]};
  const [torque,speed,seconds]=presets[id];
  $('drive-torque').value=torque;$('drive-speed').value=speed;$('drive-duration').value=seconds;
  $('drive-voltage').value=24;$('drive-current').value=15;submit();
}
for(const button of document.querySelectorAll('[data-drive-preset]'))button.addEventListener('click',()=>applyPreset(button.dataset.drivePreset));
$('drive-brief-open').addEventListener('click',()=>{
  if(!report)return;const c=$('drive-brief-content');c.replaceChildren();const title=document.createElement('p');title.textContent=$('drive-result-title').textContent;title.className='brief-status';c.append(title);
  for(const text of [`Request: ${report.inputs.torque_Nm} Nm at ${report.inputs.speed_rpm} rpm for ${report.inputs.run_s} s. Supply ${report.inputs.supply_V} V; phase-current cap ${report.inputs.peak_current_A} A.`,...(report.power_proposal?[`Proposed power for the same job: ${report.power_proposal.inputs.supply_V} V with ${report.power_proposal.inputs.peak_current_A} A phase-current cap. Modeled output ${report.power_proposal.model.delivered_Nm.toFixed(1)} Nm. Apply the proposal to update the active inputs.`]:[]),...report.adjustments.map(a=>`Tested alternative: ${a.torque_Nm} Nm at ${a.speed_rpm} rpm, ${name(a.candidate)}.`),report.rule,report.scope]){const p=document.createElement('p');p.textContent=text;c.append(p);}
  $('drive-brief').showModal();
});
$('drive-print').addEventListener('click',()=>window.print());
$('drive-run').disabled=false;
applyPreset('arm');
