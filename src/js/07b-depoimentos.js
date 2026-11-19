/* depoimentos: a capa vira o vídeo no clique, com som e controles. Só um toca por vez. */
;(function () {
  var botoes = document.querySelectorAll('.depo__botao')
  if (!botoes.length) return
  botoes.forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.depo video').forEach(function (v) { v.pause() })
      var v = document.createElement('video')
      v.src = b.getAttribute('data-video')
      v.poster = b.querySelector('.depo__capa').src
      v.controls = true
      v.playsInline = true
      v.preload = 'auto'
      v.setAttribute('aria-label', b.getAttribute('aria-label').replace('Assistir o', 'Vídeo:'))
      v.addEventListener('play', function () {
        document.querySelectorAll('.depo video').forEach(function (o) { if (o !== v) o.pause() })
      })
      b.parentNode.replaceChild(v, b)
      var p = v.play()
      if (p && p.catch) p.catch(function () {})
      v.focus()
    })
  })
})()
