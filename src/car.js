import * as CAR from "./car/car.js"
import { CarBlockIterator } from "@ipld/car"
import { MemoryBlockStore } from "ipfs-car/blockstore/memory"
import * as raw from "multiformats/codecs/raw"
import * as cbor from "@ipld/dag-cbor"
import * as pb from "./car/dag-pb.js"
import { Block } from "multiformats/block"
import { asAsyncIterable } from "./stream.js"
import * as UCAN from "./ucan.js"
import * as Auth from "./auth.js"
import * as Result from "./result.js"
export const MAX_BLOCK_SIZE = 1 << 20 // 1MiB

/**
 *
 * @param {Object} context
 * @param {{path:string}} context.params
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const upload = async ({ params: { path }, request, service }) => {
  console.log(`>> ${request.method} ${request.url} - parse UCAN`)
  const ucan = await Auth.authenticate(request.headers, service)
  const content = await request.blob()

  // claim upload capability, if fails expception is thrown.
  Result.valueOf(
    UCAN.claim(
      {
        cap: "POST",
        id: `/uploads/${path}`,
        storageLimit: content.size,
      },
      ucan
    )
  )

  const chunks = asAsyncIterable(content.stream())
  const carIterator = await CarBlockIterator.fromIterable(chunks)
  const [cid] = await carIterator.getRoots()
  const tasks = []
  console.log(`>> ${request.method} ${request.url} - Iterate blocks`)
  for await (const block of carIterator) {
    tasks.push(service.blockStore.put(block.cid, block.bytes))

    console.log(`Link -> /${path}${block.cid}`)
    service.links.set(`/${path}${block.cid}`, {
      cid: block.cid.toString(),
      size: block.bytes.byteLength,
      created: Date.now(),
    })
  }
  await Promise.all(tasks)
  return { ok: true, value: { cid: cid.toString() } }
}

/**
 * @param {Object} context
 * @param {{path:string}} context.params
 * @param {Request} context.request
 * @param {import('./main.js').Service} context.service
 */
export const listUploads = async ({ params: { path }, request, service }) => {
  console.log(`>> ${request.method} ${request.url} - parse UCAN`)
  const ucan = await Auth.authenticate(request.headers, service)
  const claim = UCAN.claim(
    {
      cap: "LIST",
      id: `/uploads/${path}`,
    },
    ucan
  )
  Result.valueOf(claim)

  const uploads = []
  const scope = `/${path}`

  for (const [path, stat] of service.links.entries()) {
    if (path.startsWith(scope)) {
      uploads.push({
        path: path.slice(scope.length),
        ...stat,
      })
    }
  }

  return { ok: true, value: uploads }
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
 * @typedef {ServiceExt & Auth.Service} Service
 * @typedef {Object} ServiceExt
 * @property {import('ipfs-car/blockstore').Blockstore} blockStore
 * @property {Map<string, { size: number, created: number, cid: string }>} links
 *
 * @returns {Promise<Service>}
 */
export const service = async () => ({
  blockStore: new MemoryBlockStore(),
  links: new Map(),
  ...(await Auth.service()),
})
