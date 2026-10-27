"use strict";
let scanStream=null,scanWorker=null,ocrPromise=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function scannerStatus(message){
  const status=$("scanStatus");
  if(status)status.textContent=message;
}
function openScanner(){
  $("scannerLayer").innerHTML=`<div class="scan-overlay" role="presentation" onclick="if(event.target===this)closeScanner()"><section class="scan-dialog" role="dialog" aria-modal="true" aria-labelledby="scanTitle">
  <h2 id="scanTitle">Scan bus number plate</h2><p class="sub l">Position the plate clearly in view, then capture it. OCR runs in your browser; camera frames and selected photos stay on this device.</p>
  <video id="scanVideo" autoplay muted playsinline aria-label="Live camera preview"></video>
  <div class="scan-actions"><button id="capturePlateBtn" class="btn" onclick="scanPlate()" disabled>Capture &amp; scan</button><button id="retryCameraBtn" class="ghost" onclick="requestScannerCamera()" hidden>Retry camera</button><label class="ghost" for="scanImageInput">Use phone camera or choose photo</label><input id="scanImageInput" type="file" accept="image/*" capture="environment" hidden onchange="scanPlateImage(this.files?.[0])"><button class="ghost" onclick="closeScanner()">Cancel</button></div>
  <div id="scanStatus" class="scan-status" role="status" aria-live="polite">Requesting camera access…</div>
  <label for="scanText">Detected text (edit if needed)</label><textarea id="scanText" class="scan-result" placeholder="Scanned plate text will appear here"></textarea>
  <button class="ghost" style="margin-top:8px" onclick="matchScannedText()">Match plate to bus</button><div id="scanCandidates" class="scan-candidates"></div>
  </section></div>`;
  requestScannerCamera();
  $("scanText").focus();
}
function requestScannerCamera(){
  const retryButton=$("retryCameraBtn");
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    scannerStatus("Live camera access requires HTTPS or localhost. Use your phone camera/photo above instead.");
    return;
  }
  if(retryButton)retryButton.disabled=true;
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false})
    .then(stream=>{
      if(!$("scanVideo")){stream.getTracks().forEach(track=>track.stop());return}
      scanStream=stream;
      const video=$("scanVideo");video.srcObject=stream;
      return video.play().then(()=>{
        if($("capturePlateBtn"))$("capturePlateBtn").disabled=false;
        if(retryButton)retryButton.hidden=true;
        scannerStatus("Camera ready. Center the plate and capture it.");
      });
    })
    .catch(error=>{
      if(retryButton){retryButton.hidden=false;retryButton.disabled=false}
      const reason=error.name==="NotAllowedError"?"Camera permission was blocked. Close any floating bubbles or overlays and try again, or use your phone camera/photo above.":error.name==="NotFoundError"?"No camera was found on this device. Use your phone camera/photo above instead.":error.name==="NotReadableError"?"The camera is busy in another app. Close it and try again, or use your phone camera/photo above.":"Could not start the camera: "+error.message+" You can use your phone camera/photo above.";
      scannerStatus(reason);
    });
}
function closeScanner(){
  if(scanStream){scanStream.getTracks().forEach(track=>track.stop());scanStream=null}
  const video=$("scanVideo");if(video)video.srcObject=null;
  $("scannerLayer").innerHTML="";
  document.getElementById("scan")?.focus();
}
function loadOcr(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(ocrPromise)return ocrPromise;
  ocrPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR library loaded without its API."));
    script.onerror=()=>reject(new Error("Could not download the OCR library. Check your internet connection and try again."));
    document.head.appendChild(script);
  }).catch(error=>{ocrPromise=null;throw error});
  return ocrPromise;
}
async function getScanWorker(){
  if(scanWorker)return scanWorker;
  const Tesseract=await loadOcr();
  scanWorker=await Tesseract.createWorker("eng",1,{logger:message=>{
    if(message.status==="recognizing text")scannerStatus("Reading plate… "+Math.round((message.progress||0)*100)+"%");
    else if(message.status==="loading language model")scannerStatus("Loading English OCR model…");
  }});
  return scanWorker;
}
async function recognizePlate(image,button){
  if(button)button.disabled=true;
  try{
    scannerStatus("Preparing OCR…");
    const worker=await getScanWorker(),result=await worker.recognize(image);
    const text=$("scanText");
    if(text){text.value=result.data.text.trim();matchScannedText()}
  }catch(error){
    scannerStatus("Plate scan failed: "+error.message);
  }finally{
    if(button&&button.isConnected)button.disabled=false;
  }
}
async function scanPlate(){
  const video=$("scanVideo");
  if(!video||!video.videoWidth)return scannerStatus("Camera is not ready yet.");
  const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);
  await recognizePlate(canvas,$("capturePlateBtn"));
}
async function scanPlateImage(file){
  const input=$("scanImageInput");
  if(!file)return;
  if(input)input.value="";
  await recognizePlate(file,input);
}
function plateCandidates(){return window.workerQueue().map(b=>({...b,id:b.busId,reg:b.regNo}));}
function matchScannedText(){
  const text=$("scanText").value.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!text)return scannerStatus("No plate text detected. Capture again or enter the registration manually.");
  const matches=plateCandidates().filter(bus=>text.includes(bus.reg.toUpperCase().replace(/[^A-Z0-9]/g,"")));
  const list=$("scanCandidates");list.innerHTML="";
  if(matches.length===1)return selectScannedBus(matches[0].id);
  if(matches.length>1){
    scannerStatus("Several buses matched. Choose the correct registration:");
    list.innerHTML=matches.map(bus=>`<button class="ghost" data-bus-id="${esc(bus.id)}">${esc(bus.reg)} · ${esc(bus.id)}</button>`).join("");
    list.querySelectorAll("[data-bus-id]").forEach(button=>button.addEventListener("click",()=>selectScannedBus(button.dataset.busId)));
    return;
  }
  scannerStatus("No exact match in this depot’s "+"entry"+" queue. Review the detected text and try again.");
}
function selectScannedBus(id){
 const bus=plateCandidates().find(b=>b.id===id);
 if(!bus)return scannerStatus('This bus is no longer waiting. Refresh the list.');
 closeScanner();window.workerSelectScanned(id);
}

window.addEventListener("pagehide",()=>{scanStream?.getTracks().forEach(t=>t.stop());scanWorker?.terminate();});

window.addEventListener('keydown',event=>{
 const overlay=document.querySelector('.scan-overlay');if(!overlay)return;
 if(event.key==='Escape'){event.preventDefault();closeScanner();return;}
 if(event.key==='Tab'){
  const elements=[...overlay.querySelectorAll('button:not(:disabled),input:not([hidden]),textarea,select,[tabindex="0"]')].filter(e=>!e.hidden&&e.getClientRects().length);
  const first=elements[0],last=elements[elements.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
});
