const server = Bun.serve({
  port: 5173,
  async fetch(request) {
    const url = new URL(request.url)
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    const file = Bun.file(`.${pathname}`)
    if (await file.exists()) return new Response(file)
    return new Response("Not found", { status: 404 })
  },
})

console.log(`http://localhost:${server.port}`)
