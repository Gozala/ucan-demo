import { CID } from "multiformats/cid"

/**
 * Parse CID and return normalized b32 v1
 *
 * @param {string} cid
 */
export const parse = cid => {
  try {
    const c = CID.parse(cid)
    return c.toV1().toString()
  } catch (err) {
    throw new InvalidCidError(cid)
  }
}

export class InvalidCidError extends Error {
  /**
   * @param {string} cid
   */
  constructor(cid) {
    super(`Invalid CID: ${cid}`)
    this.name = "InvalidCid"
    this.status = 400
    this.code = InvalidCidError.CODE
  }
  static get CODE() {
    return "ERROR_INVALID_CID"
  }
}
