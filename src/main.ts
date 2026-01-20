import '@raptor/feather-ui/feather-ui.css'
import './assets/main.css'
import FeatherUI, { FEATHER_LOCALE_KEY } from '@raptor/feather-ui'
import IconsPath from '@raptor/feather-ui/icons.svg'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueFire } from 'vuefire'

import App from './App.vue'
import router from './router'
import { firebaseApp } from './firebase/config'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueFire, { firebaseApp })
app.use(FeatherUI)
app.provide(FEATHER_LOCALE_KEY, 'en-gb')
app.provide('iconsSvgPath', IconsPath)

app.mount('#app')
