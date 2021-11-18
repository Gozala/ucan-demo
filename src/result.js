/**
 * @template T
 * @param {T} value
 * @returns {{ok:true, value:T}}
 */
export const ok = value => ({ ok: true, value })

/**
 * @template X
 * @param {X} error
 * @returns {{ok:false, error:X}}
 */
export const error = error => ({ ok: false, error })

/**
 * @template X, T
 * @param {Result<X, T>} result
 * @returns {T}
 */
export const valueOf = result => {
  if (result.ok) {
    return result.value
  } else {
    throw result.error
  }
}

/**
 * @template X, T
 * @typedef {{ok:false, error:X}|{ok:true, value:T}} Result
 */
