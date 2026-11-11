<script setup lang="ts">
// The Jobs page: pick a character, then see its job quests, 3rd job prep, Tribunal rooms and skills per job.
// Data comes from docs/data/jobs/<id>.json. Ticks are saved in localStorage under KEY, for every character at once.
import { computed, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

const ORDER = ['bunny', 'buffalo', 'sheep', 'dragon', 'fox', 'lion', 'cat', 'raccoon', 'bear']
const NAMES: Record<string, string> = { bunny: 'Bunny', buffalo: 'Buffalo', sheep: 'Sheep', dragon: 'Dragon', fox: 'Fox', lion: 'Lion', cat: 'Cat', raccoon: 'Raccoon', bear: 'Bear' }
const LINE: Record<string, string> = { bunny: 'Power', buffalo: 'Power', bear: 'Power', sheep: 'Magic', dragon: 'Magic', fox: 'Sense', lion: 'Sense', cat: 'Charm', raccoon: 'Charm' }
const KEY = 'jobs-ticks-v1'
const files = import.meta.glob('../../data/jobs/*.json', { import: 'default' })

const char = ref('bunny')
const data = ref<any>(null)
const ticks = ref<Record<string, 1>>({})
const hideDone = ref(false)
const q = ref('')

const img = (p?: string | null) => (p ? withBase('/' + p) : '')
const html = (s?: string) => (s || '').replace(/src="img\//g, `src="${withBase('/img/')}`)
const plain = (s: any) => String(s ?? '').replace(/<[^>]+>/g, ' ')

async function load(id: string) {
  const f = files[`../../data/jobs/${id}.json`]
  if (!f) return
  const d: any = await f()
  if (char.value === id) data.value = d
}

onMounted(async () => {
  try { ticks.value = JSON.parse(localStorage.getItem(KEY) || '{}').t || {} } catch {}
  try { hideDone.value = localStorage.getItem(KEY + '-hide') === '1' } catch {}
  const fromUrl = new URLSearchParams(location.search).get('c')
  let saved = ''
  try { saved = localStorage.getItem(KEY + '-char') || '' } catch {}
  char.value = ORDER.includes(fromUrl || '') ? fromUrl! : ORDER.includes(saved) ? saved : 'bunny'
  try { localStorage.setItem(KEY + '-char', char.value) } catch {}
  await load(char.value)
})

function pick(id: string) {
  if (id === char.value) return
  char.value = id
  data.value = null
  q.value = ''
  try { localStorage.setItem(KEY + '-char', id) } catch {}
  const u = new URL(location.href)
  u.searchParams.set('c', id)
  u.hash = ''
  history.replaceState(history.state, '', u)
  load(id)
}

function toggle(id: string, on: boolean) {
  const t = { ...ticks.value }
  if (on) t[id] = 1
  else delete t[id]
  ticks.value = t
  try { localStorage.setItem(KEY, JSON.stringify({ t })) } catch {}
}
watch(hideDone, (v) => { try { localStorage.setItem(KEY + '-hide', v ? '1' : '0') } catch {} })

function reset() {
  if (!data.value || !confirm(`ล้างติ๊กทั้งหมดของ ${data.value.name}?`)) return
  const t = { ...ticks.value }
  for (const id of allIds.value) delete t[id]
  ticks.value = t
  try { localStorage.setItem(KEY, JSON.stringify({ t })) } catch {}
}

// Sections in page order, each a list of rows with an id and searchable text.
const sections = computed(() => {
  const d = data.value
  if (!d) return []
  const out: any[] = [
    { id: 'quest', title: 'เควสเปลี่ยนอาชีพ', kind: 'quest', rows: d.quests,
      sub: d.tiers.length > 4 ? 'เรียงตามลำดับที่ทำจริง แถวที่มีป้ายชื่ออาชีพทำเฉพาะอาชีพ 3 ที่เลือก' : 'เรียงตามลำดับที่ทำจริง' + (d.tiers.length > 3 ? ' แถวที่มีป้ายชื่ออาชีพทำเฉพาะอาชีพ 3 ที่เลือก' : '') },
    { id: 'prep', title: 'อาชีพ 3: ของที่ต้องเตรียม', kind: 'prep', rows: d.prep, sub: 'ของที่ต้องหาเองระหว่างทำเควสอาชีพ 3 ช่อง "ใช้ในขั้น" ตรงกับขั้นในเควสด้านบน' },
    { id: 'trib', title: 'ล่ามอน Tribunal 16 ห้อง', kind: 'trib', rows: d.tribunal, sub: 'ต้องมีเควสค้างในสมุด ทำต่อกันตามลำดับ ห้องละ 3 ตัวใน 5 นาที แต่ละห้องให้ 749,730 EXP / 761,562 TM' },
  ]
  for (const t of d.tiers) {
    out.push({ id: 'sk' + t.key, title: t.title, kind: 'skill', rows: t.skills, icon: t.icon,
      sub: (t.sub ? t.sub + ' · ' : '') + 'ติ๊กเมื่อสกิลถึง Mastery แล้ว' })
  }
  return out
})
const allIds = computed(() => sections.value.flatMap((s) => s.rows.map((r: any) => r.id)))
const doneCount = computed(() => allIds.value.filter((id) => ticks.value[id]).length)

const needle = computed(() => q.value.trim().toLowerCase())
function match(r: any) {
  const v = needle.value
  if (!v) return true
  return Object.values(r).map(plain).join(' ').toLowerCase().includes(v)
}
function visible(r: any) { return match(r) && !(hideDone.value && ticks.value[r.id]) }
const secDone = (s: any) => s.rows.filter((r: any) => ticks.value[r.id]).length
</script>

<template>
  <div class="jobs">
    <div class="picker" role="tablist" aria-label="เลือกตัวละคร">
      <button v-for="id in ORDER" :key="id" type="button" role="tab" :aria-selected="id === char" :class="{ on: id === char }" @click="pick(id)">
        <span class="cn">{{ NAMES[id] }}</span><span class="cl">{{ LINE[id] }}</span>
      </button>
    </div>

    <p v-if="!data" class="loading">กำลังโหลด…</p>
    <template v-else>
      <div class="bar">
        <input v-model="q" placeholder="ค้นสกิล การ์ด หรือ NPC" type="search" />
        <span class="prog"><span class="track"><span class="fill" :style="{ width: (allIds.length ? (100 * doneCount) / allIds.length : 0) + '%' }"></span></span><span class="n">{{ doneCount }} / {{ allIds.length }}</span></span>
        <label><input v-model="hideDone" type="checkbox" /> ซ่อนที่ทำแล้ว</label><button type="button" @click="reset">ล้างติ๊ก</button>
      </div>

      <nav class="toc"><a href="#about">ภาพรวม</a><a v-for="s in sections" :key="s.id" :href="'#' + s.id">{{ s.title }}</a></nav>

      <section id="about">
        <h2>{{ data.name }} <span class="m">· {{ data.stat }} · {{ data.gender }}</span></h2>
        <div class="box" v-html="html(data.about)"></div>
        <p v-if="data.note" class="sub warn">{{ data.note }}</p>
        <p class="sub">ที่มา: <a v-for="s in data.source" :key="s[1]" :href="s[1]" target="_blank" rel="noopener">{{ s[0] }}</a></p>
      </section>

      <section v-for="s in sections" :id="s.id" :key="data.id + s.id" :class="{ nomatch: needle && !s.rows.some(match) }">
        <h2><img v-if="s.icon" :src="img(s.icon)" alt="" class="it" />{{ s.title }} <span class="cnt" :class="{ full: secDone(s) === s.rows.length && s.rows.length }">{{ secDone(s) }} / {{ s.rows.length }}</span></h2>
        <p class="sub">{{ s.sub }}</p>

        <table v-if="s.kind === 'quest'"><thead><tr><th></th><th>เควส</th><th>ที่</th><th>ต้องทำ</th><th>ได้</th></tr></thead><tbody>
          <tr v-for="r in s.rows" v-show="visible(r)" :key="r.id" :class="{ done: ticks[r.id] }">
            <td class="ck"><input :id="r.id" type="checkbox" aria-label="ทำแล้ว" :checked="!!ticks[r.id]" @change="toggle(r.id, ($event.target as HTMLInputElement).checked)" /></td>
            <td class="nm" data-l="เควส"><img v-if="r.icon" :src="img(r.icon)" alt="" class="sp" /><span v-html="html(r.name)"></span><span v-if="r.job" class="tag">{{ r.job }}</span></td>
            <td data-l="ที่" v-html="html(r.where)"></td>
            <td data-l="ต้องทำ" v-html="html(r.todo)"></td>
            <td data-l="ได้" v-html="html(r.reward)"></td>
          </tr>
        </tbody></table>

        <table v-else-if="s.kind === 'prep'"><thead><tr><th></th><th>ของ</th><th>หาจาก</th><th>ใช้ในขั้น</th></tr></thead><tbody>
          <tr v-for="r in s.rows" v-show="visible(r)" :key="r.id" :class="{ done: ticks[r.id] }">
            <td class="ck"><input :id="r.id" type="checkbox" aria-label="ทำแล้ว" :checked="!!ticks[r.id]" @change="toggle(r.id, ($event.target as HTMLInputElement).checked)" /></td>
            <td class="nm" data-l="ของ">{{ r.item }}</td>
            <td data-l="หาจาก">{{ r.where || '–' }}</td>
            <td class="nw" data-l="ใช้ในขั้น">{{ r.step || '–' }}</td>
          </tr>
        </tbody></table>

        <table v-else-if="s.kind === 'trib'"><thead><tr><th></th><th>Messenger</th><th>ห้อง</th><th>ล่า</th><th>ได้</th></tr></thead><tbody>
          <tr v-for="r in s.rows" v-show="visible(r)" :key="r.id" :class="{ done: ticks[r.id] }">
            <td class="ck"><input :id="r.id" type="checkbox" aria-label="ทำแล้ว" :checked="!!ticks[r.id]" @change="toggle(r.id, ($event.target as HTMLInputElement).checked)" /></td>
            <td class="nm" data-l="Messenger" v-html="html(r.messenger)"></td>
            <td class="nw" data-l="ห้อง">{{ r.room }}</td>
            <td data-l="ล่า">{{ r.hunt }}</td>
            <td data-l="ได้">{{ r.reward }}</td>
          </tr>
        </tbody></table>

        <table v-else><thead><tr><th></th><th>สกิล</th><th>TM</th><th>ทำอะไร</th><th>ต้องมีก่อน</th><th>ของฝึก Mastery</th><th>ได้จาก</th></tr></thead><tbody>
          <tr v-for="r in s.rows" v-show="visible(r)" :key="r.id" :class="{ done: ticks[r.id] }">
            <td class="ck"><input :id="r.id" type="checkbox" aria-label="ทำแล้ว" :checked="!!ticks[r.id]" @change="toggle(r.id, ($event.target as HTMLInputElement).checked)" /></td>
            <td class="nm" data-l="สกิล"><img v-if="r.icon" :src="img(r.icon)" alt="" class="it" /><a :href="r.wiki" target="_blank" rel="noopener">{{ r.name }}</a></td>
            <td class="nw" data-l="TM">{{ r.tm ?? '–' }}</td>
            <td data-l="ทำอะไร"><span v-html="html(r.does)"></span> <span v-if="r.type" class="m">· {{ r.type }}</span></td>
            <td data-l="ต้องมีก่อน">{{ r.prereq || '–' }}</td>
            <td data-l="ของฝึก Mastery"><span v-html="html(r.mastery)"></span><span v-if="r.masteryFrom" class="m"><br />หาจาก <span v-html="html(r.masteryFrom)"></span></span></td>
            <td data-l="ได้จาก">{{ r.source }}</td>
          </tr>
        </tbody></table>
      </section>
    </template>
  </div>
</template>

<style>
.pg-guide .jobs .picker { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 16px }
.pg-guide .jobs .picker button { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--fg); font: inherit; font-size: 14px; cursor: pointer }
.pg-guide .jobs .picker button:hover { border-color: var(--accent) }
.pg-guide .jobs .picker button.on { background: var(--accent); border-color: var(--accent); color: var(--surface) }
.pg-guide .jobs .picker .cn { font-weight: 600 }
.pg-guide .jobs .picker .cl { font-size: 12px; opacity: .75 }
.pg-guide .jobs .loading { color: var(--muted) }
.pg-guide .jobs h2 img.it { margin-right: 6px }
.pg-guide .jobs .sub.warn { color: var(--warn) }
.pg-guide .jobs .sub a + a { margin-left: 8px }
.pg-guide .jobs td.nm .tag { margin-left: 6px }
</style>
