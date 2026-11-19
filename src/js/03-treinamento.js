/* fita de fotos do treinamento: o lazy nativo não vê foto que entra de lado (memória
   marquee-lazy-eager), então perto da seção todas as fotos da fita passam a eager. */
;(function () {
  var fita = document.querySelector('.treino__fita')
  if (!fita || !('IntersectionObserver' in window)) return
  var io = new IntersectionObserver(function (es) {
    if (!es[0].isIntersecting) return
    io.disconnect()
    fita.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager' })
  }, { rootMargin: '600px 0px' })
  io.observe(fita)
})()
