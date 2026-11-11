// Foldable sections for guide and key-quest pages. Each foldable section gets a chevron button in its h2
// and a "#" link that copies a URL straight to it. Folded sections are remembered per page in localStorage.
// Not foldable: short intro/info sections and the key-quest progress counter, which are always useful to see.
var SKIP = { go: 1, tp: 1, req: 1 }
// Sections folded until the reader opens them (their choice is then remembered).
var FOLD_BY_DEFAULT = ['รูปจากวิกิ']

export default function initFold(page, signal) {
  var KEY = 'fold:' + page, folded = {}
  try { folded = JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) {}
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(folded)) } catch (e) {} }
  var root = document.querySelector('.pg .wrap') || document.querySelector('.pg')
  if (!root) return
  var secs = [].slice.call(root.querySelectorAll('section')).filter(function (s) {
    var h = s.querySelector(':scope > h2')
    if (!h || s.classList.contains('counter') || SKIP[s.id]) return false
    return h.textContent.replace(/\u200b/g, '').trim() !== 'ภาพรวม'
  })
  secs.forEach(function (s, i) {
    var h = s.querySelector(':scope > h2')
    var id = s.id || h.id || 'sec' + i
    if (!s.id && !h.id) s.id = id
    s.dataset.fold = id
    if (!(id in folded) && FOLD_BY_DEFAULT.indexOf(h.textContent.replace(/\u200b/g, '').trim()) >= 0) s.dataset.defFold = '1'
    s.classList.add('foldable')
    var btn = document.createElement('button')
    btn.type = 'button'; btn.className = 'fold-btn'; btn.setAttribute('aria-label', 'พับหรือกางหัวข้อนี้')
    btn.innerHTML = '<span aria-hidden="true">▾</span>'
    h.insertBefore(btn, h.firstChild)
    var link = document.createElement('a')
    link.className = 'fold-link'; link.href = '#' + encodeURIComponent(h.id || id); link.title = 'คัดลอกลิงก์มาหัวข้อนี้'; link.textContent = '#'
    h.appendChild(link)
    h.addEventListener('click', function (e) {
      if (e.target.closest('a,input,label')) return
      set(s, !isFolded(s))
    }, { signal: signal })
    link.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation()
      set(s, false)
      var u = new URL(location.href); u.hash = h.id || id
      history.replaceState(history.state, '', u)
      s.scrollIntoView()
      if (navigator.clipboard) navigator.clipboard.writeText(u.href).then(function () {
        link.textContent = 'คัดลอกลิงก์แล้ว'; setTimeout(function () { link.textContent = '#' }, 1500)
      }).catch(function () {})
    }, { signal: signal })
    apply(s)
  })
  function apply(s) {
    var id = s.dataset.fold, f = id in folded ? !!folded[id] : !!s.dataset.defFold
    s.classList.toggle('folded', f)
    var b = s.querySelector(':scope > h2 > .fold-btn')
    b.setAttribute('aria-expanded', String(!f)); b.firstChild.textContent = f ? '▸' : '▾'
  }
  function set(s, v) { folded[s.dataset.fold] = v ? 1 : 0; save(); apply(s) }
  function isFolded(s) { return s.classList.contains('folded') }
  // A link to a heading (or anything inside a folded section) unfolds that section first.
  function reveal() {
    var t = decodeURIComponent(location.hash.slice(1)); if (!t) return
    var el = document.getElementById(t); var s = el && el.closest('section.foldable')
    if (s && isFolded(s)) { set(s, false); el.scrollIntoView() }
  }
  reveal()
  window.addEventListener('hashchange', reveal, { signal: signal })
  root.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a || a.classList.contains('fold-link')) return
    var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))
    var s = el && el.closest('section.foldable'); if (s && isFolded(s)) set(s, false)
  }, { signal: signal, capture: true })
  // While searching, show folded sections so matches are never hidden.
  var q = document.getElementById('q')
  if (q) q.addEventListener('input', function () { root.classList.toggle('searching', !!q.value.trim()) }, { signal: signal })
}
