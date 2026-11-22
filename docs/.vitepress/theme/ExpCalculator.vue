<script setup lang="ts">
// EXP calculator: how many more turn-ins of a quest it takes to reach a target level.
// Per-level EXP comes from docs/data/exp-table.json (exp[i] = EXP needed to go from level i to i+1).
// Inputs are saved in localStorage under KEY so the page remembers them.
import { computed, onMounted, ref, watch } from 'vue'
import table from '../../data/exp-table.json'

const KEY = 'exp-calc-v1'
const EXP: number[] = table.exp
const EST = new Set<number>(table.estimated)
const MAX = EXP.length // highest target level (400)

const level = ref<number | null>(null)
const mode = ref<'pct' | 'num'>('pct')
const cur = ref('')
const perRun = ref('')
const target = ref(MAX)
const perDay = ref('')

const num = (s: string) => {
  const v = Number(String(s).replace(/[,\s]/g, ''))
  return Number.isFinite(v) ? v : NaN
}
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s) {
      level.value = s.level ?? null
      mode.value = s.mode === 'num' ? 'num' : 'pct'
      cur.value = s.cur ?? ''
      perRun.value = s.perRun ?? ''
      target.value = s.target ?? MAX
      perDay.value = s.perDay ?? ''
    }
  } catch {}
})
watch([level, mode, cur, perRun, target, perDay], () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ level: level.value, mode: mode.value, cur: cur.value, perRun: perRun.value, target: target.value, perDay: perDay.value }))
  } catch {}
})

const result = computed(() => {
  const lv = Number(level.value)
  const tg = Number(target.value)
  if (!Number.isInteger(lv) || lv < 1 || lv >= MAX) return { err: `ใส่เลเวลปัจจุบัน 1–${MAX - 1}` }
  if (!Number.isInteger(tg) || tg <= lv || tg > MAX) return { err: `เลเวลเป้าหมายต้องมากกว่าเลเวลปัจจุบัน และไม่เกิน ${MAX}` }
  const need = EXP[lv]
  let have = cur.value.trim() === '' ? 0 : num(cur.value)
  if (!Number.isFinite(have) || have < 0) return { err: 'EXP ตอนนี้ต้องเป็นตัวเลข' }
  if (mode.value === 'pct') {
    if (have >= 100) return { err: 'เปอร์เซ็นต์ต้องน้อยกว่า 100' }
    have = (need * have) / 100
  } else if (have >= need) return { err: `เลเวล ${lv} ใช้ EXP ${fmt(need)} ต่อเลเวล ตัวเลขที่ใส่เกินแล้ว` }

  let left = need - have
  for (let i = lv + 1; i < tg; i++) left += EXP[i]
  const usesEst = Array.from({ length: tg - lv }, (_, k) => lv + k).some((i) => EST.has(i))

  const run = num(perRun.value)
  if (!Number.isFinite(run) || run <= 0) return { left, usesEst }
  const runs = Math.ceil(left / run)
  const pd = num(perDay.value)
  const days = Number.isFinite(pd) && pd > 0 ? Math.ceil(runs / pd) : null

  // Milestones: after how many turn-ins each level is reached.
  const steps: { lv: number; runs: number; est: boolean }[] = []
  let acc = need - have
  for (let i = lv + 1; i <= tg; i++) {
    steps.push({ lv: i, runs: Math.ceil(acc / run), est: EST.has(i - 1) })
    if (i < tg) acc += EXP[i]
  }
  return { left, usesEst, runs, days, steps, over: runs * run - left }
})

const showSteps = ref(false)
</script>

<template>
  <div class="expc">
    <div class="box form">
      <label>
        <span class="l">เลเวลตอนนี้</span>
        <input v-model.number="level" type="number" inputmode="numeric" min="1" :max="MAX - 1" placeholder="เช่น 352" />
      </label>
      <div class="field">
        <span class="l">EXP ตอนนี้ (ในเลเวลนี้)</span>
        <div class="row">
          <input v-model="cur" inputmode="decimal" :placeholder="mode === 'pct' ? 'เช่น 37.25' : 'เช่น 120,000,000'" />
          <div class="seg" role="group" aria-label="หน่วย EXP">
            <button type="button" :class="{ on: mode === 'pct' }" @click="mode = 'pct'">%</button>
            <button type="button" :class="{ on: mode === 'num' }" @click="mode = 'num'">ตัวเลข</button>
          </div>
        </div>
        <span v-if="level && EXP[level]" class="m">เลเวล {{ level }} → {{ level + 1 }} ใช้ {{ fmt(EXP[level]) }} EXP<template v-if="EST.has(level)"> (ประมาณจากสูตร)</template></span>
      </div>
      <label>
        <span class="l">EXP ที่ได้ต่อการส่งเควส 1 รอบ</span>
        <input v-model="perRun" inputmode="numeric" placeholder="ดูจากหน้าต่างเควสในเกม" />
      </label>
      <label>
        <span class="l">เลเวลเป้าหมาย</span>
        <input v-model.number="target" type="number" inputmode="numeric" min="2" :max="MAX" />
      </label>
      <label>
        <span class="l">ส่งได้วันละกี่รอบ <span class="m">(ไม่ใส่ก็ได้)</span></span>
        <input v-model="perDay" inputmode="numeric" placeholder="เช่น 1" />
      </label>
    </div>

    <div class="box out" aria-live="polite">
      <p v-if="result.err" class="m">{{ result.err }}</p>
      <template v-else>
        <div v-if="result.runs !== undefined" class="big">
          อีก <b>{{ fmt(result.runs) }}</b> รอบ ถึงเลเวล {{ target }}
        </div>
        <div v-else class="big sm">ใส่ EXP ต่อรอบเพื่อคำนวณจำนวนรอบ</div>
        <ul class="facts">
          <li>EXP ที่ยังขาด <b>{{ fmt(result.left) }}</b></li>
          <li v-if="result.days">ถ้าส่งวันละ {{ perDay }} รอบ ใช้ประมาณ <b>{{ fmt(result.days) }}</b> วัน</li>
          <li v-if="result.runs !== undefined">รอบสุดท้ายจะเกินมา {{ fmt(result.over) }} EXP</li>
        </ul>
        <p v-if="result.usesEst" class="m warn">เลเวล 352–399 วิกิไม่ได้ลงตัวเลขไว้ ใช้สูตรเดียวกับตารางคำนวณแทน (สูตรนี้ตรงกับเลเวล 391 ที่วิกิมีตัวเลข)</p>
      </template>
    </div>

    <section v-if="result.steps">
      <h2><button type="button" class="fold" @click="showSteps = !showSteps">{{ showSteps ? '▾' : '▸' }} ส่งครบกี่รอบถึงขึ้นแต่ละเลเวล</button></h2>
      <table v-if="showSteps">
        <thead><tr><th>ถึงเลเวล</th><th>ส่งครบ (รอบ)</th></tr></thead>
        <tbody>
          <tr v-for="s in result.steps" :key="s.lv">
            <td class="nm">{{ s.lv }}</td>
            <td>{{ fmt(s.runs) }}<span v-if="s.est" class="m"> ≈</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style>
.pg-guide .expc { display: flex; flex-direction: column; gap: 16px; max-width: 640px }
.pg-guide .expc .form { display: flex; flex-direction: column; gap: 14px }
.pg-guide .expc label, .pg-guide .expc .field { display: flex; flex-direction: column; gap: 4px }
.pg-guide .expc .l { font-weight: 600; font-size: .92rem }
.pg-guide .expc input { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg, var(--surface)); color: var(--fg); min-width: 0; width: 100%; font-variant-numeric: tabular-nums }
.pg-guide .expc input:focus { outline: 2px solid var(--accent); outline-offset: 1px }
.pg-guide .expc .row { display: flex; gap: 8px }
.pg-guide .expc .seg { display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; flex: none }
.pg-guide .expc .seg button { font: inherit; font-size: .88rem; padding: 0 12px; border: 0; background: var(--surface); color: var(--fg); cursor: pointer }
.pg-guide .expc .seg button.on { background: var(--accent); color: var(--surface) }
.pg-guide .expc .out { display: flex; flex-direction: column; gap: 6px }
.pg-guide .expc .big { font-family: var(--display); font-size: 1.4rem; line-height: 1.3 }
.pg-guide .expc .big b { color: var(--accent); font-size: 2rem; font-variant-numeric: tabular-nums }
.pg-guide .expc .big.sm { font-size: 1.05rem; color: var(--muted) }
.pg-guide .expc .facts { margin: 0; padding-left: 20px; font-variant-numeric: tabular-nums }
.pg-guide .expc .warn { color: var(--warn); margin: 0 }
.pg-guide .expc button.fold { all: unset; cursor: pointer; font: inherit; color: inherit }
.pg-guide .expc button.fold:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px }
.pg-guide .expc table td:last-child { font-variant-numeric: tabular-nums }
@media (max-width:700px){
.pg-guide .expc table { display: table; border: 1px solid var(--line); background: var(--surface) }
.pg-guide .expc thead { display: table-header-group }
.pg-guide .expc tbody { display: table-row-group }
.pg-guide .expc tr { display: table-row; border: 0; border-radius: 0; margin: 0; padding: 0; background: none }
.pg-guide .expc td, .pg-guide .expc th { display: table-cell; padding: 6px 10px; border-top: 1px solid var(--line) }
}
</style>
