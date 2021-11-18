import * as UCAN from "ucans"
import * as assert from "uvu/assert"

describe("ucans", async () => {
  const group = await UCAN.EdKeypair.create()
  const groupUcan = await UCAN.build({
    audience: "did:web3.storage", //recipient DID
    issuer: group, //signing key
    capabilities: [
      // permissions for ucan
      {
        wnfs: "boris.fission.name/public/photos/",
        cap: "OVERWRITE",
      },
      {
        wnfs: "boris.fission.name/private/4tZA6S61BSXygmJGGW885odfQwpnR2UgmCaS5CfCuWtEKQdtkRnvKVdZ4q6wBXYTjhewomJWPL2ui3hJqaSodFnKyWiPZWLwzp1h7wLtaVBQqSW4ZFgyYaJScVkBs32BThn6BZBJTmayeoA9hm8XrhTX4CGX5CVCwqvEUvHTSzAwdaR",
        cap: "APPEND",
      },
      {
        email: "boris@fission.codes",
        cap: "SEND",
      },
    ],
  })
  it("ucan is valid & has not expired", async () => {
    assert.equal(UCAN.isExpired(groupUcan), false, "not expired")
    assert.equal(await UCAN.isValid(groupUcan), true, "is valid")
  })

  it("derived ucan is valid & has not expired", async () => {
    const userUcan = await UCAN.build({
      // audience: "did:web3.storage", //recipient DID
      // audience: "did:key:z6MkgYGF3thn8k1Fv4p4dWXKtsXCnLH7q9yw4QgNPULDmDKB",
      audience: await group.did(),
      issuer: group, //signing key
      capabilities: [
        // permissions for ucan
        {
          wnfs: "boris.fission.name/public/photos/",
          cap: "OVERWRITE",
        },
      ],
      proof: UCAN.encode(groupUcan),
    })

    assert.equal(await UCAN.isValid(userUcan), true)
  })
})
