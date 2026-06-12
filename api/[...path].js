function getCatchAllPath(req) {
  const path = req.query?.path;

  if (Array.isArray(path)) {
    return path.join("/");
  }

  return typeof path === "string" ? path : "";
}

function normalizeApiUrl(req) {
  const url = req.url || "/";
  const catchAllPath = getCatchAllPath(req);

  if (
    catchAllPath &&
    (url === "/" || url.startsWith("/?") || url.includes("[...path]"))
  ) {
    const [, search = ""] = url.split("?", 2);
    const searchParams = new URLSearchParams(search);
    searchParams.delete("path");

    const query = searchParams.toString();
    req.url = `/api/${catchAllPath.replace(/^\/+/, "")}${
      query ? `?${query}` : ""
    }`;
    return;
  }

  if (url === "/api" || url.startsWith("/api/") || url.startsWith("/api?")) {
    return;
  }

  req.url = `/api${url.startsWith("/") ? "" : "/"}${url}`;
}

module.exports = async function handleApiRequest(req, res) {
  const { default: app } = await import(
    "../artifacts/api-server/dist/vercel.mjs"
  );

  normalizeApiUrl(req);

  return app(req, res);
};
