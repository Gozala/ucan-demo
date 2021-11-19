import { Response } from "./http.js"

/**
 * @param {Request} request
 */

export const cors = request => {
  const { headers } = request
  return {
    "Access-Control-Allow-Origin": headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "HEAD, GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      headers.get("Access-Control-Request-Headers") || "",
    "Access-Control-Expose-Headers": "Link",
  }
}

/**
 * @template Params
 * @template Service
 * @template {Record<string, string>} Return
 * @param {(context:{request:Request, service:Service, params:Params}) => Promise<Return> | Return} handler
 */

export const head = handler =>
  route(async context => {
    return new Response("", {
      headers: {
        ...cors(context.request),
        ...(await handler(context)),
      },
    })
  })

/**
 * @template Params
 * @template Service
 * @template Return
 * @param {(context:{request:Request, service:Service, params:Params}) => Promise<Return> | Return} handler
 */
export const json = handler =>
  route(async context => {
    const value = await handler(context)
    return JSONResponse.from(value, {
      headers: cors(context.request),
    })
  })

/**
 * @template Params
 * @template Service
 * @param {(context:{request:Request, service:Service, params:Params}) => Promise<Response> | Response} handler
 */
export const route =
  handler =>
  /**
   * @param {Params} params
   */

  params =>
  /**
   *
   * @param {{service:Service, request:Request}} context
   * @returns {Promise<Response>}
   */
  async context => {
    const headers = {
      ...cors(context.request),
      "Content-Type": "application/json",
    }
    try {
      return await handler({ ...context, params })
    } catch (error) {
      return ResponseError.from(
        /** @type {Error & { code?: number, status?: number }} */ (error),
        { headers: cors(context.request) }
      )
    }
  }

export class JSONResponse extends Response {
  /**
   * @template T
   * @param {T} data
   * @param {object} [options]
   * @param {Record<string, string>} [options.headers]
   * @param {number} [options.status]
   */
  static from(data, { headers = {}, status = 200 } = {}) {
    return new this(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    })
  }
}

export class ResponseError extends Response {
  /**
   * @param {Error & { code?: number, status?: number }} error
   * @param {{headers?:Record<string, string>}} [options]
   */
  static from(
    { name, message, stack, code, status = 500 },
    { headers = {} } = {}
  ) {
    return new this(
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
        headers,
        status,
      }
    )
  }
}
