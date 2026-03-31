import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to fetch content from a URL (bypassing CORS)
  app.post("/api/fetch-url", async (req, res) => {
    const { url } = req.body;
    console.log(`[Proxy] Fetching URL: ${url}`);
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Proxy] Fetch failed: ${response.statusText}`);
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      console.log(`[Proxy] Content-Type: ${contentType}`);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      
      console.log(`[Proxy] Successfully fetched and encoded ${buffer.byteLength} bytes`);
      res.json({ 
        base64: `data:${contentType};base64,${base64}`,
        contentType 
      });
    } catch (error: any) {
      console.error("[Proxy] Error fetching URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
