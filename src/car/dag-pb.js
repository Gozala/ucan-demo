export * from "@ipld/dag-pb"

/**
 * The sum of the node size and size of each link
 * @param {Uint8Array} pbNodeBytes
 * @param {import('@ipld/dag-pb/src/interface').PBNode} pbNode
 * @returns {number} the size of the DAG in bytes
 */
export const cumulativeSize = (pbNodeBytes, pbNode) => {
  // NOTE: Tsize is optional, but all ipfs implementations we know of set it.
  // It's metadata, that could be missing or deliberately set to an incorrect value.
  // This logic is the same as used by go/js-ipfs to display the cumulative size of a dag-pb dag.
  return (
    pbNodeBytes.byteLength +
    pbNode.Links.reduce((acc, curr) => acc + (curr.Tsize || 0), 0)
  )
}
