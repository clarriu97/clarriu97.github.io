export function initHeaderScrollSpy(): () => void {
  const sections = Array.from(document.querySelectorAll("main section[id]"))
  const navItems = Array.from(document.querySelectorAll("header nav a"))

  const triggerLine = () => Math.min(140, window.innerHeight * 0.2)

  const updateActiveFromScroll = () => {
    const line = triggerLine()
    let activeId = ""

    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i]
      const rect = section.getBoundingClientRect()
      if (rect.top <= line) {
        activeId = section.id
        break
      }
    }

    if (!activeId && window.scrollY < 8) {
      activeId = "home"
    }

    navItems.forEach((item) => {
      const href = item.getAttribute("href") ?? ""
      if (href.startsWith("mailto:")) return

      const label = item.getAttribute("aria-label")
      if (label === activeId) {
        item.classList.add("active-link")
      } else {
        item.classList.remove("active-link")
      }
    })
  }

  updateActiveFromScroll()
  const onScroll = () => updateActiveFromScroll()
  window.addEventListener("scroll", onScroll, { passive: true })

  return () => {
    window.removeEventListener("scroll", onScroll)
  }
}
