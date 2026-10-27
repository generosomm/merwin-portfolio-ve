import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile('js/interactions.js','utf8');
const code = source.slice(source.indexOf('  function initProjectForm()'), source.indexOf('  function initStackFit()'));
async function run({ body={success:true}, ok=true, invalid=false, fail=false, timeout=false, duplicate=false }={}) {
 let submit, requests=0, reset=0, timer, timerCleared=false, release;
 const status={textContent:'',dataset:{}};const button={disabled:false};
 const form={dataset:{key:'public-test-form-id',endpoint:'https://api.web3forms.com/submit',messages:JSON.stringify({sending:'Sending',sent:'Accepted',failed:'Failed',subject:'Project: {service}',name:'Name',replyTo:'Email',service:'Service',message:'Details'})},reportValidity:()=>!invalid,querySelector:s=>s==='.brief-status'?status:s==='button[type="submit"]'?button:{selectedOptions:[{textContent:'Website'}]},addEventListener:(event,fn)=>submit=fn,reset:()=>reset++};
 const fetch=async(url,options)=>{requests++;assert.equal(url,form.dataset.endpoint);const sent=JSON.parse(options.body);assert.equal(sent.email,'visitor@example.com');assert.match(sent.message,/Website/);assert.equal(sent.access_key,form.dataset.key);if(duplicate)await new Promise(r=>release=r);if(timeout)await new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new Error('timeout')));queueMicrotask(()=>timer());});if(fail)throw new Error('offline');return {ok,json:async()=>body};};
 const context=vm.createContext({document:{querySelector:()=>form},FormData:class{*entries(){yield*Object.entries({name:'Visitor',email:'visitor@example.com',service:'website',message:'Please build a website.'});}},fetch,AbortController,setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>timerCleared=true});
 vm.runInContext(code+';initProjectForm();',context);
 const pending=submit({preventDefault(){}});
 if(duplicate){await submit({preventDefault(){}});release();}
 await pending;return {requests,reset,state:status.dataset.state,buttonEnabled:!button.disabled,timerCleared};
}
assert.deepEqual(await run(),{requests:1,reset:1,state:'ok',buttonEnabled:true,timerCleared:true});
for(const options of [{body:{success:false}},{body:{}},{ok:false},{fail:true},{timeout:true}]){const r=await run(options);assert.equal(r.reset,0);assert.equal(r.state,'error');assert.equal(r.buttonEnabled,true);assert.equal(r.timerCleared,true);}
assert.equal((await run({invalid:true})).requests,0);
assert.equal((await run({duplicate:true})).requests,1);
console.log('Contact form checks passed: accepted response, invalid input, rejected/malformed/offline/timeout and duplicate submissions.');
