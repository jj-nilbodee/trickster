// Episode quest pages: ticks per episode, chapter counters, next-quest hint, hide-done and (Episode 0) a character picker.
// Ticks live in localStorage under "ep<N>-ticks-v1"; the Story Quest page reads the same keys.
export var CLASS_KEY = 'episode-class-v1'
export function loadTicks(n) { try { return JSON.parse(localStorage.getItem('ep' + n + '-ticks-v1') || '{}') } catch (e) { return {} } }

export default function initEpisode(n, signal) {
  var KEY = 'ep' + n + '-ticks-v1', HIDE = 'ep-hide-done-v1'
  var st = loadTicks(n), root = document.querySelector('.pg .wrap')
  var boxes = [].slice.call(document.querySelectorAll('input.ep'))
  var sel = document.getElementById('cls'), hd = document.getElementById('hidedone')
  var cls = ''; try { cls = localStorage.getItem(CLASS_KEY) || '' } catch (e) {}
  if (sel) sel.value = cls
  var hide = false; try { hide = localStorage.getItem(HIDE) === '1' } catch (e) {}
  function applies(step) {
    if (!cls) return true
    if (step.dataset.only) return step.dataset.only === cls
    if (step.dataset.except) return step.dataset.except !== cls
    return true
  }
  function update() {
    var done = 0, total = 0, hearts = 0, next = null
    boxes.forEach(function (b) {
      var step = b.closest('.step'), ok = applies(step)
      b.checked = !!st[b.id]
      step.classList.toggle('is-done', b.checked)
      step.classList.toggle('na', !ok)
      if (!ok) return
      total++
      if (b.checked) { done++; if (step.dataset.heart) hearts++ } else if (!next) next = step
    })
    ;[].slice.call(document.querySelectorAll('.pg section[id^="ch-"]')).forEach(function (s) {
      var d = 0, t = 0
      s.querySelectorAll('input.ep').forEach(function (b) { if (!applies(b.closest('.step'))) return; t++; if (b.checked) d++ })
      var c = s.querySelector('.cnt'); if (c) { c.textContent = d + ' / ' + t; c.classList.toggle('full', t > 0 && d === t) }
    })
    document.getElementById('have').textContent = done
    document.getElementById('total').textContent = total
    document.getElementById('fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%'
    var msg = document.getElementById('msg'); msg.textContent = ''
    if (next) {
      msg.appendChild(document.createTextNode('ถัดไป: '))
      var a = document.createElement('a'); a.href = '#' + next.id; a.textContent = next.querySelector('h3').textContent
      msg.appendChild(a)
    } else msg.textContent = total ? 'จบ Episode ' + n + ' แล้ว' : ''
    if (document.querySelector('[data-heart]')) {
      var andrew = document.querySelector('[data-heart]') && st['e0-19']
      msg.appendChild(document.createTextNode(' · Heart Gem ที่ควรมี ' + Math.min(hearts, 8) + ' / 8' + (andrew ? ' (ส่งให้ Andrew แล้ว)' : '') + (cls ? '' : ' · เลือกตัวละครเพื่อซ่อนเควสที่ทำไม่ได้')))
    }
    root.classList.toggle('hide-done', hide)
    if (hd) hd.setAttribute('aria-pressed', String(hide))
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch (e) {} }
  boxes.forEach(function (b) {
    b.addEventListener('change', function () { if (b.checked) st[b.id] = 1; else delete st[b.id]; save(); update() }, { signal: signal })
  })
  if (sel) sel.addEventListener('change', function () { cls = sel.value; try { localStorage.setItem(CLASS_KEY, cls) } catch (e) {} update() }, { signal: signal })
  if (hd) hd.addEventListener('click', function () { hide = !hide; try { localStorage.setItem(HIDE, hide ? '1' : '0') } catch (e) {} update() }, { signal: signal })
  var rs = document.getElementById('reset')
  if (rs) rs.addEventListener('click', function () { if (confirm('ล้างติ๊กทั้งหมดใน Episode ' + n + '?')) { st = {}; save(); update() } }, { signal: signal })
  update()
}

// Story Quest page: progress per episode and chapter, read from the episode pages' ticks.
export function initStory() {
  var ticks = {}, done = 0, total = 0, next = null
  for (var n = 0; n < 7; n++) ticks[n] = loadTicks(n)
  // Episode 0 chapter 3: each character only does one of each pair, so count 9 quests there instead of 18.
  function count(ep, ids) {
    var d = 0; ids.forEach(function (id) { if (ticks[ep][id]) d++ }); return d
  }
  ;[].slice.call(document.querySelectorAll('.step.chap')).forEach(function (el) {
    var ep = +el.dataset.ep, ids = el.dataset.ids.split(','), t = ids.length
    if (ep === 0 && el.querySelector('h3').textContent === 'Our Prologue') t = 9
    var d = Math.min(count(ep, ids), t)
    var tag = el.querySelector('.chp'); tag.textContent = d + ' / ' + t; tag.classList.toggle('ok', d === t)
    el.classList.toggle('is-done', d === t)
    done += d; total += t
    if (d < t && !next) next = el
  })
  ;[].slice.call(document.querySelectorAll('h2 .cnt[data-ep]')).forEach(function (c) {
    var sec = c.closest('section'), d = 0, t = 0
    sec.querySelectorAll('.step.chap .chp').forEach(function (x) { var p = x.textContent.split(' / '); d += +p[0]; t += +p[1] })
    c.textContent = d + ' / ' + t; c.classList.toggle('full', d === t)
  })
  document.getElementById('have').textContent = done
  document.getElementById('total').textContent = total
  document.getElementById('fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%'
  var msg = document.getElementById('msg'); msg.textContent = ''
  if (next) {
    msg.appendChild(document.createTextNode('ทำถึง: Episode ' + next.dataset.ep + ' ' + next.querySelector('.num').textContent + ' '))
    var a = next.querySelector('a').cloneNode(true); a.textContent = next.querySelector('h3').textContent; msg.appendChild(a)
  } else msg.textContent = 'จบเนื้อเรื่องทั้งหมดแล้ว'
}
