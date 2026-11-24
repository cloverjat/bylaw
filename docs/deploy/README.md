# Demo deploy transaction data

`BylawCircle-demo-deploy.hex` is the creation bytecode plus ABI-encoded constructor arguments for the demo circle on X Layer:
token = native USDC `0xB6CE…3061`, processor `0x526B…d0f7`, circuit 6, 3 demo members, 0.01 USDC contribution, 300 s period, 1% fee to `0x11Bc…e7de`.
sha256 (first 16 hex chars of the file): `945ef76d97813f62`. Regenerate with `contracts/build.mjs` and `contracts/scripts/args.mjs`.
