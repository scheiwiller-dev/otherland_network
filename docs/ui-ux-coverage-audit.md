# UI / UX coverage audit

Audit of branch `dev` at `8d5a74d` (includes PR #35, asset panel in normal layout). Read-only: Motoko public methods in `src/otherland_network/` compared with the Three.js client in `src/otherland_client/`. No UI was changed for this report.

Scope is social and node management that already exists, plus layout of screens that already exist. Chat, voice, economy, VR locomotion, custom UI panels, and mainnet are out of scope except where an existing control is dead or empty.

## Executive summary

Login, guest entry, a profile (username, principal, peer id), a friends list (request, accept, decline, remove, invite link), a node list, create-node, enter, asset upload/delete, and an admin WASM panel are all present. The visual language (Orbitron, black panels, cyan borders) is consistent from the landing page through the in-world menu.

The holes are in wiring and in the shell, not in missing screens. Private-node “add friend” calls `addAllowed`, which is not a Cardinal method (`addAllowedUser` is). Saving an edit on your own node does not call `updateKhetMetadata`. Username saves ignore the canister `Result` and, on first login, often never reach a node because no node id is selected yet. Friends and allowed users render as raw principals. There is no presence API and no user-to-user block API. There is no rename, delete, or archive for a node.

Layout is desktop-fixed. `#tab-content` has `min-width: 665px` and `left: 280px` while `body` is `overflow: hidden`, so phones clip the Nodes, Profile, and Assets panes instead of reflowing them. The only breakpoint is `max-width: 1000px`, and it keeps the 199px sidebar. PR #35 made the asset editor scroll inside the tab; the surrounding menu still does not fit a narrow window.

## Coverage

Status means: **full** (the call is reachable and its result is shown), **partial** (a control exists but a step, argument, or result is missing), **missing** (no control). “No API” means the UI cannot grow without a new canister method; those rows are not recommended as the next slices.

| Capability | Backend (file / API) | UI surface | Status | Notes |
| --- | --- | --- | --- | --- |
| View own username, principal, peer id | `user_node.getUsername`; principal from Internet Identity; peer id from PeerJS | Profile tab `#user-profile` | Partial | Username and principal render. Peer id stays on “Generating Peer ID ...” until `online.ownID` exists; copy uses `online.ownID` when the label is still the placeholder. No avatar on this screen. |
| Set username at first login | `user_node.setUsername` → `cardinal.registerUsername` / `isUsernameTaken` | `#username-screen` | Partial | Shown when II login finds no username on the current node actor. New users have no `nodeSettings.nodeId`, so `getUserNodeActor()` returns null and the name is stored only in `localStorage`. Length check is client-side (min 3). Canister also enforces max 32 and uniqueness; the `Result` is not read. |
| Edit username later | same as above | Profile “Change” | Partial | Same ignore-`Result` bug: a taken name still updates `localStorage` and the label, because `#err` does not throw. If no node is connected, the canister call is skipped. |
| Look up another user’s username | `cardinal.getUsername` | Node list owner column uses the username already returned by `getAccessibleCanistersWithDetails` | Partial | Friends, pending requests, and the allowed-users list print `Principal.toText()` only. |
| Choose avatar | No profile field. Avatars are khets with `khetType == "Avatar"` | In-world game menu → Avatar (`populateAvatarButtons`) | Partial | Lists `Avatar ${khetId}` after a world is loaded. Not on Profile, not on the start screen. `#1` asks for selection at start. `freeAvatarChoice` is a local TreeHouse flag with no control. |
| Send friend request | `cardinal.sendFriendRequest(identifier)` | Profile “Add Friend” (username or principal) | Full | Errors use `alert`. |
| List / accept / decline incoming requests | `getPendingFriendRequests`, `acceptFriendRequest`, `declineFriendRequest` | `#pending-requests` on Profile (also refreshed when Nodes opens) | Partial | Works. Rows show the sender principal, not a username. No timestamp. Accept/decline are unlabeled beyond the button text and use `alert`. |
| Remove friend | `cardinal.removeFriend` | Friends table “Remove” | Partial | Removes only the caller’s list (canister does not remove the other side). No confirm. Principal text only. |
| One-sided `addFriend` | `cardinal.addFriend` | none | Missing | Unused. The request/accept path is the one the UI should keep. Do not add a button for this. |
| Generate friend invite | `cardinal.generateFriendInvitation` | “Generate Invite Link” and “Invite Link” (same handler) | Partial | Token is shown as `/?invite=` text. No copy button. Two buttons do the same thing. Outstanding invites are not listed. |
| Accept invite link | `cardinal.acceptFriendInvitation` | `?invite=` confirm on login (`handleInvitation`) | Partial | Runs after username setup, not for a guest who has not logged in. Expired/invalid tokens alert. |
| List / cancel outgoing invites | `getPendingInvitations`, `cancelInvitation` | none | Missing | Token is forgotten on refresh. |
| Friend presence / online | No friends-presence method. `user_node.getNearbyPlayers` is session distance for WebRTC, used in `peermesh.js` | `#friends-list-hud` is the static string “Friends List” | Missing | Not a thin UI over an existing friends API. Building presence would be a new feature. |
| Block or unblock a friend | No user block API. `cardinal.blockUser` / `isBlocked` are admin-only | none on Profile | Missing | `isBlocked` rejects `requestCanister` server-side. No admin checkbox either. |
| `isFriendWith` | `cardinal.isFriendWith` | none | Missing | Query helper only. No UI needed if lists stay canister-backed. |
| Continue as guest | Anonymous identity | Start screen “Continue as Guest”; account switcher shows Guest + II login | Partial | Skips username. Profile username “Not set”, principal “Not logged in”. |
| Create node | `cardinal.requestCanister` (rejects anonymous, blocked, missing WASM, low cycles; returns the existing id if one exists) | Nodes “Create new Node”, shown when the caller has no owned canister | Partial | II users can create one node. Guest still sees the button. Failure is `console.error` only (`#28`). Cap of one node is silent (`#ok` of the existing id). |
| List accessible nodes | `getAccessibleCanistersWithDetails` (public, owned, or on the owner’s allow-list). `getAccessibleCanisters` is the older tuple and is unused by the UI | Nodes table: id, owner username + public/private, cycles (owner only), Connect | Partial | Header row has no Connect column. Long canister ids and names do not break (`overflow-wrap` is unset) and the pane clips them. Empty list hides the table. |
| Enter own or other node | Client `changeNode` type 2 (owner) or 3 (other), then `enterWorld` → `worldController.loadScene` | Connect, then “Enter Node” | Partial | Enter stays hidden until Connect. Other people’s nodes do not open the editor or settings (intended). `joinSession` / `leaveSession` exist and are never called; movement uses `updatePosition` only when `nodeType === 2`. |
| Enter own TreeHouse | Local `nodeSettings.localKhets` + cache, not a canister | “Enter TreeHouse” | Full | Local fallback world. P2P flag is separate. |
| Open / close TreeHouse and invite a guest | Local `peerNetworkAllowed`; share URL is `?peerId=` (+ canister id). Host join is PeerJS, not an allow-list | “Open/Close TreeHouse”, “Invite Player” (`navigator.share`), `?peerId=` banner “Connect” then “Enter Friend's TreeHouse” | Partial | Share has no clipboard fallback when `navigator.share` is missing. Quick-connect banner is easy to miss inside the Nodes tab. This is not canister access. |
| TreeHouse settings | Local flags `peerNetworkAllowed`, `freeAvatarChoice`, `standardAccessMode` | Button `#node-config-btn` “Settings” | Missing | No click listener. Flags are import/export only. |
| Node visibility public/private | `setNodeVisibility`, `getNodeVisibility` (default private on create) | Node Settings checkbox, only after Connect on your own node (`nodeType == 2`) | Full | Failure is not surfaced if the actor call throws. |
| Allow / remove a reader on your node | `addAllowedUser(nodeId, user)` also calls `user_node.addReader`. `removeAllowed` calls `removeReader` | Node Settings: friend `<select>`, Add, per-row Remove | Partial | Remove matches `removeAllowed`. Add calls `actor.addAllowed(principal)` — that method does not exist, and the real method also needs the node id. Allowed rows are principals. Dropdown is friends only, which matches the label, not arbitrary principals. |
| Grant / revoke read or write on the user node | `grantReadAccess`, `revokeReadAccess`, `grantWriteAccess`, `revokeWriteAccess` | none | Missing | Cardinal allow-list is the path the settings screen was aiming at. Write access has no screen. |
| Per-object readers/writers | `user_node.updateKhetPermission` | none | Missing | |
| Upload asset to own node | `initKhetUpload`, `storeBlobChunk`, `finalizeKhetUpload`, `abortKhetUpload`, `finalizeBlob`, `deleteBlob` | Assets “Upload to Node” (`.glb`), enabled when editing your node | Partial | Upload path is implemented in `khet/upload.js`. Button is disabled for TreeHouse. Mobile file input sits in a pane that phones clip (`#12`). No folder model (`#1`). |
| Store asset on this browser (TreeHouse) | `localStorage` `localKhets` + IndexedDB cache | “Store to Cache”, enabled for TreeHouse, disabled for a canister node | Full | For the local TreeHouse only. |
| List / delete one asset / delete all | `getAllKhets` via `loadAllKhets`; `removeKhet` on own node; `clearAllKhets` | Assets table Edit/Delete; “Delete All Objects” | Partial | Delete on a canister node calls `removeKhet`. `deleteKhet` is a second, unused delete. TreeHouse delete is local only. Table columns (id, type, position, scale, code, edit, delete) assume a wide pane. Code column is `display: none` only under 1000px. |
| Edit asset position and scale | `updateKhetMetadata` | Assets editor number fields, Discard, Save & Close | Partial | TreeHouse save writes local metadata and cache. Own-node save is an empty branch (`// Existing logic for Own Node`) and does not call `updateKhetMetadata`. Discard resets the fields to 0/1 rather than the last saved values. No in-world handles (`#1`). |
| Rename node | No method | none | No API | Username is the owner label, not a node title. |
| Delete or archive node | No method. `requestCanister` keeps a single registry entry | none | No API | |
| See own node cycles | Included on `getAccessibleCanistersWithDetails` for the owner; `user_node.getCyclesBalance` | Nodes table, owner rows only (millions of cycles) | Partial | `getNodeStatus` (admin or self) is unused. `getStorageUsage` always returns 0 and has no UI. |
| App settings | none | Sidebar Settings → empty `#settings-tab` | Missing | Tab is marked `future-update` in HTML, but that class only greys sidebar buttons, and these buttons do not have the class. The item looks live. |
| In-world HUD settings | none (DOM toggles) | Game menu Settings: show chat, friends list, map; Enter VR | Partial | Under 1000px the stylesheet sets chat, friends HUD, and map to `display: none`. The checkboxes set inline `display`, which overrides that. Account switcher (Login / Logout) is also `display: none` under 1000px, including inside `#info-box`. |
| Wallet | none | Sidebar Wallet, placeholder copy only | Missing | Same false-affordance as Settings. Out of scope to build. |
| Claim admin | `claimAdmin`, `isAdminConfigured` | `window.prompt` for the log token after II login | Partial | Works once. Easy to dismiss; not a screen. |
| Admin: see Cardinal cycles | `getCyclesBalance` (admin) | Admin tab | Full | Hidden unless `callerIsAdmin`. |
| Admin: upload user-node WASM and upgrade own node | `uploadWasmModule`, `upgradeCanister` | Admin file input + “Upgrade my node” | Full | Upgrades the admin’s own node only, as the canister does. |
| Admin: transfer admin, list users, node status, top up cycles, block user | `setAdmin`, `getAllRegisteredUsers`, `getNodeStatus`, `topUpNodeCycles`, `blockUser` | none | Missing | Operator/CLI surface today. Not required to round out the player UI. |
| User levels (guest with profile, free, paid) | Anonymous check, one admin principal, node owner, `blockedUsers` | Guest vs II label; Admin nav item | Missing | `#25`. No paid/free field exists. Do not invent tiers in the layout slices. |

Session helpers (`joinSession`, `leaveSession`, `updatePosition`, `getAllPlayerPositions`, signaling, chat history) already have some client code and are not in the recommended slices. In-world chat is a HUD, not a management screen. `#27` (user-authored panels) is a new feature.

## Responsive findings

One stylesheet: `src/otherland_client/src/index.scss`. Breakpoint: `@media (max-width: 1000px)` only. `index.html` sets `maximum-scale=1` and `user-scalable=no`. `body { overflow: hidden }`. No `overflow-wrap` / `word-break` anywhere, so principal and canister ids stay one long token.

### Landing (`src/landing_page/index.html`)

- Separate static page, same type and colors, no shared stylesheet and no media queries.
- `h1` is 48px. The tagline is `max-width: 475px` with 35px side margins, so around 390px the line length is fine, but a 48px title plus three stacked buttons is a tall column with no `padding` on `body` for browser chrome.
- “Enter Otherland” is `disabled` with an empty `onclick`. The real entry is the client start screen.

### Start and username

- `#start-screen` is a centered column, `h1` 48px, buttons `margin: 15px`, no max-width on the tagline (`h3` in the client has no `max-width`, unlike the landing page). On a 320–390px width the title wraps; buttons stay tappable. No breakpoint.
- `#username-screen .username-container` is `max-width: 420px` with `padding: 40px` and default `content-box`, so the box is about 500px wide and overflows a phone. Inputs are `width: 100%`. Cancel is `width: calc(50% - 12.5px)` plus `margin-right: 20px`, so the pair overflows the card even before the viewport does.
- `user-scalable=no` blocks pinch-zoom on both screens.

### Main menu shell (Nodes, Profile, Library, Assets, Admin)

- Sidebar is `position: absolute; width: 199px; padding: 100px 40px` (content plus padding ≈ 279px). `#tab-content` is `left: 280px; width: 100%; min-width: 665px; overflow: hidden; padding: 100px 40px`. The tab box is at least 665px and also shifted 280px, so the menu wants ~945px before anything inside it. Wider than the window, the extra is clipped, not scrolled.
- At `max-width: 1000px`, sidebar padding drops to 20px and `#tab-content` moves to `left: 240px`, but sidebar width stays 199px and `min-width: 665px` is unchanged. A 390px phone shows ~150px of the tab and clips the rest. Tablets in portrait (768px) still lose the right side of Nodes and Profile.
- Sidebar has `overflow-y: scroll` only under 1000px. Above that, `padding-top: 100px` plus six buttons (`margin: 20px 0`) clips Settings and Admin on short laptop heights (~720px) because `body` cannot scroll.
- `#node-buttons` and `#treehouse-buttons` are `display: flex` with no `flex-wrap`. Buttons are `margin: 20px 40px 20px 0`. They run off the clipped pane on anything narrower than a wide desktop.
- Profile rows are a single non-wrapping flex line: label `min-width: 100px`, value `max-width: 370px` (peer id 250px), then Copy / Change. Principal text does not break. `#edit-username-row` is `margin-left: 125px` with an input `width: 360px`.
- Friends and node tables are `width: 100%` with fixed cell padding and 125px action buttons. Unbroken principals widen the table past the pane.
- Node table header has three `<th>` cells; Connect is a fourth `<td>`, so columns do not line up.
- Library upload row wraps (`flex-wrap: wrap`) but each text input is still `width: 360px`.

### Assets editor (after PR #35)

- `#assets-tab` scrolls (`overflow-y: auto`, `height: calc(100vh - 100px)`). `#khet-editor` is in normal flow, `width: min(760px, calc(100vw - 360px))`.
- That width uses the full viewport minus a sidebar allowance, not the tab’s actual inner width. At 390px, `100vw - 280px` (the 1000px override) is about 110px, so the editor collapses while the tab’s `min-width: 665px` is clipped by the parent. The editor can be both too narrow and off-screen.
- Parent `#tab-content` padding is 100px top and bottom, and its overflow is `hidden` above 1000px. The assets tab is `100vh - 100px` tall inside a content box closer to `100vh - 200px`, so the bottom of the scroller (upload / save) is clipped on desktop until the window is shortened enough to scroll the tab itself. Under 1000px, tab padding is 20px but the assets height becomes `100vh - 20px`, which is still taller than the padded parent.
- `#khet-list` max-height uses `100vh - 640px` (520px under 1000px). On a short screen the table becomes a 120px strip, which is workable only if the pane itself can scroll. The id column is fixed at 220px.
- `#khet-type` is `width: 300px` globally and `320px` inside the editor.

### In-world chrome

- Game menu is `width: 90%; max-width: 400px`, centered. This panel is the one surface that already fits a phone. Avatar page scrolls at `max-height: 50vh`.
- Crosshair is `left: calc(50vb - 10px)`. `vb` is the viewport’s block size (height in horizontal writing), not width, so the crosshair is not centered horizontally.
- Chat is `width: 300px` at `left: 20px; bottom: 20px`. Friends HUD is `250×300` at the top left. Map is `250×250` at the bottom right. `#info-box` is `max-width: 210px` at the top right. These four corners overlap on a phone and cover the view on a small tablet.
- Under 1000px, chat, friends HUD, and map are `display: none`, and `#info-box` hides `#account-switcher`, so Logout / “Login with Internet Identity” disappear on tablet and phone while the world is up. `#node-state` is forced to `155px`.
- Mobile controls (`#joystick-zone` 150×150, Jump, Sprint, Use at `left: 50vw`, ESC) are `position: fixed` and show for touch devices. Use is 100px wide starting at the horizontal midpoint, so it sits across the lower center and collides with the chat input when chat is turned back on. Jump and the map occupy the same bottom-right corner.
- `isTouchDevice` chooses mobile controls; there is no width breakpoint for a narrow desktop window or a resized browser.

## Issue overlap

Issues were read and left open.

- **#1 3D Asset management.** Overlaps the Assets table: list, upload `.glb`, cache, delete, numeric position/scale. Still open relative to this audit: save-to-node is a no-op, avatar pick is in-world only and labeled by id, no folders, no separate public/user libraries, no live in-world edit. Those last items are the issue’s feature work, not layout polish.
- **#12 Mobile** (“Cannot upload data files / Still bad layout”). Matches the shell: `min-width: 665px`, fixed sidebar, clipped asset pane, file input inside that pane. PR #35 fixed editor scrolling inside `#assets-tab` and did not change the menu frame. No second breakpoint below 1000px.
- **#25 User Levels.** The running distinction is anonymous guest, II user, node owner (highlighted row, editor, settings), and Cardinal admin (nav item). No guest-with-profile, free, or paid record. Blocked users fail at `requestCanister` with no UI.
- **#27 UI management.** No user-made panels. Empty Settings and Wallet tabs are placeholders, not that system. Out of scope here.
- **#28 Guest node creation.** `requestCanister` now returns an error for an anonymous principal. The Nodes button still appears for guests, and `requestNewCanister` only logs the error. A guest still cannot edit or load a canister node. TreeHouse (local) remains available.

## Recommended next slices

Ordered so each change is understandable on its own and finishes something the backend already does. None of these is a visual redesign.

1. **Node Settings add-access call.** In `initNodeAssets`, call `addAllowedUser` with the connected node id and the selected friend, and show `Result.err` on add, remove, and the public toggle. The screen and the allow-list API already exist; the button calls the wrong method name.

2. **Username `Result` and first save.** On both the username screen and Profile “Change”, if `setUsername` returns `#err`, keep the previous name and show that text. When a node id appears later (after Create / Connect), write the `localStorage` name through `setUsername` once. No new profile fields.

3. **Friends labels and outgoing invites.** Resolve `cardinal.getUsername` for pending requests, the friends table, and the allowed-users list, with the principal as secondary text. Add copy on the invite paragraph, and a short list from `getPendingInvitations` with `cancelInvitation`. Drop the duplicate “Invite Link” button in the same edit if it is the same handler.

4. **Save own-node asset edits.** In the own-node branch of Save & Close, call `updateKhetMetadata` with the position and scale already read from the form, and surface `#err`. TreeHouse local save stays as it is. Discard should restore the values loaded when Edit was clicked.

5. **Narrow menu frame, same visuals.** One breakpoint (the existing 1000px, or a second one near 700px if the first pass is too cramped): stack the sidebar above `#tab-content`, remove `min-width: 665px`, wrap `#node-buttons` and `#treehouse-buttons`, and set `overflow-wrap: anywhere` on principal and canister-id cells. Point `#khet-editor` width at the tab’s inner width (`100%`) instead of `100vw - 360px`. Fix the crosshair to `50vw`. Do not restyle colors, type, or buttons.

6. **Guest create-node and dead nav.** Hide “Create new Node” for an anonymous identity, or show the `requestCanister` error string in the Nodes tab (`#28`). Remove or disable `#node-config-btn` until TreeHouse settings exist. Grey or hide Wallet and Settings the way `.future-update` was meant to, so empty tabs are not tappable.
