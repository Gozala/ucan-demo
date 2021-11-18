import * as UCAN from "ucans"
import * as FS from "fs/promises"
import * as Capablitiy from "./ucan/capability.js"

export * from "ucans"

/**
 *
 * @param {UCAN.Ucan} ucan
 */
export const userDID = ucan => {
  let user = ucan.payload.aud
  for (const token of proofs(ucan)) {
    user = token.payload.aud
  }
  return user
}

/**
 * @param {UCAN.Ucan} ucan
 */
export const delegation = ucan => {
  /** @type {string[]} */
  const ids = []
  for (const { payload } of [ucan, ...proofs(ucan)]) {
    if (!ids.includes(payload.aud)) {
      ids.unshift(payload.aud)
    }
  }
  ids.unshift("")
  return ids.join("/")
}

/**
 * @param {UCAN.Ucan} ucan
 */
export const proofs = function* (ucan) {
  let cursor = ucan
  while (cursor.payload.prf) {
    cursor = UCAN.decode(cursor.payload.prf)
    yield cursor
  }
}

/**
 * @param {UCAN.Ucan} ucan
 */
export const iterate = function* (ucan) {
  yield { ucan, proof: UCAN.encode(ucan) }
  let cursor = ucan
  while (cursor.payload.prf) {
    const proof = cursor.payload.prf
    cursor = UCAN.decode(proof)
    yield { ucan: cursor, proof }
  }
}

/**
 * @param {Headers} headers
 */
export const parseHeader = headers => {
  try {
    const auth = headers.get("Authorization")
    const token = auth?.trimStart().slice("Bearer".length).trim()
    return token ? UCAN.decode(token) : null
  } catch (error) {
    return null
  }
}

/**
 *
 * @param {Capablitiy.Capability} capability
 * @param {UCAN.Ucan} token
 */
export const claim = (capability, token) =>
  Capablitiy.check([capability], token.payload.att)
