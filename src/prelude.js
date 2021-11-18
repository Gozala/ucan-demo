/**
 * @typedef {number|string|null|boolean|undefined} Scalar
 */

/**
 * @template {Scalar} T
 * @param {T} value
 */
export const the = value => value

/**
 * @template Other
 * @template {Scalar|Other} T
 * @param {T} value
 * @returns {(...args:any[]) => T}
 */
export const always = value => () => value
