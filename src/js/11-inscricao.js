// 11 · inscrição: o formulário entra pelo <template> quando a seção chega perto (form no HTML
// faz o autofill forçar layout na 1ª pintura). Enquanto o destino das respostas não é
// definido com o dono (planilha, e-mail...), o envio valida e abre o WhatsApp da Eletron com os
// dados já escritos na mensagem. Pra trocar o destino, mexer só em enviar().
;(() => {
  const caixa = document.querySelector('[data-form-vaga]')
  const molde = caixa?.querySelector('template')
  if (!molde) return
  const numero = '557736390197'

  const montar = () => {
    if (caixa.querySelector('form')) return
    caixa.insertBefore(molde.content.cloneNode(true), molde)
    const form = caixa.querySelector('form')
    const aviso = form.querySelector('.form__aviso')
    const tel = form.elements.whatsapp

    // máscara leve do telefone: (77) 99999-9999
    tel.addEventListener('input', () => {
      const d = tel.value.replace(/\D/g, '').slice(0, 11)
      tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d
    })

    const enviar = (dados) => {
      const linhas = [
        'Olá! Quero garantir minha vaga no treinamento de eletrônica embarcada.',
        '',
        `*Nome:* ${dados.nome}`,
        `*WhatsApp:* ${dados.whatsapp}`,
        `*E-mail:* ${dados.email}`,
        dados.cidade && `*Cidade:* ${dados.cidade}`,
        dados.profissao && `*Trabalho como:* ${dados.profissao}`,
        dados.mensagem && `*Mensagem:* ${dados.mensagem}`,
      ].filter((l) => l !== false && l !== undefined && l !== '')
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(linhas.join('\n'))}`, '_blank', 'noopener')
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      let primeiro = null
      for (const campo of form.querySelectorAll('[required]')) {
        let ok = campo.type === 'checkbox' ? campo.checked : campo.value.trim() !== ''
        if (ok && campo.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo.value.trim())
        if (ok && campo.name === 'whatsapp') ok = campo.value.replace(/\D/g, '').length >= 10
        campo.setAttribute('aria-invalid', String(!ok))
        if (!ok && !primeiro) primeiro = campo
      }
      if (primeiro) {
        aviso.classList.remove('ok')
        aviso.textContent = primeiro.type === 'checkbox' ? 'Marque a autorização de contato pra continuar.' : 'Confira os campos destacados.'
        primeiro.focus()
        return
      }
      const dados = Object.fromEntries(new FormData(form))
      for (const k in dados) dados[k] = String(dados[k]).trim()
      enviar(dados)
      aviso.classList.add('ok')
      aviso.textContent = 'Pronto! Abrimos o WhatsApp com seus dados. É só enviar a mensagem.'
    })
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) {
        io.disconnect()
        montar()
      }
    }, { rootMargin: '800px 0px' })
    io.observe(caixa)
  } else montar()
  // quem chega pelo link #inscricao monta na hora
  addEventListener('hashchange', () => location.hash === '#inscricao' && montar())
  document.querySelectorAll('a[href="#inscricao"]').forEach((a) => a.addEventListener('click', montar))
})()
