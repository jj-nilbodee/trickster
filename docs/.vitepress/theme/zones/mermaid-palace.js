// Progress counter and key-quest step tracking for this zone.
export default function init() {
  var KEY='mermaid-ticks-v1', NEED=7, boxes=[].slice.call(document.querySelectorAll('input.stk,input.pre,input.key,input.mon'));
  var saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  boxes.forEach(function(b){ b.checked=!!saved[b.id]; b.addEventListener('change',update); });
  function update(){
    var st={}; boxes.forEach(function(b){ st[b.id]=b.checked;
      var row=b.closest('tr'), step=b.closest('.step'); (row||step).classList.toggle('is-done',b.checked); });
    try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}
    var earned=document.querySelectorAll('input.stk:checked').length, handed=st.k1;
    var have=handed?Math.max(0,earned-NEED):earned, msg, pct;
    document.getElementById('have').textContent=have;
    if(handed){ msg='ส่ง 7 ใบให้ Captain Stan แล้ว (ขั้น 1 เสร็จ)'+(have?' เหลือเกินมา '+have+' ใบ':''); pct=100; }
    else if(earned>=NEED){ msg='ครบ 7 ใบแล้ว ไปส่ง Captain Stan ที่ Gate of Mermaid Palace ได้เลย (อย่าลืม Old Picture)'; pct=100; }
    else { msg='ได้สติ๊กเกอร์จาก '+earned+' เควส ยังขาดอีก '+(NEED-earned)+' ใบ'; pct=Math.round(earned/NEED*100); }
    var next=['k1','k3','k2','k4'].filter(function(id){return !st[id]})[0];
    var names={k1:'ขั้น 1 (ส่งสติ๊กเกอร์)',k2:'ขั้น 2 (ส่ง Tanya\'s Letter ให้ Captain Stan)',k3:'ขั้น 3 (Marin\'s Sister)',k4:'ขั้น 4 (Megalo Ship\'s Heidi)'};
    msg+= next ? ' · ถัดไป: '+names[next] : ' · เควสกุญแจ Mermaid Palace ผ่านครบแล้ว';
    document.getElementById('msg').textContent=msg;
    document.getElementById('fill').style.width=pct+'%';
  }
  document.getElementById('reset').addEventListener('click',function(){ boxes.forEach(function(b){b.checked=false}); update(); });
  update();
}
