import { OpenLibraryServer } from "../node_modules/mcp-open-library/build/index.js";

// Keep the process alive when stdin is a pipe with no immediate data.
setInterval(() => {}, 1 << 30);
process.stdin.resume();

const server = new OpenLibraryServer();
server.run().catch((error) => {
  console.error("Fatal error in OpenLibraryServer:", error);
  process.exit(1);
});
