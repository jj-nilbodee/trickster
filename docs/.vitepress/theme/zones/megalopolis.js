// Progress counter and key-quest step tracking for this zone.
export default function init() {
  var KEY='megalopolis-ticks-v1', NEED=4, boxes=[].slice.call(document.querySelectorAll('input.stk,input.pre,input.key,input.mon'));
  var saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  boxes.forEach(function(b){ b.checked=!!saved[b.id]; b.addEventListener('change',update); });
  function update(){
    var st={}; boxes.forEach(function(b){ st[b.id]=b.checked;
      var row=b.closest('tr'), step=b.closest('.step'); (row||step).classList.toggle('is-done',b.checked); });
    try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}
    var earned=document.querySelectorAll('input.stk:checked').length, handed=st.k3;
    var have=handed?Math.max(0,earned-NEED):earned, msg, pct;
    document.getElementById('have').textContent=have;
    if(handed){ msg='ส่ง 4 อันให้ Artisan Poppuri แล้ว (ขั้น 3 เสร็จ)'+(have?' เหลือเกินมา '+have+' อัน':''); pct=100; }
    else if(earned>=NEED){ msg='ครบ 4 อันแล้ว ไปส่ง Artisan Poppuri ที่ Gate of Poppuri Dungeon พร้อมของเล่น 4 ชิ้น ได้เลย'; pct=100; }
    else { msg='ได้ Instant Adhesive จาก '+earned+' เควส ยังขาดอีก '+(NEED-earned)+' อัน'; pct=Math.round(earned/NEED*100); }
    var next=['k1', 'k2', 'k3', 'k4', 'k5'].filter(function(id){return !st[id]})[0];
    var names={k1:'ขั้น 1 (Scared Poppuri\'s Concern)',k2:'ขั้น 2 (Look for Toys)',k3:'ขั้น 3 (Fix Toys)',k4:'ขั้น 4 (Poppuri Redemption)',k5:'ขั้น 5 (Journey to Caballa Relics)'};
    msg+= next ? ' · ถัดไป: '+names[next] : ' · เควสกุญแจ Megalopolis ผ่านครบแล้ว';
    document.getElementById('msg').textContent=msg;
    document.getElementById('fill').style.width=pct+'%';
  }
  document.getElementById('reset').addEventListener('click',function(){ boxes.forEach(function(b){b.checked=false}); update(); });
  update();
}
