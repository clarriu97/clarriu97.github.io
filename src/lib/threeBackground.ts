import { initAurora } from "./backgrounds/aurora"

// Animated aurora shader rendered behind the whole site. Lives in its own
// module under ./backgrounds and cleans up after itself on navigation.
export function initThreeBackground() {
  initAurora()
}
