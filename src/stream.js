/**
 * @param {ReadableStream<Uint8Array>|NodeJS.ReadableStream} readable
 * @returns {AsyncIterable<Uint8Array>}
 */
export const asAsyncIterable = readable =>
  // @ts-ignore how to convince tsc that we are checking the type here?
  Symbol.asyncIterator in readable ? readable : streamIterator(readable)

/**
 *
 * @param {ReadableStream<Uint8Array>} readable
 * @param {{preventCancel?:boolean}} options
 * @returns
 */
export const streamIterator = async function* (readable, options = {}) {
  const reader = readable.getReader()

  try {
    while (true) {
      const result = await reader.read()

      if (result.done) {
        return
      }

      yield result.value
    }
  } finally {
    if (options.preventCancel !== true) {
      reader.cancel()
    }

    reader.releaseLock()
  }
}
