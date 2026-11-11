// Progress counter and key-quest step tracking for this zone.
export default function init() {
  var KEY='snowhill-ticks-v1', NEED=14, boxes=[].slice.call(document.querySelectorAll('input.stk,input.pre,input.key,input.mon'));
  var saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  boxes.forEach(function(b){ b.checked=!!saved[b.id]; b.addEventListener('change',update); });
  function update(){
    var st={}; boxes.forEach(function(b){ st[b.id]=b.checked;
      var row=b.closest('tr'), step=b.closest('.step'); (row||step).classList.toggle('is-done',b.checked); });
    try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}
    var earned=document.querySelectorAll('input.stk:checked').length, handed=st.k1;
    var have=handed?Math.max(0,earned-NEED):earned, msg, pct;
    document.getElementById('have').textContent=have;
    if(handed){ msg='ส่ง 14 ใบให้ Fairy Godmother แล้ว (ขั้น 1 เสร็จ)'+(have?' เหลือเกินมา '+have+' ใบ':''); pct=100; }
    else if(earned>=NEED){ msg='ครบ 14 ใบแล้ว ไปส่ง Fairy Godmother ที่ Snow Hill Town - Laplanoel ได้เลย'; pct=100; }
    else { msg='ได้สติ๊กเกอร์จาก '+earned+' เควส ยังขาดอีก '+(NEED-earned)+' ใบ'; pct=Math.round(earned/NEED*100); }
    var next=['c1','c2','c3','k1','k4','k3','k2','k5','k6','k7'].filter(function(id){return !st[id]})[0];
    var names={c1:'ก่อนเริ่ม 1 (Chagan\'s Dream)',c2:'ก่อนเริ่ม 2 (Dream Reader)',c3:'ก่อนเริ่ม 3 (Interpret Chagan\'s Dream)',k1:'ขั้น 1 (ส่งสติ๊กเกอร์)',k2:'ขั้น 2 (Save the Snow Machine)',k3:'ขั้น 3 (Broken Promise)',k4:'ขั้น 4 (Truth Draught)',k5:'ขั้น 5 (ผสม Fixed Remote)',k6:'ขั้น 6 (Fix the Remote Control)',k7:'ขั้น 7 (Finding Peace Again)'};
    msg+= next ? ' · ถัดไป: '+names[next] : ' · เควสกุญแจ Snow Hill ผ่านครบแล้ว';
    document.getElementById('msg').textContent=msg;
    document.getElementById('fill').style.width=pct+'%';
  }
  document.getElementById('reset').addEventListener('click',function(){ boxes.forEach(function(b){b.checked=false}); update(); });
  update();
}
