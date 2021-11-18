import * as Result from "../result.js"
import * as API from "./api.js"

export * from "./api.js"

/**
 * @param {API.Capability} claim
 * @param {API.Capability} capability
 * @returns {Result.Result<API.EscalationError, void>}
 */
export const check = (claim, capability) => {
  /** @type {API.InvalidConstraint[]} */
  let violations = []
  for (const [name, claimed] of Object.entries(claim)) {
    const imposed = capability[name]
    const constraint = { name, claim }
    switch (typeof imposed) {
      // if parent had no such restrition contraints holds because child
      // is more restricted
      case "undefined":
        break
      // If child limit is greater than of parent it is escalating.
      case "number":
        const limit = checkLimit(claimed, imposed, constraint)
        violations = limit.ok ? violations : [...violations, limit.error]
        break
      case "string":
        const scope = checkScope(claimed, imposed, constraint)
        violations = scope.ok ? violations : [...violations, scope.error]
        break
    }
  }

  return violations.length === 0 ? holds : escalates(violations)
}

/**
 * @param {unknown} claimed
 * @param {unknown} imposed
 * @param {API.Constraint} constraint
 * @returns {Result.Result<API.InvalidConstraint, void>}
 */
export const checkScope = (claimed, imposed, constraint) =>
  claimed === undefined
    ? invalid("", imposed, constraint)
    : typeof claimed !== "string"
    ? incomparable(claimed, imposed, constraint)
    : claimed === imposed || claimed.startsWith(toScope(imposed))
    ? holds
    : invalid(claimed, imposed, constraint)

/**
 * @param {unknown} input
 */
/**
 * @param {unknown} id
 * @returns {string}
 */
export const toScope = id => {
  const path = id == null ? "" : String(id)
  return path[path.length - 1] === "/" ? path : `${path}/`
}

/**
 * @param {unknown} claimed
 * @param {API.Limit} imposed
 * @param {API.Constraint} constraint
 * @returns {Result.Result<API.InvalidConstraint, void>}
 */
export const checkLimit = (claimed, imposed, constraint) =>
  claimed === undefined
    ? invalid(Infinity, imposed, constraint)
    : typeof claimed !== "number"
    ? incomparable(claimed, imposed, constraint)
    : claimed > imposed
    ? invalid(claimed, imposed, constraint)
    : holds

export const holds = Result.ok(undefined)

/**
 * @param {unknown} claimed
 * @param {unknown} imposed
 * @param {object} context
 * @param {string} context.name
 * @param {API.Capability} context.claim
 */
export const incomparable = (claimed, imposed, context) =>
  Result.error(new IncomparableConstraint(claimed, imposed, context))

/**
 * @param {unknown} claimed
 * @param {unknown} imposed
 * @param {API.Constraint} constraint
 */
export const invalid = (claimed, imposed, constraint) =>
  Result.error(new InvalidConstraint(claimed, imposed, constraint))

/**
 * @param {API.Violation[]} violations
 * @returns {Result.Result<API.EscalationError, never>}
 */
export const escalates = violations =>
  Result.error(new EscalationError(violations))

/**
 * @implements {API.ConstraintViolation}
 */

/**
 * @param {API.Constraint} constraint
 */
export const formatConstraint = ({ claim, name }) =>
  `${formatClaim(claim)} with constraint ${name}`

/**
 * @param {API.Capability} claim
 */
export const formatClaim = ({ cap, id }) => `Claimed capability "${cap} ${id}"`

/**
 * @implements {API.EscalationError}
 */
class EscalationError extends RangeError {
  /**
   * @param {API.Violation[]} violations
   */
  constructor(violations) {
    super()
    this.violations = violations
  }
  /**
   * @param {API.EscalationError} error
   */
  static format({ violations }) {
    const problems = violations.map(violation => violation.message)

    return `Claimed capabilities are not met:${["", ...problems].join(
      `\n  - `
    )}`
  }
  /**
   * @type {string}
   */
  get message() {
    return EscalationError.format(this)
  }
  /**
   * @returns {'EscalationError'}
   */
  get name() {
    return "EscalationError"
  }
}

/**
 * @implements {API.InvalidConstraint}
 */
class InvalidConstraint extends RangeError {
  /**
   * @param {unknown} claimed - Claimed constraint
   * @param {unknown} imposed - Imposed constraint
   * @param {API.Constraint} constraint
   */
  constructor(claimed, imposed, constraint) {
    super()
    this.constraint = constraint
    this.claimed = claimed
    this.imposed = imposed
  }
  /** @type {'InvalidConstraint'} */
  get name() {
    return "InvalidConstraint"
  }
  /**
   * @param {API.InvalidConstraint} self
   * @return {string}
   */
  static format({ constraint, claimed, imposed }) {
    return `${formatConstraint(
      constraint
    )}=${claimed} violates imposed ${imposed} restriction`
  }
  /**
   * @returns {string}
   */
  get message() {
    return InvalidConstraint.format(this)
  }
}

/**
 * @implements {API.InvalidConstraint}
 */
class IncomparableConstraint extends InvalidConstraint {
  /**
   * @param {API.InvalidConstraint} self
   * @returns {string}
   */
  static format({ constraint, claimed, imposed }) {
    return `${formatConstraint(
      constraint
    )}=${claimed} constraint that is not comparable to imposed ${imposed} restriction`
  }
  /** @type {string} */
  get message() {
    return IncomparableConstraint.format(this)
  }
}
