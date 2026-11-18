"""
Recorta os 3 equipamentos (monitor, receptor GPS, módulo) da imagem do ChatGPT em fundo cinza liso
(#7C7C7C, desvio < 1) e salva cada um em PNG com alfa, na caixa da peça.

- máscara: distância de cor até o cinza do fundo, fechada e com os buracos preenchidos (pedaço do
  módulo que tem o mesmo cinza do fundo não vira furo)
- borda suave: alfa pela distância na faixa de 3 a 14 níveis
- cor descontaminada na borda: tira a parte do cinza que vazou pro pixel de borda
- separa as 3 peças por componente conectado, da esquerda pra direita

Uso: python scripts/recortar-equipamentos.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ORIGEM = Path('../0112 - Eletron Paulista/imagens-finais/equipamentos-fundo-cinza.png')
SAI = Path('scripts/.cache/equipamentos')
SAI.mkdir(parents=True, exist_ok=True)
NOMES = ['monitor', 'receptor', 'modulo']

img = np.asarray(Image.open(ORIGEM).convert('RGB')).astype(np.float64)
H, W, _ = img.shape
borda = np.concatenate([img[:20].reshape(-1, 3), img[-20:].reshape(-1, 3), img[:, :20].reshape(-1, 3), img[:, -20:].reshape(-1, 3)])
fundo = np.median(borda, axis=0)
dist = np.sqrt(((img - fundo) ** 2).sum(axis=2))

nucleo = dist > 9
nucleo = ndi.binary_closing(nucleo, iterations=3)
nucleo = ndi.binary_fill_holes(nucleo)
nucleo = ndi.binary_opening(nucleo, iterations=2)
rotulos, n = ndi.label(nucleo)
tamanhos = ndi.sum(nucleo, rotulos, range(1, n + 1))
maiores = np.argsort(tamanhos)[::-1][:3] + 1
caixas = []
for r in maiores:
    ys, xs = np.nonzero(rotulos == r)
    caixas.append((xs.min(), r))
caixas.sort()

for nome, (_, r) in zip(NOMES, caixas):
    peca = rotulos == r
    perto = ndi.binary_dilation(peca, iterations=3)
    interior = ndi.binary_erosion(peca, iterations=2)
    a = np.clip((dist - 3) / 11, 0, 1)
    a = np.where(interior, 1.0, np.where(perto, a, 0.0))
    a = ndi.gaussian_filter(a, 0.6) * perto
    a = np.where(interior, 1.0, a)
    # encolhe a borda 2 px: o ChatGPT deixa um aro claro em volta da peça, que vira contorno
    # cinza no fundo verde escuro do investimento
    a = ndi.gaussian_filter(ndi.grey_erosion(a, size=(5, 5)), 0.7)
    # descontamina: c = a*obj + (1-a)*fundo
    seguro = np.maximum(a, 1e-3)[..., None]
    cor = np.clip((img - (1 - a[..., None]) * fundo) / seguro, 0, 255)
    cor = np.where(a[..., None] > 0, cor, 0)
    ys, xs = np.nonzero(a > 0.01)
    y0, y1, x0, x1 = max(ys.min() - 4, 0), min(ys.max() + 5, H), max(xs.min() - 4, 0), min(xs.max() + 5, W)
    rgba = np.dstack([cor, a * 255]).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(rgba, 'RGBA').save(SAI / f'{nome}.png')
    print(nome, rgba.shape[1], 'x', rgba.shape[0])
