<script setup lang="ts">
// Runs a page's checklist scripts once its content is on screen, and cleans up when you leave it.
// What runs is set by the page's frontmatter: `kind`, plus `storageKey`/`daily` (guides) or `zone`/`hiddenKey` (key quests),
// or `episode` (episode quests).
import { onBeforeUnmount, onMounted } from 'vue'
import { useData } from 'vitepress'
import initGuide from './behaviors-guide.js'
import initKeyRows from './behaviors-key.js'
import initFold from './behaviors-fold.js'
import initFilter from './behaviors-filter.js'
import initEpisode, { initStory } from './behaviors-episode.js'

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
  if (fm.kind === 'episode') initEpisode(fm.episode, controller.signal)
  if (fm.kind === 'story') initStory()
  const page = document.querySelector<HTMLElement>('.pg[data-page]')?.dataset.page
  if (page && ['guide', 'key', 'episode', 'story'].includes(fm.kind)) initFold(page, controller.signal)
  if (page) initFilter(page, controller.signal)
})
onBeforeUnmount(() => controller?.abort())
</script>

<template><span hidden /></template>
