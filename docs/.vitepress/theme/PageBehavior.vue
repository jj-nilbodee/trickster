<script setup lang="ts">
// Runs a page's checklist scripts once its content is on screen, and cleans up when you leave it.
// What runs is set by the page's frontmatter: `kind`, plus `storageKey`/`daily` (guides) or `zone`/`hiddenKey` (key quests).
import { onBeforeUnmount, onMounted } from 'vue'
import { useData } from 'vitepress'
import initGuide from './behaviors-guide.js'
import initKeyRows from './behaviors-key.js'
import initFold from './behaviors-fold.js'

const zones = import.meta.glob<{ default: () => void }>('./zones/*.js', { eager: true })
const { frontmatter } = useData()
let controller: AbortController | undefined

onMounted(() => {
  controller = new AbortController()
  const fm = frontmatter.value
  if (fm.kind === 'guide') initGuide(fm.storageKey, !!fm.daily)
  if (fm.kind === 'key') {
    zones[`./zones/${fm.zone}.js`].default()
    initKeyRows(fm.hiddenKey, controller.signal)
  }
  const page = document.querySelector<HTMLElement>('.pg[data-page]')?.dataset.page
  if (page && (fm.kind === 'guide' || fm.kind === 'key')) initFold(page, controller.signal)
})
onBeforeUnmount(() => controller?.abort())
</script>

<template><span hidden /></template>
