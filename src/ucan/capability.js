import * as API from "./api.js"
import * as Contraint from "./contraint.js"
import * as Result from "../result.js"

export * from "./api.js"
// /**
//  * @template {API.Capabilies} Caps
//  * @param {Caps} capabilites
//  * @returns {{[K in keyof Caps]:{[key in API.Subject<K>]:Caps[K] } & {cap:API.Op<K>}}[keyof Caps][]}
//  */
// export const encode = capabilites => {
//   // @ts-ignore
//   return iterate(capabilites).map(([id, constraint]) => {
//     const [op, subject] = unpack(id)
//     return {
//       [`${subject}`]: constraint,
//       cap: op,
//     }
//   })
// }

// /**
//  * @template {API.Capability} ID
//  * @param {API.Capabilies<ID>} parent
//  * @param {API.Capabilies<ID>} child
//  * @returns {Result.Result<API.EscalationError<API.Capabilies<ID>>, void>}
//  */
// export const check = (parent, child) => {
//   const violations = []
//   for (const [id, contraint] of iterate(child)) {
//     const result = Contraint.check(contraint, child[id])
//     if (!result.ok) {
//       violations.push(result.error)
//     }
//   }

//   return violations.length === 0
//     ? Contraint.holds
//     : Contraint.escalates(parent, child, violations)
// }

// /**
//  * @template {API.Capability} ID
//  * @param {API.Capabilies<ID>} capabilities
//  */
// export const iterate = capabilities =>
//   /** @type {Array<[ID, API.Constraint]>} */ (Object.entries(capabilities))

// /**
//  * @template {string} Op
//  * @template {string} Subject
//  * @param {API.Capability<Op, Subject>} capability
//  * @returns {[Op, Subject]}
//  */
// export const unpack = capability => {
//   const index = capability.indexOf(":")
//   const offset = index < 0 ? capability.length : index
//   return /** @type {[Op, Subject]} */ ([
//     capability.slice(0, offset),
//     capability.slice(offset + 1),
//   ])
// }

/**
 * @param {API.Capability[]} claims
 * @param {API.Capability[]} capabilities
 * @returns {Result.Result<API.EscalationError, void>}
 */
export const check = (claims, capabilities) => {
  /** @type {API.Violation[]} */
  const violations = []
  for (const claim of claims) {
    const check = checkCapability(claim, capabilities)
    if (!check.ok) {
      violations.push(...check.error.violations)
    }
  }

  return violations.length > 0
    ? Contraint.escalates(violations)
    : Result.ok(undefined)
}

/**
 * @template {string} OP
 * @template {string} ID
 * @param {API.Capability<OP, ID>} claim
 * @param {API.Capability[]} capabilities
 * @returns {Result.Result<API.EscalationError, void>}
 */
export const checkCapability = (claim, capabilities) => {
  /** @type {API.Violation[]} */
  const violations = []
  for (const capability of capabilities) {
    if (isComparable(claim, capability)) {
      const check = Contraint.check(claim, capability)
      if (check.ok) {
        return check
      } else {
        violations.push(...check.error.violations)
      }
    }
  }

  return violations.length > 0
    ? Contraint.escalates(violations)
    : Contraint.escalates([new InvalidClaim(claim)])
}

/**
 * @param {API.Capability} claim
 * @param {API.Capability} capability
 */
export const isComparable = (claim, capability) =>
  claim.cap === capability.cap &&
  Contraint.checkScope(claim.id, capability.id, {
    claim: capability,
    name: "id",
  }).ok

/**
 * @implements {API.InvalidClaim}
 */
class InvalidClaim extends RangeError {
  /**
   *
   * @param {API.Capability} claim
   */
  constructor(claim) {
    super()
    this.claim = claim
  }
  /**
   * @type {'InvalidClaim'}
   */
  get name() {
    return "InvalidClaim"
  }
  /**
   * @type {string}
   */
  get message() {
    return InvalidClaim.format(this)
  }
  /**
   *
   * @param {API.InvalidClaim} param0
   */
  static format({ claim }) {
    return `${Contraint.formatClaim(claim)} is unavailable`
  }
}
