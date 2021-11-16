import * as FS from "fs/promises"
import { Response } from "./http.js"
import mime from "mime"
import { cors } from "./router.js"

/**
 * @param {object} context
 * @param {{path:string}} context.params
 * @param {Request} context.request
 */
export const read = async ({ params: { path }, request }) => {
  const url = new URL(`./client/${path}`, import.meta.url)

  // @ts-ignore - node accepts file urls
  const content = await FS.readFile(url)
  console.log("<<", {
    ...cors(request),
    "Content-Type": mime.getType(path) || "application/octet-stream",
  })
  return new Response(content, {
    headers: {
      ...cors(request),
      "Content-Type": mime.getType(path) || "application/octet-stream",
    },
  })
}
