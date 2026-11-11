// Progress counter and key-quest step tracking for this zone.
export default function init() {
  var KEY='tapasco-ticks-v1', NEED=14, boxes=[].slice.call(document.querySelectorAll('input.stk,input.pre,input.key,input.mon'));
  var saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  boxes.forEach(function(b){ b.checked=!!saved[b.id]; b.addEventListener('change',update); });
  function update(){
    var st={}; boxes.forEach(function(b){ st[b.id]=b.checked;
      var row=b.closest('tr'), step=b.closest('.step'); (row||step).classList.toggle('is-done',b.checked); });
    try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}
    var earned=document.querySelectorAll('input.stk:checked').length, handed=st.k1;
    var have=handed?Math.max(0,earned-NEED):earned, msg, pct;
    document.getElementById('have').textContent=have;
    if(handed){ msg='ส่ง 14 ใบให้ Clerk Z. Smith แล้ว (ขั้น 1 เสร็จ)'+(have?' เหลือเกินมา '+have+' ใบ':''); pct=100; }
    else if(earned>=NEED){ msg='ครบ 14 ใบแล้ว ไปส่ง Clerk Z. Smith ที่ Tapasco Field 1 - Net of Lava ได้เลย'; pct=100; }
    else { msg='ได้ Tapasco Sticker จาก '+earned+' เควส ยังขาดอีก '+(NEED-earned)+' ใบ'; pct=Math.round(earned/NEED*100); }
    var next=['k1', 'k2', 'k3', 'k4', 'k6', 'k5', 'k7'].filter(function(id){return !st[id]})[0];
    var names={k1:'ขั้น 1 (ส่งสติ๊กเกอร์)',k2:'ขั้น 2 (Absolute Ring)',k3:'ขั้น 3 (Ptah\'s Secrets)',k4:'ขั้น 4 (Special Flame)',k5:'ขั้น 5 (ส่ง The Ring\'s Abilities)',k6:'ขั้น 6 (Show Me Your Skill)',k7:'ขั้น 7 (For Their Goals)'};
    msg+= next ? ' · ถัดไป: '+names[next] : ' · เควสกุญแจ Tapasco Volcano ผ่านครบแล้ว';
    document.getElementById('msg').textContent=msg;
    document.getElementById('fill').style.width=pct+'%';
  }
  document.getElementById('reset').addEventListener('click',function(){ boxes.forEach(function(b){b.checked=false}); update(); });
  update();
}
