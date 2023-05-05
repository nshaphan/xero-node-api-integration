import * as http from "http"
import app from "./app"
import * as dotenv from "dotenv";

dotenv.config();

const server = http.createServer(app);
const port = process.env.PORT || 8000

require("source-map-support").install();

server.listen(port, async () => {
  // eslint-disable-next-line no-console
  console.log(`Server started on PORT ${port}`);
});
