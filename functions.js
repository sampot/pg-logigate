/** Optional Playgrounds Infrastructure stub. */
export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-logigate",
      path: new URL(request.url).pathname,
    });
  },
};
