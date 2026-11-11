// Adds a slim bar with a link back to the hub at the top of every guide page.
const bar = document.createElement('nav')
bar.className = 'site-nav'
const link = document.createElement('a')
link.href = import.meta.env.BASE_URL
link.textContent = '← คู่มือ Trickster'
bar.append(link)
document.body.prepend(bar)
