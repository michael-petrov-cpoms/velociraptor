import '@raptor/feather-ui/feather-ui.css'
import FeatherUI, { FEATHER_LOCALE_KEY } from '@raptor/feather-ui'
import IconsPath from '@raptor/feather-ui/icons.svg'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(FeatherUI)
app.provide(FEATHER_LOCALE_KEY, 'en-gb')
app.provide('iconsSvgPath', IconsPath)

app.mount('#app')
