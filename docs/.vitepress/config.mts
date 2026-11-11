import { defineConfig } from 'vitepress'

const guides = [
  ['เควสรายวัน', '/daily-quests'],
  ['เควสการ์ด', '/card-girl-quests'],
  ['อาชีพ', '/jobs'],
  ['Tower of Chaos', '/tower-of-chaos'],
  ['แมพเก็บเลเวล', '/leveling-maps'],
  ['บอส', '/bosses'],
  ['Guardian', '/guardian'],
  ['สเตตัส', '/stats'],
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

// Main story: an overview page, then one page per episode.
const story = [
  ['ภาพรวมเนื้อเรื่อง', '/story-quest'],
  ['Episode 0 · The Start of an Adventure', '/episode-0'],
  ['Episode 1 · Secret of the Alteo Empire', '/episode-1'],
  ['Episode 2 · Mirage Island', '/episode-2'],
  ['Episode 3 · Dreams of an Empire', '/episode-3'],
  ['Episode 4 · Beyond the Veil', '/episode-4'],
  ['Episode 5 · Rebirth of Memories', '/episode-5'],
  ['Episode 6 · Songs of Love and Fate', '/episode-6'],
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
      href: 'https://fonts.googleapis.com/css2?family=Mali:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap',
    }],
  ],
  // Dark mode first; the theme switch still offers light.
  appearance: 'dark',
  // Keep spaces between inline tags exactly as written in the pages.
  vue: { template: { compilerOptions: { whitespace: 'preserve' } } },
  themeConfig: {
    nav: [{ text: 'หน้ารวม', link: '/' }],
    sidebar: [
      { text: 'คู่มือ', items: items(guides) },
      { text: 'เควสกุญแจ', items: items(keyQuests) },
      { text: 'เควสเนื้อเรื่อง (Story / Episode)', items: items(story) },
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
