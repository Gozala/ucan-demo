import * as FS from "fs/promises"
import * as UCAN from "./ucan.js"
import * as Router from "./router.js"
import { Response } from "./http.js"

/**
 * @param {object} context
 * @param {Request} context.request
 * @param {Service} context.service
 */
export const info = ({ request, service }) => ({
  "X-DID": service.keypair.did(),
  "access-control-expose-headers": "X-DID",
})

/**
 * @typedef {UCAN.Keypair & UCAN.Didable} Keypair
 * @typedef {{keypair: Keypair}} Service
 *
 * @param {{keypairURL?: URL}} [options]
 */
export const service = async ({
  keypairURL = new URL("../service.key", import.meta.url),
} = {}) => ({
  keypair: await obtainKey(keypairURL),
})

/**
 * @param {URL} url
 */
const obtainKey = async url => (await importKey(url)) || (await createKey(url))

/**
 * @param {URL} url
 */
const importKey = async url => {
  const key = await FS.readFile(asPath(url)).catch(_ => null)

  return key ? UCAN.EdKeypair.fromSecretKey(key.toString()) : null
}

/**
 *@param {URL} url
 */
const createKey = async url => {
  const key = await UCAN.EdKeypair.create({ exportable: true })
  await FS.writeFile(asPath(url), await key.export())
  return key
}

/**
 *
 * @param {URL} url
 * @returns {string}
 */
const asPath = url =>
  // @ts-ignore - FS takes URLs just fine
  url
