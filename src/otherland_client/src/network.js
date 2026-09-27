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
