// Progress counter and key-quest step tracking for this zone.
export default function init() {
  var KEY='ghostblue-ticks-v1', boxes=[].slice.call(document.querySelectorAll('input.stk,input.pre,input.key,input.mon'));
  var saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  boxes.forEach(function(b){ b.checked=!!saved[b.id]; b.addEventListener('change',update); });
  function update(){
    var st={}; boxes.forEach(function(b){ st[b.id]=b.checked;
      var row=b.closest('tr'), step=b.closest('.step'); (row||step).classList.toggle('is-done',b.checked); });
    try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}
    var earned=document.querySelectorAll('input.stk:checked').length, handed=st.k1;
    var have=handed?Math.max(0,earned-10):earned;
    document.getElementById('have').textContent=have;
    var msg, pct;
    if(handed){ msg='ส่ง 10 ใบให้ Chief Koha แล้ว (ขั้น 1 เสร็จ)'+(have?' เหลือเกินมา '+have+' ใบ':''); pct=100; }
    else if(earned>=10){ msg='ครบ 10 ใบแล้ว ไปส่ง Chief Koha ที่ Aquarius ได้เลย'; pct=100; }
    else { msg='ทำเควสสติ๊กเกอร์ครบแล้ว '+earned+' เควส ยังขาดอีก '+(10-earned)+' ใบ'; pct=earned*10; }
    var next=['pre','k1','k2','k4','k3'].filter(function(id){return !st[id]})[0];
    var names={pre:'Marin\'s Sister',k1:'ขั้น 1',k2:'ขั้น 2',k4:'ขั้น 4 (Jia)',k3:'ขั้น 3 (ส่ง Jia\'s Pouch)'};
    msg+= next ? ' · ถัดไป: '+names[next] : ' · เควสกุญแจ Ghost Blue ผ่านครบแล้ว';
    document.getElementById('msg').textContent=msg;
    document.getElementById('fill').style.width=pct+'%';
  }
  document.getElementById('reset').addEventListener('click',function(){ boxes.forEach(function(b){b.checked=false}); update(); });
  update();
}
