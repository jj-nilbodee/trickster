// Checklist ticks, per-section counters, search and hide-done for guide pages.
// KEY is the localStorage key; DAILY clears ticks when the date changes.
export default function initGuide(KEY, DAILY) {
function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function load(){try{var s=JSON.parse(localStorage.getItem(KEY)||'{}'); if(DAILY&&s.date!==today()) return {}; return s.t||{};}catch(e){return {};}}
function save(t){try{localStorage.setItem(KEY,JSON.stringify({date:today(),t:t}));}catch(e){}}
var t=load(), boxes=[].slice.call(document.querySelectorAll('td.ck input'));
function refresh(){
  var done=0;
  boxes.forEach(function(b){b.checked=!!t[b.id]; b.closest('tr').classList.toggle('done',b.checked); if(b.checked) done++;});
  [].slice.call(document.querySelectorAll('section[data-c]')).forEach(function(s){
    var bs=s.querySelectorAll('td.ck input'), n=0; bs.forEach(function(b){if(b.checked)n++;});
    var c=s.querySelector('.cnt'); if(c){c.textContent=n+' / '+bs.length; c.classList.toggle('full',n===bs.length&&n>0);}
  });
  var p=document.getElementById('prog'); if(p){p.querySelector('.n').textContent=done+' / '+boxes.length; p.querySelector('.fill').style.width=(boxes.length?100*done/boxes.length:0)+'%';}
}
boxes.forEach(function(b){b.addEventListener('change',function(){if(b.checked)t[b.id]=1; else delete t[b.id]; save(t); refresh();});});
var hd=document.getElementById('hidedone');
if(hd){try{hd.checked=localStorage.getItem(KEY+'-hide')==='1';}catch(e){}
  var ap=function(){document.querySelector('.pg .wrap').classList.toggle('hide-done',hd.checked);}; ap();
  hd.addEventListener('change',function(){try{localStorage.setItem(KEY+'-hide',hd.checked?'1':'0');}catch(e){} ap();});}
var rs=document.getElementById('reset'); if(rs) rs.addEventListener('click',function(){if(confirm('ล้างติ๊กทั้งหมดในหน้านี้?')){t={};save(t);refresh();}});
var q=document.getElementById('q');
if(q) q.addEventListener('input',function(){
  var v=q.value.trim().toLowerCase();
  [].slice.call(document.querySelectorAll('tbody tr')).forEach(function(r){r.classList.toggle('nomatch',!!v&&r.textContent.toLowerCase().indexOf(v)<0);});
  [].slice.call(document.querySelectorAll('section[data-c]')).forEach(function(s){var rows=s.querySelectorAll('tbody tr'); if(!rows.length) return;
    s.classList.toggle('nomatch',!!v&&!s.querySelector('tbody tr:not(.nomatch)'));});
});
refresh();
}
