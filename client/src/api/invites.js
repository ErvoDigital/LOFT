import { api } from "./client.js";

// The link in an invite email. Reading it works signed out; accepting needs
// the invited account.
export const getInvite = (token) => api.get(`/invites/${token}`).then((r) => r.data.invite);
export const acceptInvite = (token) => api.post(`/invites/${token}/accept`).then((r) => r.data.workspace);
