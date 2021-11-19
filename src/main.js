import * as HTTP from "./http.js"
import * as router from "./router.js"
import { script } from "subprogram"
import {
  GET,
  POST,
  OPTIONS,
  text,
  handle as match,
  route,
  rest,
} from "subroute"
import * as CAR from "./car.js"
import * as Auth from "./auth.js"
import * as Resource from "./resource.js"
import * as Service from "./service.js"

export const main = async () => {
  const socket = await HTTP.listen({ port: Number(process.env.PORT || 8080) })
  const io = await service()

  console.log(`Serving ${HTTP.endpoint(socket)}`)
  for await (const event of HTTP.open(socket)) {
    console.log(`>> ${event.request.method} ${event.request.url}`)
    const route = match(routes, event.request)

    event.respondWith(route({ ...event, service: io }))
  }
}

/**
 * @typedef {CAR.Service & Auth.Service} Service
 * @returns {Promise<Service>}
 */

const service = async () => {
  const service = await Service.service()
  const auth = await Auth.service(service)
  const car = await CAR.service(auth)
  return car
}

const base = GET`/`(
  router.route(
    () =>
      new HTTP.Response("<html><body>Hello</body></html>", {
        headers: { "Content-Type": "text/html" },
      })
  )
)
const echo = GET`/echo/${{ text }}`(
  router.json(({ params: { text }, request }) => {
    return {
      ok: true,
      value: text,
      method: request.method,
    }
  })
)

const authorize = POST`/auth/${{ did: text }}`(router.json(Auth.authorize))
const revoke = POST`/revoke/${{ cid: text }}`(router.json(Auth.revoke))
const upload = POST`/uploads/${{ path: rest() }}`(router.json(CAR.upload))
// const retrieve = GET`/car/${{ cid: text }}`(router.json(CAR.retrieve))
const list = GET`/uploads/${{ path: rest() }}`(router.json(CAR.listUploads))

const resource = GET`/resource/${{ path: rest() }}`(router.route(Resource.read))
const cors = OPTIONS`${{ path: rest() }}`(router.head(Service.info))

const notFound = route`/${{ path: rest() }}`(
  router.route(({ params: { path }, request }) => {
    return router.JSONResponse.from(
      {
        ok: false,
        error: {
          name: "NotFound",
          message: `Route for ${path} not found`,
        },
        path: path,
        method: request.method,
      },
      {
        status: 404,
      }
    )
  })
)

const routes = base
  .or(cors)
  .or(echo)
  .or(authorize)
  .or(revoke)
  .or(upload)
  .or(list)
  // .or(retrieve)
  .or(resource)
  .or(notFound)

script({ ...import.meta, main, dotenv: true })
