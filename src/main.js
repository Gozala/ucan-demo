import * as HTTP from "./http.js"
import { router } from "./router.js"
import { script } from "subprogram"
export const main = async () => {
  const socket = await HTTP.listen({ port: Number(process.env.PORT || 8080) })
  console.log(`Serving ${HTTP.endpoint(socket)}`)
  for await (const event of HTTP.open(socket)) {
    event.respondWith(service(event.request))
  }
}

const service = router({
  "/echo": async ({ url, request }) => {
    return {
      echo: await request.text(),
    }
  },
})

script({ ...import.meta, main, dotenv: true })
