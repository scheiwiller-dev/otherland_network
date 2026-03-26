export const CANISTER_IDS = {
  USER_NODE: process.env.USER_NODE_CANISTER_ID || 'umunu-kh777-77774-qaaca-cai',
  CARDINAL:   process.env.CARDINAL_CANISTER_ID   || 'uxrrr-q7777-77774-qaaaq-cai',
};

export const IS_MAINNET = process.env.DFX_NETWORK === 'ic';