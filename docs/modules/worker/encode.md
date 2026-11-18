# worker/encode

GIF binary encoding.

Writer accumulates GIF bytes; createWriter writes the header and global palette. encodeLZW compresses indexed pixels. FrameBlock describes image rectangle, delay, transparency, disposal and optional local palette; appendFrame writes it. writeSprite crops transparent independent frames; writeDelta updates a persistent canvas using lookahead.

[Source](../../../src/worker/encode.ts)
