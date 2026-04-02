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
- using three.js for 3D Rendering
- using Rapier as Physics Engine
- using peer.js for P2P communication
- using esprima for custom code
- written with assistance from Grok

`Current Functionality`

- Loads the environment, list of entities and program code from the local/network node
- Caches data of nodes with hash, loads data from cache if hash stayed the same
- Subscribes to other entities via WebRTC to stream their position, movement, etc.
- Broadcasts own location, movement, etc. at WebRTC address deposited in the node
- Renders the view of the environment and entities, animated with program code
- Reacts to basic gestures from the user provides menu options Basic User Interface

`Future Roadmap`

Implementing functionality to placeholdes UI areas:
- In-World Chat and VoiceChat (Global / Channel / Single)
- Inventory, Items and Scarcity mechanisms for RPG economy
- Radar nor Interaction Points
- Friendlist with direct calling, messaging and data sharing
- Better Avatar and visibility management
- Automate user movement & gestures with pre recorded macros
- Better Interface for Node and TreeHouse management, allow external asset sources
- Wallet to pay for all expenses in Otherland and to receive donations
- Convert glTF, obj, 3ds and other file formats to glb in App

`Setup IDE`

https://internetcomputer.org/docs/building-apps/getting-started/install 
- Install WSL (ubuntu)
- Install VS Code (start in WSL mode!)
- Install nvm, node.js, npm, mops, dfx
- Clone Git Repo
- 'dfx start --background --clean'
- 'dfx deploy'

`Reset Network`

'dfx stop' (or 'dfx --killall' if needed)
'rm -rf .dfx' (if internet identity anchors fail)
'dfx start --background --clean'
'dfx deploy'

`Participate`

If you are working on something similar or find this idea interesting, don't hesitate to make contact.

`Disclaimer`

This project is not related to any crypto project or token.

This project is a fan-based initiative and is not officially affiliated with, endorsed by, or connected to any of the original creators or entities involved in the development of Otherland, including Game OL GmbH, DRAGO Entertainment S.A., or Tad Williams.