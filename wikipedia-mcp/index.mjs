import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

/**
 * A simple Wikipedia MCP server that search for articles.
 */

import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
    { name: "wikipedia-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_wikipedia",
                description: "Search for a summary of a Wikipedia article",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The topic to search for" }
                    },
                    required: ["query"]
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

        if (name === "search_wikipedia") {
            const query = args.query;
            console.log(`Searching Wikipedia for: ${query}`);
            try {
                const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error("Article not found");
                const data = await response.json();
                return {
                    content: [{ type: "text", text: data.extract }]
                };
            } catch (err) {
                return {
                    content: [{ type: "text", text: `Error searching Wikipedia: ${err.message}` }]
                };
            }
        }

        throw new Error("Method not found");
    });

let transport = null;

const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/sse") {
        transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
    } else if (req.url === "/message") {
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
    }
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
    console.log(`Wikipedia MCP Server running at http://localhost:${PORT}/sse`);
});
