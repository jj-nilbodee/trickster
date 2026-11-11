<script setup lang="ts">
// Runs a page's checklist scripts once its content is on screen, and cleans up when you leave it.
// What runs is set by the page's frontmatter: `kind`, plus `storageKey`/`daily` (guides) or `zone`/`hiddenKey` (key quests).
import { onBeforeUnmount, onMounted } from 'vue'
import { useData } from 'vitepress'
import initGuide from './behaviors-guide.js'
import initKeyRows from './behaviors-key.js'

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
})
onBeforeUnmount(() => controller?.abort())
</script>

<template><span hidden /></template>
