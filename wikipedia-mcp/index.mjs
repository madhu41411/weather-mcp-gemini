import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

/**
 * A simple Wikipedia MCP server that search for articles.
 */

import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

function createServer() {
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

    return server;
}

const activeConnections = new Map();

const httpServer = http.createServer(async (req, res) => {
    console.log(`Received ${req.method} request to ${req.url}`);
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        const server = createServer();
        await server.connect(transport);
        
        // Track the transport by sessionId for the POST messages
        const sessionId = transport.sessionId;
        activeConnections.set(sessionId, transport);
        
        req.on("close", () => {
            activeConnections.delete(sessionId);
        });

    } else if (url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId");
        const transport = activeConnections.get(sessionId);
        if (transport) {
            await transport.handlePostMessage(req, res);
        } else {
            res.statusCode = 404;
            res.end("Session not found");
        }
    } else {
        res.statusCode = 404;
        res.end("Not Found");
    }
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
    console.log(`Wikipedia MCP Server running at http://localhost:${PORT}/sse`);
});
