# worker/consensus

Stationary background detection.

consensusMasks estimates recurring colours at fixed coordinates, then finds matching pixels connected to the image boundary. It returns one binary mask per frame. Aggressive mode also permits isolated repeated colours.

[Source](../../../src/worker/consensus.ts)
