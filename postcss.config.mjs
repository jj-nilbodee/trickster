import { postcssIsolateStyles } from 'vitepress'

// Keep VitePress' doc styles (table stripes, heading rules, list spacing) out of the guide pages,
// which bring their own styles inside `.vp-raw`.
export default { plugins: [postcssIsolateStyles({ includeFiles: [/base\.css/, /vp-doc\.css/] })] }
