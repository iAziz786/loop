import ChecksumWorker from './checksum.worker?worker'

export function computeChecksum(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new ChecksumWorker()
    worker.onmessage = (e: MessageEvent<string>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (e) => {
      reject(new Error(`Checksum worker error: ${e.message}`))
      worker.terminate()
    }
    file.arrayBuffer().then(
      (buffer) => worker.postMessage(buffer, [buffer]),
      (err) => {
        reject(err)
        worker.terminate()
      },
    )
  })
}
