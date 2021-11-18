export interface Capability<
  OP extends Uppercase<string> = string,
  ID extends string = string
> extends Constraints {
  cap: OP
  id?: ID
}

export interface Constraints {
  [key: string]: number | string | undefined
}
export type Limit = number
export type Scope = string

export interface EscalationError extends RangeError {
  readonly name: "EscalationError"

  readonly violations: Violation[]
}

export type Violation = InvalidConstraint | InvalidClaim

export interface InvalidConstraint extends RangeError {
  readonly name: "InvalidConstraint"

  readonly constraint: Constraint

  readonly claimed: unknown
  readonly imposed: unknown
}

export interface InvalidClaim extends RangeError {
  readonly name: "InvalidClaim"
  readonly claim: Capability
}
export interface Constraint {
  readonly claim: Capability
  readonly name: string
}
