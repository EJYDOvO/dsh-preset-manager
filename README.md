# dsh-modes

English | [中文](https://github.com/xiaohai-78/dsh-modes/blob/main/README.zh.md)

A **Modes** settings page for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web interface. You can switch what each agent mode can do, edit each mode's system prompt, create your own modes from templates, and merge built-in updates in one click after a dsh upgrade.

<img src="assets/screenshot-modes.png" alt="Settings → Modes" width="640">

## What it does

- **Understand each mode at a glance**: every mode gets a card that lists what it can do (run commands, read and write files, browse the web, use subagents, and so on), so you can compare modes without opening them.
- **Switch capabilities, not plugins**: 15 capabilities, one switch each. For example, turn off "Run commands" or make files read-only, without facing dozens of plugin names.
- **Edit the prompt**: edit each mode's system prompt with a preview and a version history. You can also let a saved prompt reach sessions that are already running, or let the model change the prompt in chat; every save asks you first.
- **Create your own modes**: start from four templates (Develop, Write, Chat, Read-only research), or copy any existing mode.
- **Keep up with dsh upgrades**: when dsh updates its built-in modes, merge the changes in one click and keep yours. When a plugin fails to load, turn off just the failing plugins in one click.

## Install

You need the dsh Web interface (`dsh web`). See [Compatibility](#compatibility) for supported versions.

```bash
dsh plugin --profile web add dsh-modes
```

If you run dsh from source, run `pnpm dsh plugin --profile web add dsh-modes` in the source folder instead. After installing, restart `dsh web` and open **Settings → Modes**.

## Quick start

1. Open **Settings → Modes** and look at the built-in modes: the small labels on each card are what it can do.
2. Click **New mode** at the top right, pick **Read-only research**, and click **Create**.
3. The new card opens on the **Capabilities** tab: **Run commands** is off, and **Files** is on with **Allow file changes** off.
4. Click **New session with it** on the card and ask it to change a file. This mode has no tool to write files, edit files, or run commands, so it can only read and search.
5. Go back to the card's **Prompt** tab, change a sentence, and save. New sessions use it right away; to apply it to sessions that are already running, turn on **Live prompt** below.

## Features

### The mode list

Each mode is one card:

- **Header**: the name and description, with **Default** and **Custom** labels.
- **Capability labels**: what the mode can do, for example "Commands · Files (read-only) · Web".
- **Status line**: plugins on, open sessions, changes made, and whether the prompt is live.
- **Buttons**: **New session with it** opens a new session in this mode. The **⋯** menu holds the other actions: Make default, Duplicate, View configuration (YAML), Edit details, Restore built-in, and Delete.
- **Notices**: when something needs your attention, the card shows one notice with a button to fix it, for example "The built-in mode was updated", "plugins cannot load", or "an unsaved prompt draft".

Click a card to open it. It has three tabs: **Capabilities**, **Prompt**, and **All plugins**.

### Capabilities

| Group | Capabilities |
|---|---|
| What it can do | Run commands, Files (with a separate **Allow file changes** switch), Web, Subagents and workflows, Extend itself (plugin management, plugin market, plugin API lookup) |
| How it works | Plan mode, To-do list, Session goals, Skills, Ask you, Deliverables, Reminders |
| Context | Workspace instructions (AGENTS.md, CLAUDE.md, and similar), Time awareness, Context compaction |

- **Turning a capability on** restores it as the built-in mode has it. Plugins that switch by environment (such as Bash and PowerShell) go back to **Auto**, and plugins the built-in mode keeps off (such as the Codex subagent) stay off.
- **Turning a capability off** switches off every plugin it includes.
- A capability with only some of its plugins on is marked **Partly on**.
- Capabilities the mode has no plugins for are hidden; for example, dsh before 0.2.1 has no Reminders.

### Prompt

- **System prompt**: edit this mode's system prompt. Insert variables such as `{{model}}` with a click, and the editor checks them as you type. **Preview full system prompt** shows everything the model receives.
- **Advanced settings**: a closing prompt (added after tool guidance and workspace rules), "use only the opening text as the complete prompt", and "include runtime context".
- **Save**: click **Save** or press ⌘/Ctrl + Enter. Everything above takes effect only after you save.
- **History**: every save records a version (up to 30), labeled by where it was made: Settings, in chat, or elsewhere. You can load any version back into the editor.
- **Import and export**: `.md` files.
- **Restore built-in prompt**: asks before it replaces your prompt.
- **Nothing gets lost**: unsaved edits stay in the browser as a draft, even after a page refresh. If the prompt changes elsewhere while you edit, saving is refused and you choose between loading the latest version and overwriting it with yours.

The **In chat** section has two switches that **save as soon as you click them**. They apply to sessions created afterwards:

- **Live prompt**: after you save the prompt, running sessions use it from their next step.
- **Allow prompt changes in chat**: you can tell the model "change your prompt to …". The model reads or changes this mode's prompt with the `mode_prompt` tool, and **asks for your approval before every save**.

### All plugins

Lists every plugin in the mode, for when you need to adjust them one by one:

- Search within the tab, or show only changed plugins.
- Plugins that switch by environment offer **Auto / On / Off**.
- Each changed plugin can be reset on its own with **Restore**.
- **Details** shows the row id, module, and full configuration.

### New modes

| Start from | What it can do | Good for |
|---|---|---|
| Develop | Same as the Standard mode | Everyday coding |
| Write | Read and write files, workspace instructions, to-do list, deliverables, skills, context compaction, asking you, time; **no terminal** | Documents and drafts |
| Chat | Web, context compaction, asking you, time; **no files or terminal** | Questions and conversation |
| Read-only research | Read and search files, web, workspace instructions, to-do list, skills, context compaction, asking you, time; **cannot change files or run commands** | Reading code and research |
| Copy a mode | Same as the mode you copy | Small changes to an existing mode |

Each template comes with a starter prompt in Chinese or English, following the interface language. The name and ID are filled in for you, and you can change both.

### Keeping up with dsh upgrades

- **Sync built-in update**: after a dsh upgrade, built-in modes you changed, and custom modes based on a built-in mode, show "The built-in mode was updated". Before you sync, the card lists the plugins that were added, removed, or changed upstream. When you confirm:
  - plugins you never touched follow the built-in version;
  - settings you changed keep your value;
  - plugins added upstream join template-based modes switched off.
- **One-click repair**: when a plugin in a mode fails to load, the whole mode stops working. The card lists the failing plugins with their reasons; **Turn these plugins off** switches off only those, and the mode works again.
- **Before you delete**: deleting a custom mode first tells you how many open and saved sessions use it. Those sessions cannot be opened after the mode is deleted.

## When changes take effect

- Every change applies to **sessions created afterwards**; running sessions keep what they started with. The one exception is a mode with **Live prompt** on: its saved prompt text reaches running sessions from their next step.
- Changes are written to the current dsh profile's `cordis.patch.yml`, so other windows using the same profile see them too. The Desktop app uses a different profile and is not affected.
- The result of every action shows in a bar at the bottom of the page. Errors stay until you close them.

## Compatibility

| dsh version | Result |
|---|---|
| `0.2.0-rc.2` (npm `latest`) | Works. This dsh version provides no localized plugin names, so the plugin shows each plugin's official name instead |
| `0.2.1-alpha.3` | Works |
| `0.2.1-rc.1` (npm `next`) | Works. rc.1 adds a plugin market tool to the built-in modes; modes you changed show "The built-in mode was updated", and syncing adds it switched off |

Every version above was installed and tested, including checks of the actual requests sent to the model through a local mock model. The dsh APIs this plugin uses are not stable yet, so other versions may need changes.

## FAQ

**I changed a switch or the prompt, but the chat did not change.**
Changes apply to sessions created afterwards. Try **New session with it**. Only a mode with **Live prompt** on applies its prompt text to running sessions.

**A mode stopped working after a dsh upgrade.**
Open its card. If it reports plugins that cannot load, click **Turn these plugins off**. If it says the built-in mode was updated, click **Sync built-in update**.

**I made a mess. How do I go back?**
- One plugin: click **Restore** in **All plugins**.
- The prompt: load any version from **History**, or click **Restore built-in prompt**.
- A whole built-in mode: choose **Restore built-in** in the **⋯** menu.

**I asked the model to change its prompt, and nothing happened.**
**Allow prompt changes in chat** only applies to sessions created after you turned it on. Also, if dsh's approval policy is "never" (for example in unattended runs), saves are refused.

**Where does the plugin keep its data?**
- Mode configuration: the profile's `cordis.patch.yml`.
- Sync baselines and prompt history: the `.dsh-modes/` folder in the profile directory.
- Unsaved drafts: only in your current browser.

## Uninstall

```bash
dsh plugin --profile web remove dsh-modes
```

Before you uninstall:

1. **Turn off two switches first**: on each mode's **Prompt** tab, turn off **Live prompt** and **Allow prompt changes in chat** in the **In chat** section. These switches add this plugin's own modules to the mode. Once the plugin is uninstalled, such a mode cannot find them and stops working.
2. **For a full reset**: **Restore built-in** on the built-in modes you changed, and delete the modes you created. Otherwise changed modes keep running with your changes after the uninstall.
3. **Clean up**: you can also delete the `.dsh-modes/` folder in the profile directory.

## Known limitations

- **Sync needs a baseline**: syncing compares against the built-in plugin list recorded at your last save. Modes changed with a version before 0.5.0 have no such record, so the first sync keeps every difference from the built-in version as your change. Every save after that records a baseline.
- **Scope of Live prompt**: it applies only to the opening and closing prompt text. The "complete prompt" and "runtime context" settings still apply to new sessions only.
- **Scope of chat edits**: `mode_prompt` reads and writes only the opening prompt text.
- **Session count**: counting saved sessions before a delete reads each session's record. With many sessions it stops after 8 seconds and shows "at least N".
- **Permissions**: write actions rely only on dsh's own sign-in check.

<details>
<summary><b>Developer reference: how it works</b></summary>

### Parts

| File | Role |
|---|---|
| `index.js` | Host plugin. Serves `POST /api/dsh-modes` and the `dshModes` service the two modules below use. Edits to built-in modes are written as a profile override of the mode's row through `configEditor.edit()`; plugin display metadata comes from `pluginInventory.list()` |
| `container.js` | Custom-mode container: keeps the `presets` list in its config and calls `agentPresets.register()` for each entry |
| `rebase.js` | Three-way merge for syncing built-in updates: takes the built-in plugin list from your last save as the base and merges your changes onto the latest built-in list. On conflict, your value wins |
| `state.js` | Files in the profile's `.dsh-modes/` folder: `state.json` (sync baselines, plus which built-in mode and template each custom mode came from) and `history.json` (prompt history). Writes go to a temporary file first and then replace the original |
| `live-persona.js` | The persona row for Live prompt: replaces the mode's `@deepseek-ai/dsh-persona` row and registers the same two prompt sections, reading the latest saved text every time the prompt is assembled |
| `prompt-tool.js` | The `mode_prompt` tool: mounted as a row inside a mode, so only that mode's sessions see it; asks the user for approval through `tools/pre-execute` before writing |
| `client.js` | The Web settings page (Chinese and English) |
| `cordis.patch.yml` | Inserts the `index.js` and `container.js` host rows |

Actions of `/api/dsh-modes`:

- **Reads**: `list`, `read`, `prompt`, `history`, `usage`.
- **Plugin rows**: `toggle`, `followPlatform`, `applyRows`, `resetRow`.
- **Whole modes**: `reset`, `sync`, `repair`, `create`, `update`, `remove`, `setDefault`.
- **Prompts**: `setPrompt`, `setLive`, `setPromptTool`.

### System prompt

- **Where the prompt lives**: the prompt is the `prefix` (opening) and `suffix` (closing) of the mode's persona row. With `complete: true`, the opening text is the whole system prompt.
- **Variable checks**: available variables are whatever the running dsh registers. For example, `0.2.0-rc.2` still has `{{cwd}}`, which `0.2.1-alpha.2` removed. dsh resolves variables strictly, and one wrong variable makes every step of that mode fail, so saves (including saves from chat) check them first.
- **Conflict detection**: a save carries the version you started editing; if the stored version has changed since, it returns `prompt-conflict` instead of overwriting.
- **How Live prompt works**: dsh appends the new system prompt to the session history as a system message instead of rewriting the opening one, so the previously cached prompt prefix still hits. The change is recorded in the session log.

### Verification

- **Test environment**: each compatible version was installed into an isolated `DSH_HOME`.
- **Request checks**: dsh's own local mock model plus a request-recording proxy were used to check the actual requests sent to the model:
  - the Read-only research mode sends no tool that writes files, edits files, or runs commands;
  - with Live prompt on, the next request of the same session carries the new prompt;
  - when the model calls `mode_prompt`, the interface asks for approval, and after approval the next request carries the changed prompt.

### Tests

```bash
npm test
```

Runs the unit tests of the three-way merge.

</details>

## License

[MIT](LICENSE)
