"""
Recorte da cabeça do instrutor nas fotos da Sobre, pra ela passar na frente do "Desde 2008"
(o mesmo truque da Geomon). A camada tem o tamanho da foto inteira e fica exatamente por cima
dela: o corte de baixo (no colarinho) não aparece porque embaixo continua a mesma foto. O texto
só precisa terminar acima do LIMITE.

A parede atrás é quase preta (21 a 33 de brilho) e a cabeça passa de 60: alfa pela distância
até o brilho da parede na mesma linha, núcleo fechado e sem furos (a sombra do rosto não vira
buraco), borda suave no cabelo.

Uso: python scripts/recortar-sobre.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ORIGEM = Path('../0112 - Eletron Paulista/imagens-finais')
SAI = Path('scripts/.cache/sobre')
SAI.mkdir(parents=True, exist_ok=True)

# arquivo, (x0, x1) da faixa da cabeça, limite de baixo do recorte
FOTOS = {
    'desktop': ('sobre-desktop.png', (740, 1010), 338),
    'celular': ('sobre-celular.png', (350, 680), 560),
}

for nome, (arq, (x0, x1), limite) in FOTOS.items():
    rgb = np.asarray(Image.open(ORIGEM / arq).convert('RGB')).astype(np.float64)
    H, W, _ = rgb.shape
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    # brilho da parede por linha: mediana das bordas esquerda e direita da faixa da cabeça
    parede = np.median(np.concatenate([lum[:, max(x0 - 120, 0):x0], lum[:, x1:x1 + 120]], axis=1), axis=1)[:, None]
    d = lum - parede
    faixa = np.zeros_like(d, dtype=bool)
    faixa[:limite, x0:x1] = True

    nucleo = (d > 26) & faixa
    nucleo = ndi.binary_closing(nucleo, iterations=4)
    nucleo = ndi.binary_fill_holes(nucleo)
    rot, n = ndi.label(nucleo)
    if n > 1:
        maior = np.argmax(ndi.sum(nucleo, rot, range(1, n + 1))) + 1
        nucleo = rot == maior
    interior = ndi.binary_erosion(nucleo, iterations=3)
    perto = ndi.binary_dilation(nucleo, iterations=4) & faixa
    a = np.clip((d - 6) / 26, 0, 1)
    a = np.where(interior, 1.0, np.where(perto, a, 0.0))
    a = ndi.gaussian_filter(a, 0.7)
    a = np.where(interior, 1.0, a) * faixa
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(SAI / f'recorte-{nome}.png')
    ys, xs = np.nonzero(a > 0.5)
    print(nome, W, H, 'cabeça', xs.min(), xs.max(), ys.min(), ys.max())
