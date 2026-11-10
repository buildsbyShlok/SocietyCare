// Shared by the directory handlers and action tests. Backend authorization remains authoritative.
export async function performResidentAction({ account, currentUser, role, token, api, confirm }) {
  if(currentUser.role !== "ADMIN" || account.id === currentUser.id)
    throw new Error("You cannot perform this account action.");
  if(role && account.disabled) throw new Error("This account is deactivated.");
  const identity = account.name + " (" + account.email + ")";
  const message = role
    ? "Change " + identity + " to " + role + "? Permissions change immediately."
    : "Permanently delete " + identity + "? This removes their login and profile and revokes all sessions. Financial records, complaints, audit history and published community content are retained without the account link. This cannot be undone.";
  if(!confirm(message)) return null;
  const result = role
    ? await api.updateRole(account.id,role,token)
    : await api.delete(account.id,token);
  return {id:account.id,role,message:result.message};
}
