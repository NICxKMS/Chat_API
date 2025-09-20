import "dotenv/config";
import { handler } from "./handler.js";

// Simple local runner for testing non-streaming endpoints
const event = {
  requestContext: { http: { method: "GET" } },
  rawPath: "/api/models/classified",
  headers: {},
};

handler(event, { responseStream: null }).then(r => {
  console.log(r.statusCode, r.body);
});


