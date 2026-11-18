// Rolagem suave com o Lenis (1.3.26, em src/raiz/js), igual à 04 Cacau Show: inércia na roda do
// mouse e no touchpad, por cima da rolagem nativa (sticky, IntersectionObserver e o marquee do
// Loop seguem iguais). Só no computador e sem "reduzir movimento"; ?lenis=0 desliga. Baixa depois
// do load pra não disputar a rede com o hero. Gesto mais de lado que de pé fica nativo.
// Links do menu (#âncora) deslizam pelo Lenis; o "Pular para o conteúdo" segue no salto nativo.
;(() => {
  const liga = new URLSearchParams(location.search).get('lenis') !== '0'
    && matchMedia('(pointer: fine)').matches
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!liga) return
  const iniciar = () => {
    const lenis = new window.Lenis({
      lerp: 0.09,
      autoRaf: true,
      virtualScroll: ({ deltaX, deltaY }) => Math.abs(deltaY) > Math.abs(deltaX),
    })
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]')
      if (!a || a.hash.length < 2 || a.classList.contains('pular') || !e.detail || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return
      const alvo = document.querySelector(a.hash)
      if (!alvo) return
      e.preventDefault()
      history.pushState(null, '', a.hash)
      lenis.scrollTo(alvo, { duration: 1.2, lock: true })
    })
  }
  const carregar = () => {
    const s = document.createElement('script')
    s.src = '/js/lenis.min.js'
    s.onload = iniciar
    document.head.append(s)
  }
  if (document.readyState === 'complete') carregar()
  else addEventListener('load', carregar, { once: true })
})()
