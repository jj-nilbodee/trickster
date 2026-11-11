import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import PageBehavior from './PageBehavior.vue'
import JobsGuide from './JobsGuide.vue'
import './styles/hub.css'
import './styles/guide.css'
import './styles/key.css'
import './styles/palettes.css'
import './styles/layout.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PageBehavior', PageBehavior)
    app.component('JobsGuide', JobsGuide)
  },
} satisfies Theme
