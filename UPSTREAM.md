# Upstream and fork

- Upstream: [xiaohai-78/dsh-modes](https://github.com/xiaohai-78/dsh-modes)
- Based on version **0.9.1**, commit `c6d00b9da814328c27b1e9cf5b8f50c85814dfa9`.
- Fork: [EJYDOvO/dsh-preset-manager](https://github.com/EJYDOvO/dsh-preset-manager).
- MIT license; upstream copyright and [LICENSE](LICENSE) retained. Original manuals are [English](README.upstream.md) and [Chinese](README.upstream.zh.md), describing upstream rather than this fork's current installation names.

The fork keeps Modes' Host/container architecture, Settings UI, prompt editing, tool descriptions, Skills policy/version/import support, uninstall conditions and three-way update merge. It adds installed-only module discovery, literal configuration editing, sibling ordering/removal, native composition validation, CAS protection and installed Skill assignment. Its package and owned module names use `dsh-preset-manager`; `dshModes` and authenticated `/api/dsh-modes` remain compatibility entry points. Run only one manager per Profile.

No Worker guard or naming policy is introduced. No Character/QQ/Memory dependency, installer, market, Agent loop or additional state database is added. Upstream's self-update maintenance helpers are retained, point to this fork's package and default to **no automatic checks**; local `link:`/`file:` development is not checked. This package is not published to npm. Do not use the upstream package's update command to update this fork.

Keep `upstream` as a Git remote. Merge upstream changes on a separate branch, review changed native APIs and run both test tiers before replacing an installed package. Never overwrite an installation's official files.
