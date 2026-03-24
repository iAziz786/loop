self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', e.data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  self.postMessage(hex)
}
