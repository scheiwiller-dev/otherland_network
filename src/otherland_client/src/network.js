import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';

export const LOCAL_REPLICA = 'http://localhost:8000';
export const LOCAL_IDENTITY_PROVIDER = 'http://id.ai.localhost:8000/authorize';
export const IDENTITY_PROVIDER = 'https://id.ai/authorize';

export function isLocalNetwork() {
  return process.env.ICP_CLI_NETWORK !== 'ic';
}

export function agentHost() {
  return isLocalNetwork() ? LOCAL_REPLICA : window.location.origin;
}

export function identityProvider() {
  return isLocalNetwork() ? LOCAL_IDENTITY_PROVIDER : IDENTITY_PROVIDER;
}

/** Agent options for the current network. Local agents use the asset canister's root key. */
export function httpAgentOptions(identity) {
  const local = isLocalNetwork();
  const rootKey = local ? safeGetCanisterEnv()?.IC_ROOT_KEY : undefined;
  return {
    host: agentHost(),
    identity,
    rootKey,
    shouldFetchRootKey: local && !rootKey,
  };
}
