// Hide/show quest rows, item totals per map and "ready to hand in" badges for key-quest pages.
// KEY is the localStorage key; signal removes the document listener when the page unmounts.
export default function initKeyRows(KEY, signal) {
  var hidden={}, bulk=false;
  try{var o=JSON.parse(localStorage.getItem(KEY)||'{}'); hidden=o.rows||{}; bulk=!!o.bulk}catch(e){}
  var stkRows=[].slice.call(document.querySelectorAll('input.stk,input.pre')).map(function(b){return b.closest('tr')});
  var allRows=stkRows;
  stkRows.forEach(function(tr){
    var id=tr.querySelector('input').id, td=tr.children[1];
    var btn=document.createElement('button'); btn.type='button'; btn.className='hide'; btn.textContent='ซ่อน';
    btn.setAttribute('aria-label','ซ่อนเควสนี้');
    btn.addEventListener('click',function(){ hidden[id]=1; apply(); });
    td.appendChild(btn); tr.dataset.rid=id;
  });


  function updateReady(){
    var need={};
    [].slice.call(document.querySelectorAll('tr[data-q]')).forEach(function(tr){
      var box=tr.querySelector('input.mon');
      JSON.parse(tr.dataset.q).forEach(function(c){ (need[c[0]]=need[c[0]]||[]).push(box.checked); });
    });
    [].slice.call(document.querySelectorAll('.ready')).forEach(function(el){ el.remove(); });
    Object.keys(need).forEach(function(id){
      var b=document.getElementById(id); if(!b || b.checked) return;
      var got=need[id].filter(Boolean).length, all=need[id].length; if(!got) return;
      var tag=document.createElement('span'); tag.className='ready'+(got===all?' ok':'');
      tag.textContent= got===all ? 'ของครบ ส่งเควสได้' : 'ของครบ '+got+'/'+all;
      var host=b.closest('tr') ? b.closest('tr').children[1] : b.closest('.step').querySelector('.head');
      host.appendChild(tag);
    });
  }
  function updateMon(){
    var vis={}; stkRows.forEach(function(tr){ if(!tr.hidden) vis[tr.dataset.rid]=1; });
    [].slice.call(document.querySelectorAll('input.key')).forEach(function(b){ vis[b.id]=1; });
    function done(id){ var b=document.getElementById(id); return !!(b&&b.checked); }
    [].slice.call(document.querySelectorAll('tr[data-q]')).forEach(function(tr){
      var q=JSON.parse(tr.dataset.q), sum=0, total=0, unk=false, labels=[], shown=0;
      q.forEach(function(c){ if(!vis[c[0]]) return; shown++; total+=c[1];
        if(done(c[0])){ if(c[2]) labels.push(c[2]+' ✓'); }
        else { sum+=c[1]; if(c[3]) unk=true; if(c[2]) labels.push(c[2]); } });
      tr.hidden=!shown;
      var unit=tr.dataset.unit||'', cell=tr.querySelector('td.n');
      if(shown && !sum){ cell.textContent='ทำเควสแล้ว'; }
      else { cell.textContent=sum+(unk?'+*':'')+(unit?' '+unit:'')+(sum<total?' (จาก '+total+')':''); }
      tr.children[5].textContent=labels.join(' + ');
      var box=tr.querySelector('input.mon');
      tr.classList.toggle('is-done', (shown && !sum) || box.checked);
    });
  }
  document.addEventListener('change',function(e){ if(e.target.matches('input')){ updateMon(); updateReady(); } }, { signal });
  function starred(tr){ return !!tr.querySelector('.rec'); }
  function apply(){
    var n=0;
    allRows.forEach(function(tr){
      var h=(bulk && !starred(tr)) || (tr.dataset.rid && hidden[tr.dataset.rid]);
      tr.hidden=!!h; if(h) n++;
    });
    document.getElementById('hideUnstar').textContent= bulk ? 'แสดงเควสที่ไม่ติดดาว' : 'ซ่อนเควสที่ไม่ติดดาว';
    document.getElementById('hideUnstar').setAttribute('aria-pressed', bulk);
    var sa=document.getElementById('showAll'); sa.hidden=!n; sa.textContent='แสดงทั้งหมด ('+n+' แถวที่ซ่อน)';
    updateMon(); updateReady();
    try{localStorage.setItem(KEY,JSON.stringify({rows:hidden,bulk:bulk}))}catch(e){}
  }
  document.getElementById('hideUnstar').addEventListener('click',function(){ bulk=!bulk; apply(); });
  document.getElementById('showAll').addEventListener('click',function(){ bulk=false; hidden={}; apply(); });
  apply();
}
