import * as CAR from "./car/car.js"
import { CarBlockIterator } from "@ipld/car"
import { MemoryBlockStore } from "ipfs-car/blockstore/memory"
import * as raw from "multiformats/codecs/raw"
import * as cbor from "@ipld/dag-cbor"
import * as pb from "./car/dag-pb.js"
import { Block } from "multiformats/block"
import { asAsyncIterable } from "./stream.js"

export const MAX_BLOCK_SIZE = 1 << 20 // 1MiB

/**
 *
 * @typedef {Object} Service
 * @property {import('ipfs-car/blockstore').Blockstore} store
 */

/**
 *
 * @param {Object} context
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const upload = async ({ request, service }) => {
  const content = await request.blob()

  const chunks = asAsyncIterable(content.stream())
  const carIterator = await CarBlockIterator.fromIterable(chunks)
  const [cid] = await carIterator.getRoots()
  const tasks = []
  for await (const block of carIterator) {
    tasks.push(service.store.put(block.cid, block.bytes))
  }
  await Promise.all(tasks)

  return { cid }
}

/**
 * @param {Object} context
 * @param {object} context.params
 * @param {string} context.params.cid
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const retrieve = async ({ params, request, service }) => {}

/**
 *
 * @param {Blob} carBlob
 */
const stat = async carBlob => {
  const carBytes = new Uint8Array(await carBlob.arrayBuffer())
  const blocksIterator = await CarBlockIterator.fromBytes(carBytes)
  const roots = await blocksIterator.getRoots()
  if (roots.length === 0) {
    throw new Error("missing roots")
  }
  if (roots.length > 1) {
    throw new Error("too many roots")
  }
  const rootCid = roots[0]
  let rawRootBlock
  let blocks = 0
  let size = 0
  for await (const block of blocksIterator) {
    const blockSize = block.bytes.byteLength
    if (blockSize > MAX_BLOCK_SIZE) {
      throw new Error(`block too big: ${blockSize} > ${MAX_BLOCK_SIZE}`)
    }
    if (!rawRootBlock && block.cid.equals(rootCid)) {
      rawRootBlock = block
    }
    size += blockSize
    blocks++
  }
  if (blocks === 0) {
    throw new Error("empty CAR")
  }
  if (!rawRootBlock) {
    throw new Error("missing root block")
  }
  const decoder = decoders.find(d => d.code === rootCid.code)
  if (decoder) {
    const rootBlock = new Block({
      cid: rootCid,
      bytes: rawRootBlock.bytes,
      value: decoder.decode(rawRootBlock.bytes),
    })
    const links = Array.from(rootBlock.links())
    // if the root block has links, then we should have at least 2 blocks in the CAR
    if (blocks === 1 && links.length > 0) {
      throw new Error("CAR must contain at least one non-root block")
    }
    // get the size of the full dag for this root, even if we only have a partial CAR.
    if (rootBlock.cid.code === pb.code) {
      size = pb.cumulativeSize(rootBlock.bytes, rootBlock.value)
    }
  }
  return { size, blocks, rootCid }
}

const decoders = [pb, raw, cbor]

/**
 * @returns {Promise<Service>}
 */
export const memoryService = async () => ({
  store: new MemoryBlockStore(),
})
