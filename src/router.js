import { Response } from "./http.js"

/**
 * @typedef {Object} RequestContext
 * @property {URL} url
 * @property {Request} request
 */

/**
 * @template R
 * @typedef {Response & {json():Promise<R>}} JSONResponse
 */

/**
 * @template {Object} R
 * @param {Record<string, (request:RequestContext) => Promise<R>>} handlers
 * @returns {(request:Request) => Promise<JSONResponse<R>>}
 */
export const router = handlers => async request => {
  const headers = {
    ...cors(request.url),
    "Content-Type": "application/json",
  }
  try {
    const url = new URL(request.url)
    const handler = handlers[url.pathname]
    const promise = handler
      ? handler({ url, request })
      : Promise.reject(
          Object.assign(new Error(`Unknown request path ${url.pathname}`), {
            status: 404,
          })
        )
    const value = await promise

    return new Response(
      JSON.stringify(
        {
          ok: true,
          value,
        },
        null,
        2
      ),
      {
        headers,
        status: 200,
      }
    )
  } catch (error) {
    const {
      name,
      message,
      stack,
      code,
      status = 500,
    } = /** @type {Error & { code?: number, status?: number }} */ (error)
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: {
            name,
            code,
            message,
            stack,
          },
        },
        null,
        2
      ),
      {
        status,
        headers,
      }
    )
  }
}

/**
 *
 * @param {string} [origin]
 */

const cors = (origin = "*") => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, PUT, GET, HEAD, OPTIONS",
})
