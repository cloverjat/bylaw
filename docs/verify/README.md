# Verifying Bylaw contracts on the X Layer explorer

Compiler: solc 0.8.39, optimizer on, 200 runs, EVM version paris, license MIT.
Input files: BylawCircle.standard-input.json, BylawPayroll.standard-input.json (Standard JSON Input).

Checked: the metadata hash at the end of the deployed bytecode of circle 0x8d15e0ec20b56ccac0afe59fab188d0b72d2a3f5 and payroll 0x2ff6430fb315136f5d2711542f71834345cf86d7 is identical to the one my compile produces (871dddf4... and 67c327e4...). Code length is identical too. Only immutable values (token, processor, members etc.) differ, as expected.

Constructor arguments: take the creation transaction input of the instance and cut off the first N bytes, where N is the length of the bytecode in web/bytecode.mjs (circle) or web/payroll-bytecode.mjs (payroll). What remains is the ABI-encoded constructor arguments to paste into the explorer.
Every circle/payroll is its own contract, so each instance needs its own verification.

## Two circle versions
BylawCircle.standard-input.json is version 1 (the circles and the test circle made before 25 Nov 2026). BylawCircle-v2.standard-input.json is version 2, used by every circle created from the site after that: it adds a 30-day escape (anyone can close the circle and everyone is refunded) when everyone has paid but the payout cannot happen, for example because the public rule changed. Verify each circle with the file for its version.
