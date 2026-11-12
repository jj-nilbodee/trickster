// Quest-type filter for town pages. Buttons in .qfilter carry data-t; sections carry data-qt.
// "all" shows every section. The choice is remembered per page in localStorage.
export default function initFilter(page, signal) {
  var bar = document.querySelector('.pg .qfilter'); if (!bar) return
  var KEY = 'qf:' + page, cur = 'all'
  try { cur = localStorage.getItem(KEY) || 'all' } catch (e) {}
  var btns = [].slice.call(bar.querySelectorAll('button[data-t]'))
  if (!btns.some(function (b) { return b.dataset.t === cur })) cur = 'all'
  function apply() {
    btns.forEach(function (b) { b.classList.toggle('on', b.dataset.t === cur); b.setAttribute('aria-pressed', String(b.dataset.t === cur)) })
    ;[].slice.call(document.querySelectorAll('.pg section[data-qt]')).forEach(function (s) {
      s.classList.toggle('qf-hide', cur !== 'all' && s.dataset.qt.split(' ').indexOf(cur) < 0)
    })
    ;[].slice.call(document.querySelectorAll('.pg nav.toc a[href^="#"]')).forEach(function (a) {
      var s = document.getElementById(a.getAttribute('href').slice(1))
      a.style.display = s && s.classList.contains('qf-hide') ? 'none' : ''
    })
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { cur = b.dataset.t; try { localStorage.setItem(KEY, cur) } catch (e) {} apply() }, { signal: signal })
  })
  apply()
}
