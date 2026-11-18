// 01 · hero: o vídeo de fundo entra depois do load. A capa é o 1º quadro do vídeo (LCP), então
// o vídeo só aparece quando começa a tocar e a troca não se vê. Celular: recorte em pé.
// Tela de até 1100 px de largura (ou conexão econômica): a versão de 854 px.
;(() => {
  const midia = document.querySelector('.hero__midia')
  const video = midia?.querySelector('[data-hero-video]')
  if (!video) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const economia = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''))
  if (economia) return

  const escolher = () => {
    if (matchMedia('(max-width: 47.99em)').matches) return video.dataset.videoMovel
    return innerWidth * Math.min(devicePixelRatio || 1, 2) <= 1100 ? video.dataset.videoMedio : video.dataset.video
  }
  const carregar = () => {
    video.src = escolher()
    video.addEventListener('playing', () => midia.classList.add('tocando'), { once: true })
    video.play().catch(() => {})
  }
  const depois = () => ('requestIdleCallback' in window ? requestIdleCallback(carregar, { timeout: 1500 }) : setTimeout(carregar, 300))
  if (document.readyState === 'complete') depois()
  else addEventListener('load', depois, { once: true })

  // pausa fora da tela (não gasta decodificação tocando escondido)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (!video.src) return
      if (e.isIntersecting) video.play().catch(() => {})
      else video.pause()
    }).observe(midia)
  }
})()
