# Host / Client integration

## Ownership

`dsh-preset-manager` is an optional installed Bundle, with two rows in `cordis.patch.yml`: the Host manager and its custom-Preset container. The client joins native `settings.section`. No Core/Extras edits or Character imports are needed. Preset identities never change during an edit, and `allowedAgentPresets` always stores real IDs. Editing a Worker does not automatically grant a Root permission to delegate to it.

The native `pluginPackages.resolution.entries` and `localPackageNames` enumerate installation mappings and installed Profile packages respectively. `packageOf()` applies the Host's actual resolution before reading manifests. Each module must also resolve to an existing file owned by an installed package; references alone are not installation evidence. `availability`, `hostOnly`, `referenced` and `addable` are separate catalog fields. Discovery reads exports and known Skill roots without importing every installed module. Inspection uses `loader.internal.import` / `unwrapExports`; Config display uses `createConfigProjector`. No package fetch, dependency installation, market or network scan occurs.

## Authenticated API

Exact POST `/api/dsh-preset-manager`, with compatibility POST `/api/dsh-modes`. Native Connection admits the Owner before dispatch, including Web Cookie/Host/Origin checks. Client uses `connection.rpc.call('/api', 'dsh-preset-manager', payload, signal)` and the standard envelope. Browser identity/session/permission fields have no authority. Loading arbitrary Host plugins remains outside this boundary.

New actions:

| Action | Input / result |
|---|---|
| `pluginCatalog` | Installed module candidates, version, reference/Host state and discovery diagnostics |
| `inspectPlugin` | `module`; returns required services, projected Schema, explicit limitations and a conservative literal `form` descriptor |
| `editPlugin` | `id`, `base` (Preset `pluginRevision`), `op`, `rowId`; add also `module/config/parentId?`, configure `config`, toggle `enabled`, move `direction:-1/1` |
| `installedSkills` | Host-discovered files and duplicate-name diagnostics |
| `assignSkill` | `id`, `base`, `skill`, `enabled`; Host selects the discovered path; no browser path is accepted |

Existing Modes actions and `dshModes` service remain available. `assignedSkill`/`assignedSkills` extend that service for the existing scoped policy Provider; this is not a second Skill registry. Installed file invocation metadata must use native boolean frontmatter; invalid or legacy privilege flags are refused. A missing/invalid assigned file is not served from a stale body. Global/per-mode Off and pinned versions take precedence.

All mutating requests are serialized. New plugin edits require CAS; other legacy row edits also compare their snapshot after validation. Native temporary Preset registration/acquisition validates the merged composition and is disposed on success or failure. `configEditor.edit` owns primary file locking/reconciliation. The manager also verifies the actual saved revision: native Preset registration can retain a broken composition without throwing from the parent configuration row. If final activation fails after a successful probe, the manager restores the previous target config through the same native editor and verifies recovery. Intervening changes refuse automatic rollback and report `recovery-required`. Existing expressions may be preserved verbatim; the JSON editor cannot introduce or change executable expressions.

Base definitions are never written. The fork recursively merges every Group, retaining user additions, explicit deletions, field edits and sibling order; new upstream rows join the merged list. Existing Agent revisions remain retained by DSH. State files use original atomic replace/error reporting, not cross-process database transactions. Use one Host per Profile; maintain backups of both Profile patch and sidecar state.

## Lifecycle and limits

Manager unload unregisters routes/service. Queued writes refuse a closed instance; edits validated across unload refuse before writing. Native config reconciliation handles rollback; a request already committed before client cancellation is not undone by closing its page. Client unload aborts outstanding RPC and late data responses cannot overwrite a later page load/save.

Scope compatibility is proven by native assembly, not module naming. Currently Host-only modules already active outside all Presets are conservatively rejected for additions. The lifecycle of an otherwise selected installed module executes during validation; installed code must already be trusted. Do not use this manager to test arbitrary downloaded or malicious plugins.

Original self-update helpers are retained for the manager itself with the new package identity; automatic checks default Off and local source installs do not query registries. The package is not on npm. General installation remains DSH's responsibility.

## Verification and rollback

Run `npm test` and the two-process `scripts/run-host.ps1` against the installed DSH. The native test covers Owner fencing, real API envelopes, package discovery, Schema projection, invalid/missing/leaking plugin rejection without Profile writes, CAS, source read-only, scoped Skills, ordinary Workers and native Spawn/cold recovery. Synthetic LLM responses prove routing, not model quality. Web GUI operations have been tested with synthetic data in native settings; actual Desktop window and visual HMR remain unverified. Resource availability alone is not GUI acceptance.

Frontend resource checks read the advertised URL from the native `__DSH_BOOT__` graph. This Host serves revisioned combo resources; an invented `/plugins/<package>/client.js` address deliberately returns 404 and is not evidence of failed activation.

Before replacing a package, retain package manifest/lock, Profile patch and `.dsh-preset-manager/`. Roll back package and matching configuration together through native management; retain user Session/Memory files. No automatic migration from original Modes or live deployment is performed by the test scripts. Useful failure evidence is left in `.local/`, never packaged or committed.

## Literal configuration forms

`inspectPlugin.form` projects primitive fields, finite enums, local refs and native nullable/expression wrappers. Unsupported unions, nested structures and projection limitations retain JSON editing. Existing expressions remain inert and cannot be created or modified through this editor. Forms preserve unrelated JSON keys, support omission/defaults and never replace Host Config/dependency/Scope checks. No second schema validator or service is introduced.

Character test.17 removes default Worker Boundary. The manager itself neither strips arbitrary guards nor grants Root identity; only native Preset assembly determines tools/Skills. Configure the native Skill loading tool explicitly when needed. Keep Character and manager as independent native Bundles; no Core/Extras duplication. Profile updates must preserve patch plus the complete sidecar directory, including Skill versions and merge bases. Character candidate migration removes only its exact old Boundary module and refreshes unchanged old Worker Personas.

## Runtime selection

The rc.3 official installer may place DSH outside the existing data/toolkit directory. Tests accept `DSH_CHARACTER_HOST_ROOT` for the selected executable/SDK, while `DSH_INSTALL_ROOT` remains the existing data/tool runtime root. Windows CLI paths are explicitly quoted. No Character dependency or runtime plugin change is needed; native rc.3 Config/Scope/Owner RPC contracts passed the existing two-process regression.
