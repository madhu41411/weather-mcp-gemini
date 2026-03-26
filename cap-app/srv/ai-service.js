import cds from '@sap/cds';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default class AIAssistService extends cds.ApplicationService {
    async init() {
        const apiKey = process.env.GEMINI_API_KEY;
        const mcpUrl = process.env.MCP_SERVER_URL || "http://localhost:8080/sse";

        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing");
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        this.on('askAI', async (req) => {
            const { topic } = req.data;
            console.log(`AI query for topic: ${topic}`);

            console.log(`Connecting to MCP server at URL: ${mcpUrl}`);
            const transport = new SSEClientTransport(new URL(mcpUrl));
            const client = new Client(
                { name: "cap-ai-client", version: "1.0.0" },
                { capabilities: {} }
            );

            try {
                await client.connect(transport);
                const { tools: mcpTools } = await client.listTools();

                const geminiTools = mcpTools.map(t => ({
                    name: t.name.replace(/-/g, "_"),
                    description: t.description,
                    parameters: {
                        type: "OBJECT",
                        properties: Object.fromEntries(
                            Object.entries(t.inputSchema.properties || {}).map(([k, v]) => [
                                k, { type: v.type.toUpperCase(), description: v.description }
                            ])
                        ),
                        required: t.inputSchema.required || []
                    }
                }));

                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    tools: [{ functionDeclarations: geminiTools }]
                });

                const chat = model.startChat();
                let result = await chat.sendMessage(`Please search for information about "${topic}" and summarize it.`);
                let response = result.response;

                // Handle tool calls
                while (response.candidates[0].content.parts.some(p => p.functionCall)) {
                    const toolCalls = response.candidates[0].content.parts.filter(p => p.functionCall).map(p => p.functionCall);
                    const toolResults = [];

                    for (const call of toolCalls) {
                        const originalToolName = mcpTools.find(t => t.name.replace(/-/g, "_") === call.name)?.name || call.name;
                        const toolResult = await client.callTool({ name: originalToolName, arguments: call.args });
                        toolResults.push({ functionResponse: { name: call.name, response: toolResult } });
                    }

                    result = await chat.sendMessage(toolResults);
                    response = result.response;
                }

                return response.text();

            } catch (err) {
                console.error(err);
                return `Error: ${err.message}`;
            } finally {
                await transport.close();
            }
        });

        await super.init();
    }
}
