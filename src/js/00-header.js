// 00 · topo: vira vidro escuro depois do hero e abre o menu no celular
;(() => {
  const topo = document.querySelector('[data-topo]')
  const hero = document.querySelector('#inicio')
  if (!topo) return
  if (hero && 'IntersectionObserver' in window) {
    // o topo fica solido quando a borda de baixo do hero passa por baixo dele
    new IntersectionObserver(([e]) => topo.classList.toggle('topo--solido', !e.isIntersecting), { rootMargin: '-80px 0px 0px 0px', threshold: 0 }).observe(hero.querySelector('[data-fim-hero]') || hero)
  }
  const botao = topo.querySelector('[data-menu]')
  const fechar = () => {
    topo.classList.remove('topo--aberto')
    botao.setAttribute('aria-expanded', 'false')
    botao.querySelector('.sr-only').textContent = 'Abrir o menu'
  }
  botao?.addEventListener('click', () => {
    const abre = !topo.classList.contains('topo--aberto')
    topo.classList.toggle('topo--aberto', abre)
    botao.setAttribute('aria-expanded', String(abre))
    botao.querySelector('.sr-only').textContent = abre ? 'Fechar o menu' : 'Abrir o menu'
  })
  topo.querySelectorAll('.topo__nav a').forEach((a) => a.addEventListener('click', fechar))
  document.addEventListener('keydown', (e) => e.key === 'Escape' && fechar())
})()
