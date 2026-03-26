import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new Server(
    { name: "mock-weather-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(async (request) => {
    if (request.method === "listTools") {
        return {
            tools: [
                {
                    name: "get-forecast",
                    description: "Get a weather forecast for a location",
                    inputSchema: {
                        type: "object",
                        properties: {
                            location: { type: "string" }
                        },
                        required: ["location"]
                    }
                },
                {
                    name: "get-alerts",
                    description: "Get active weather alerts for a location",
                    inputSchema: {
                        type: "object",
                        properties: {
                            location: { type: "string" }
                        },
                        required: ["location"]
                    }
                }
            ]
        };
    }

    if (request.method === "callTool") {
        const { name, arguments: args } = request.params;
        const location = args.location || "unknown";

        if (name === "get-forecast") {
            return {
                content: [{ type: "text", text: `The forecast for ${location} is 72°F and Sunny.` }]
            };
        }
        if (name === "get-alerts") {
            return {
                content: [{ type: "text", text: `No active alerts for ${location}.` }]
            };
        }
    }

    throw new Error("Method not found");
});

let transport = null;

const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/sse") {
        console.log("New SSE connection...");
        transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
    } else if (req.url === "/message") {
        console.log("Incoming message...");
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
    }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Mock Weather MCP Server running at http://localhost:${PORT}/sse`);
});
