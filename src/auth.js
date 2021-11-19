import * as UCAN from "./ucan.js"
import * as Result from "./result.js"
import * as raw from "multiformats/codecs/raw"
import { sha256 } from "multiformats/hashes/sha2"
import { CID } from "multiformats/cid"
import * as uint8arrays from "uint8arrays"
import * as Capability from "./ucan/capability.js"
import { the } from "./prelude.js"

/**
 * @param {string} did
 * @returns {import('./ucan/api').Capability[]}
 */
const defaultCapabilities = did => [
  {
    cap: "POST",
    id: `/uploads/${did}/`,
    storageLimit: 32 * 1.1e12, // 1TiB,
  },
  {
    // can only list uploads for the given user
    cap: "LIST",
    id: `/uploads/${did}/`,
  },
]

/**
 * @param {Headers} headers
 * @param {Service} service
 */
export const authenticate = async (headers, service) => {
  const token = UCAN.parseHeader(headers)
  const result =
    token == null
      ? fail("Authorization header is required")
      : token.payload.aud !== service.keypair.did()
      ? fail(
          `Authorization is invalid, it is addressed for ${
            token.payload.aud
          } instead of ${service.keypair.did()}`
        )
      : UCAN.isExpired(token)
      ? fail("Authorization token has expired")
      : await validate(token, service)

  if (result.ok) {
    return result.value
  } else {
    throw result.error
  }
}

/**
 * @param {UCAN.Ucan} token
 * @param {Service} service
 * @returns {Promise<Result.Result<Error, UCAN.Ucan>>}
 */
const validate = async (token, service) => {
  const result = await audit(token, service)
  if (!result.ok) {
    return result
  }
  const root = result.value
  const valid = await check(token)
  if (!valid.ok) {
    return valid
  }

  // If token was issued by the service it's all good
  if (root.token.payload.iss === service.keypair.did()) {
    return Result.ok(token)
  }
  // If issuer is blocked all the issued tokens are implicitly revoked
  else if (await isBlocked(root.token.payload.iss, service)) {
    return fail("Token or one of the proofs in chain had been revoked")
  }
  // If root issuer issued compatible token we still authorize
  // it but place an issuer into a special sandbox so we can revoke
  // all the issued tokens unless user verifies identity.
  else if (isCompatible(root.token)) {
    service.sandbox.add(root.token.payload.iss)
    return Result.ok(token)
  } else {
    return fail("Token is not valid")
  }
}

/**
 *
 * @param {UCAN.Ucan} token
 */
const isCompatible = token =>
  Capability.check(token.payload.att, defaultCapabilities(token.payload.aud)).ok

/**
 * @param {string} issuer
 * @param {Service} service
 */
const isBlocked = async (issuer, service) => service.blockedIssuers.has(issuer)

/**
 * @param {string} proof
 */
const identify = async proof => {
  // Encode ucan into
  const bytes = new TextEncoder().encode(proof)
  const block = raw.encode(bytes)
  return CID.createV1(raw.code, await sha256.digest(block))
}

/**
 * Audits token enusring
 *
 * @param {UCAN.Ucan} token
 * @param {Service} service
 */
const audit = async (token, service) => {
  let cursor = { token, cid: "" }
  for (const { ucan, proof } of UCAN.iterate(token)) {
    const cid = String(await identify(proof))
    if (service.revoked.has(cid)) {
      return fail(`Token with CID ${cid} in proof chain has been revoked`)
    }
    cursor = { token: ucan, cid }
  }

  // If all proofs in the chain are unverified and had not been issued
  // by our service we do capability check to decide whether to grant
  // self issued token
  return Result.ok(cursor)
}

/**
 * Check if a UCAN is valid.
 *
 * @param {UCAN.Ucan} ucan - The decoded UCAN
 * @returns {Promise<Result.Result<Error, void>>}
 */
const check = async ucan => {
  if (ucan.signature == null) {
    return fail(`Token has no signature`)
  }

  const encodedHeader = UCAN.encodeHeader(ucan.header)
  const encodedPayload = UCAN.encodePayload(ucan.payload)
  const data = uint8arrays.fromString(`${encodedHeader}.${encodedPayload}`)
  const sig = uint8arrays.fromString(ucan.signature, "base64urlpad")

  const valid = await UCAN.verifySignature(data, sig, ucan.payload.iss)
  if (!valid) {
    return fail(`Token signature is invalid`)
  }

  if (ucan.payload.prf == null) {
    return Result.ok(undefined)
  }

  // Verify proofs
  const proof = UCAN.decode(ucan.payload.prf)
  if (ucan.payload.iss !== proof.payload.aud) {
    return fail(
      `Token issuer ${ucan.payload.iss} does not match it's proofs audience ${proof.payload.aud}`
    )
  }

  // Check capabilities
  const result = Capability.check(ucan.payload.att, proof.payload.att)
  return result.ok ? await check(proof) : result
}

/**
 * @param {string} message
 */
const fail = message => Result.error(new Unauthorized(message))
class Unauthorized extends Error {
  get status() {
    return 401
  }
}

/**
 * @param {object} context
 * @param {{did:string}} context.params
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const authorize = async ({ params: { did }, request, service }) => {
  const token = service.users.get(did)
  if (token) {
    return { ok: true, value: token }
  } else {
    const token = await UCAN.build({
      audience: did,
      issuer: service.keypair,
      lifetimeInSeconds: 24 * 60 * 60, // a day
      // @ts-ignore - ucans don't like non string values
      // @see https://github.com/ucan-wg/ucan/issues/16
      capabilities: defaultCapabilities(did),
    })

    const value = UCAN.encode(token)
    service.users.set(did, value)
    return { ok: true, value }
  }
}

/**
 * @param {object} context
 * @param {{cid:string}} context.params
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const revoke = async ({ params: { cid }, request, service }) => {
  service.revoked.add(cid)
  return { ok: true, value: cid }
}

/**
 * @typedef {object} Service
 * @property {UCAN.EdKeypair} keypair
 * @property {Map<string, string>} users
 * Should be something like bloom filter instead
 * @property {Set<string>} revoked
 * @property {Set<string>} blockedIssuers
 * @property {Set<string>} sandbox
 *
 * @param {{ keypair: UCAN.EdKeypair }} options
 * @returns {Promise<Service>}
 */
export const service = async ({ keypair }) => ({
  users: new Map(),
  revoked: new Set(),
  sandbox: new Set(),
  blockedIssuers: new Set(),
  keypair,
})
