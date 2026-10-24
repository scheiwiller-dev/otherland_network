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

/** Bound Cardinal calls so an unreachable replica cannot stall the client. */
export const CARDINAL_CALL_TIMEOUT_MS = 4000;
export const CARDINAL_UNREACHABLE = 'Cardinal is unreachable';

export function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
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
