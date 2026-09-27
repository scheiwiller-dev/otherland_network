# `Otherland Network`

Original Idea (2021): \
https://docs.google.com/document/d/10aCnPtlk5jxao3bkXkVag74I6hlBHozo3HQKZCO9zkg/edit?usp=sharing 

Otherland Network on X: \
https://x.com/otherland_x

Otherland Network on YouTube: \
https://www.youtube.com/@Otherland_Network

`Tech Stack`

- Dfinity ICP Application
- written in Motoko and HTML5 / CSS / JS
- for VR, Desktop and Mobile (cross play)
- using three.js for 3D Rendering
- using Rapier as Physics Engine
- using peer.js for P2P communication
- using esprima for custom code
- written with assistance from Grok and Cursor

`Current Functionality`

- Loads the environment, list of entities and program code from the local/network node
- Caches data of nodes with hash, loads data from cache if hash stayed the same
- Subscribes to other entities via WebRTC to stream their position, movement, etc.
- Broadcasts own location, movement, etc. at WebRTC address deposited in the node
- Renders the view of the environment and entities, animated with program code
- Reacts to basic gestures from the user provides menu options Basic User Interface

`Future Roadmap`

- In-World Chat and VoiceChat (Global / Channel / Single)
- Inventory, Items and Scarcity mechanisms for RPG economy
- Radar for Interaction Points
- Friendlist with direct calling, messaging and data sharing
- Better Avatar and visibility management
- Automate user movement & gestures with pre recorded macros
- Better Interface for Node and TreeHouse management, allow external asset sources
- Wallet to pay for all expenses in Otherland and to receive donations
- Convert glTF, obj, 3ds and other file formats to glb in App
- NPCs controlled by LLMs through APIs (custom)

`Setup`

Install [icp-cli](https://cli.internetcomputer.org/1.6/guides/installation) and ic-wasm, plus Node.js 22 or newer, npm, and mops. The local gateway is `127.0.0.1:8000`. Internet Identity is started with the local network and served at `http://id.ai.localhost:8000`. Motoko compiles through mops (`moc` 1.14.0 in `mops.toml`).

```bash
npm i -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops
```

From a fresh clone:

```bash
npm install
npm run mops:setup
cp .env.example .env
npm run network:start
npm run deploy
```

`npm run deploy` builds the Motoko canisters, generates the JavaScript bindings, builds the frontend, and installs everything. Open the `otherland_client` URL printed at the end (`http://otherland_client.local.localhost:8000`). Login uses `http://id.ai.localhost:8000`.

`First admin`

Cardinal has no admin until someone claims it. On first boot it generates one setup token and writes it to the controller-only log:

```bash
icp canister logs cardinal
```

Log in with Internet Identity. The app shows your principal (also listed under Profile → Identity, and printed in the browser console as `Logged in with principal:`) and asks for that token. The first logged-in principal that submits it becomes admin. The token is then deleted. `icp identity principal` is the deployer identity, not this Internet Identity principal.

`Cycles`

Creating a user node draws cycles from Cardinal and is refused while Cardinal holds less than 2.5T. The local network seeds the deployer identity with cycles. Move some of that balance onto Cardinal:

```bash
icp cycles balance
icp canister top-up cardinal --amount 20T
```

`icp canister status cardinal` prints the canister balance afterward. Repeat the top-up whenever creating another node reports that Cardinal is short on cycles.

For a Vite dev server on port 3000, fill `ICP_CLI_CID_*` in `.env` from `icp canister list`, then:

```bash
npm start
```

`Restart the local network`

Stop and start keep the existing canisters:

```bash
npm run network:stop
npm run network:start
```

To wipe local state, including Internet Identity anchors:

```bash
npm run network:stop
rm -rf .icp/cache
npm run network:start
npm run deploy
```

`Participate`

If you are working on something similar or find this idea interesting, don't hesitate to make contact.

`Disclaimer`

This project is not related to any crypto project or token.

This project is a fan-based initiative and is not officially affiliated with, endorsed by, or connected to any of the original creators or entities involved in the development of Otherland, including Game OL GmbH, DRAGO Entertainment S.A., or Tad Williams.
