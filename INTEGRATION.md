# Host / Client integration

## Ownership

`dsh-preset-manager` is an optional installed Bundle, with two rows in `cordis.patch.yml`: the Host manager and its custom-Preset container. The client joins native `settings.section`. No Core/Extras edits or Character imports are needed. Preset identities never change during an edit, and `allowedAgentPresets` always stores real IDs. Editing a Worker does not automatically grant a Root permission to delegate to it.

The native `pluginPackages.resolution.entries` and `localPackageNames` enumerate installation mappings and installed Profile packages respectively. `packageOf()` applies the Host's actual resolution before reading manifests. Discovery reads exports and known Skill roots without importing every installed module. Inspection uses `loader.internal.import` / `unwrapExports`; Config display uses `createConfigProjector`. No package fetch, dependency installation, market or network scan occurs.

## Authenticated API

Exact POST `/api/dsh-preset-manager`, with compatibility POST `/api/dsh-modes`. Native Connection admits the Owner before dispatch, including Web Cookie/Host/Origin checks. Client uses `connection.rpc.call('/api', 'dsh-preset-manager', payload, signal)` and the standard envelope. Browser identity/session/permission fields have no authority. Loading arbitrary Host plugins remains outside this boundary.

New actions:

| Action | Input / result |
|---|---|
| `pluginCatalog` | Installed module candidates, version, reference/Host state and discovery diagnostics |
| `inspectPlugin` | `module`; returns required services, projected Schema and explicit limitations |
| `editPlugin` | `id`, `base` (Preset `pluginRevision`), `op`, `rowId`; add also `module/config/parentId?`, configure `config`, toggle `enabled`, move `direction:-1/1` |
| `installedSkills` | Host-discovered files and duplicate-name diagnostics |
| `assignSkill` | `id`, `base`, `skill`, `enabled`; Host selects the discovered path; no browser path is accepted |

Existing Modes actions and `dshModes` service remain available. `assignedSkill`/`assignedSkills` extend that service for the existing scoped policy Provider; this is not a second Skill registry. Installed file invocation metadata must use native boolean frontmatter; invalid or legacy privilege flags are refused. A missing/invalid assigned file is not served from a stale body. Global/per-mode Off and pinned versions take precedence.

All mutating requests are serialized. New plugin edits require CAS; other legacy row edits also compare their snapshot after validation. Native temporary Preset registration/acquisition validates the merged composition and is disposed on success or failure. `configEditor.edit` owns primary file locking/reconciliation. The manager also verifies the actual saved revision: native Preset registration can retain a broken composition without throwing from the parent configuration row. If final activation fails after a successful probe, the manager restores the previous target config through the same native editor and verifies recovery. Intervening changes refuse automatic rollback and report `recovery-required`. Existing expressions may be preserved verbatim; the JSON editor cannot introduce or change executable expressions.

Base definitions are never written. The fork extends Modes' three-way merge to retain explicit deletions and sibling order; new upstream rows join the merged list. Existing Agent revisions remain retained by DSH. State files use original atomic replace/error reporting, not cross-process database transactions. Use one Host per Profile; maintain backups of both Profile patch and sidecar state.

## Lifecycle and limits

Manager unload unregisters routes/service. Queued writes refuse a closed instance; edits validated across unload refuse before writing. Native config reconciliation handles rollback; a request already committed before client cancellation is not undone by closing its page. Client unload aborts outstanding RPC and late data responses cannot overwrite a later page load/save.

Scope compatibility is proven by native assembly, not module naming. Currently Host-only modules already active outside all Presets are conservatively rejected for additions. The lifecycle of an otherwise selected installed module executes during validation; installed code must already be trusted. Do not use this manager to test arbitrary downloaded or malicious plugins.

Original self-update helpers are retained for the manager itself with the new package identity; automatic checks default Off and local source installs do not query registries. The package is not on npm. General installation remains DSH's responsibility.

## Verification and rollback

Run `npm test` and the two-process `scripts/run-host.ps1` against the installed DSH. The native test covers Owner fencing, real API envelopes, package discovery, Schema projection, invalid/missing/leaking plugin rejection without Profile writes, CAS, source read-only, scoped Skills, ordinary Workers and native Spawn/cold recovery. Synthetic LLM responses prove routing, not model quality. Browser/actual Desktop visual acceptance is not yet verified.

Frontend resource checks read the advertised URL from the native `__DSH_BOOT__` graph. This Host serves revisioned combo resources; an invented `/plugins/<package>/client.js` address deliberately returns 404 and is not evidence of failed activation.

Before replacing a package, retain package manifest/lock, Profile patch and `.dsh-preset-manager/`. Roll back package and matching configuration together through native management; retain user Session/Memory files. No automatic migration from original Modes or live deployment is performed by the test scripts. Useful failure evidence is left in `.local/`, never packaged or committed.
