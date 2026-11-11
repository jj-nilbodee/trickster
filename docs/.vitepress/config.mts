import { defineConfig } from 'vitepress'

const guides = [
  ['เควสรายวัน', '/daily-quests'],
  ['เควสการ์ด', '/card-girl-quests'],
  ['ของฝึกสกิล', '/skill-mastery-items'],
  ['เปลี่ยนอาชีพ', '/job-advancement'],
  ['Tower of Chaos', '/tower-of-chaos'],
  ['แมพเก็บเลเวล', '/leveling-maps'],
  ['อาชีพ Bear (Paula)', '/bear-paula'],
]

// In the order the game unlocks them.
const keyQuests = [
  ['1 · Desert Beach', '/key-desert-beach'],
  ['2 · Megalopolis', '/key-megalopolis'],
  ['3 · Caballa Relics', '/key-caballa-relics'],
  ['4 · Oops Wharf', '/key-oops-wharf'],
  ['5 · Mermaid Palace', '/key-mermaid-palace'],
  ['6 · Ghost Blue', '/key-ghost-blue'],
  ['7 · Rose Garden', '/key-rose-garden'],
  ['8 · Black Swamp', '/key-black-swamp'],
  ['9 · Snow Hill', '/key-snow-hill'],
  ['10 · Techichi Volcano', '/key-techichi-volcano'],
  ['11 · Tapasco Volcano', '/key-tapasco-volcano'],
]

const items = (list: string[][]) => list.map(([text, link]) => ({ text, link }))

export default defineConfig({
  lang: 'th',
  title: 'คู่มือ Trickster',
  description: 'สรุปเควสและคู่มือ Trickster Online จากวิกิ ggFTW',
  // GitHub Pages serves this repo at https://jj-nilbodee.github.io/trickster/
  base: '/trickster/',
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Mitr:wght@400;500&family=Sarabun:wght@400;600&display=swap',
    }],
  ],
  // Keep spaces between inline tags exactly as written in the pages.
  vue: { template: { compilerOptions: { whitespace: 'preserve' } } },
  themeConfig: {
    nav: [{ text: 'หน้ารวม', link: '/' }],
    sidebar: [
      { text: 'คู่มือ', items: items(guides) },
      { text: 'เควสกุญแจ', items: items(keyQuests) },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/jj-nilbodee/trickster' }],
    docFooter: { prev: 'ก่อนหน้า', next: 'ถัดไป' },
    sidebarMenuLabel: 'เมนู',
    returnToTopLabel: 'กลับขึ้นบน',
    darkModeSwitchLabel: 'ธีม',
    lightModeSwitchTitle: 'เปลี่ยนเป็นธีมสว่าง',
    darkModeSwitchTitle: 'เปลี่ยนเป็นธีมมืด',
    footer: { message: 'ข้อมูลสรุปจากวิกิ ggFTW ฉบับ mirror ของ LifeTO' },
  },
})
