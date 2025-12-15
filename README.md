# Velociraptor

**Sprint capacity planning that actually works.**

Velociraptor answers the question every scrum team asks at sprint planning: *"How many points should we commit to?"*

It learns from your team's history. Log what you completed and how many leave days you had. Velociraptor normalizes for availability, so a holiday-heavy sprint doesn't skew your averages. When planning, enter expected leave days and get an accurate recommendation based on real data.

No more guessing. No more overcommitting because half the team is on holiday.

---

## Development Setup

### Prerequisites

- Node.js 20.19+ or 22.12+ (see `.nvmrc`)
- npm

### Install & Run

```sh
npm install
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run test:unit` | Run unit tests with Vitest |
| `npm run lint` | Lint with ESLint |

### IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension.

For Vue devtools in your browser:
- [Chrome/Edge](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
