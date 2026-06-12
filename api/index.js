module.exports = async function handleApiRequest(req, res) {
  const { default: app } = await import(
    "../artifacts/api-server/dist/vercel.mjs"
  );

  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  return app(req, res);
};
