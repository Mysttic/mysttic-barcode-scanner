## What this changes

<!-- One or two sentences. Why the change is needed, not only what it does. -->

## How it was verified

<!-- Which tests were run, and on what. Hardware tests: say which module and host. -->

- [ ] host tests (`firmware-pico-sdk/tests/test_host.c`, `firmware-circuitpython/tests/`)
- [ ] extension: `npm test` and `npm run test:e2e`
- [ ] agent: unit tests, and `desktop-agent/tests/test_e2e.py` if the agent changed
- [ ] tried on real hardware

## Notes

- [ ] documentation updated (`docs/`, and the copies that ship on the device disk)
- [ ] `VERSION.md` untouched (release PRs are separate, see [CONTRIBUTING.md](../blob/master/CONTRIBUTING.md))
