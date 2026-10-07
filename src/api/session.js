let accountId = null;
let revision = 0;

export function setActiveAccount(id) {
  accountId = id;
  revision++;
}

export function accountRevision() { return revision; }

export function isActiveAccount(id, expectedRevision) {
  return accountId === id && revision === expectedRevision;
}
