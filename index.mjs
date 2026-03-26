import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configure Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// MCP Weather Server Details
const MCP_SERVER_URL = "https://mcp-weather.imprvhub.workers.dev/sse";

/**
 * Converts MCP tool schema to Gemini function declaration format
 */
function convertToGeminiTool(mcpTool) {
    // Gemini expects property types in uppercase (STRING, NUMBER, OBJECT, etc.)
    const convertSchema = (schemaInRange) => {
        if (!schemaInRange) return undefined;
        const schema = { ...schemaInRange };
        if (schema.type) {
            schema.type = schema.type.toUpperCase();
        }
        if (schema.properties) {
            for (const key in schema.properties) {
                schema.properties[key] = convertSchema(schema.properties[key]);
            }
        }
        if (schema.items) {
            schema.items = convertSchema(schema.items);
        }
        return schema;
    };

    return {
        name: mcpTool.name.replace(/-/g, "_"), // Gemini names usually use underscores
        description: mcpTool.description,
        parameters: convertSchema(mcpTool.inputSchema)
    };
}

async function main() {
    const location = process.argv[2];
    if (!location) {
        console.log("Usage: node index.mjs \"<City>\"");
        console.log("Example: node index.mjs \"New York\"");
        process.exit(1);
    }

    console.log(`Connecting to Weather MCP server at ${MCP_SERVER_URL}...`);
    const transport = new SSEClientTransport(new URL(MCP_SERVER_URL));
    const client = new Client(
        { name: "weather-mcp-client", version: "1.0.0" },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
        console.log("Connected successfully. Discovering tools...");

        const { tools: mcpTools } = await client.listTools();
        console.log(`Discovered ${mcpTools.length} tools: ${mcpTools.map(t => t.name).join(", ")}`);

        // Prepare Gemini with tools
        const geminiTools = mcpTools.map(convertToGeminiTool);
        
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            tools: [{ functionDeclarations: geminiTools }]
        });

        const chat = model.startChat();
        const prompt = `What is the current weather and forecast for ${location}? Please use the available weather tools to provide an accurate answer.`;

        console.log(`\nQuerying Gemini: "${prompt}"`);
        let result = await chat.sendMessage(prompt);
        let response = result.response;

        // Handle tool calls iteratively
        while (response.candidates[0].content.parts.some(part => part.functionCall)) {
            const toolCalls = response.candidates[0].content.parts
                .filter(part => part.functionCall)
                .map(part => part.functionCall);

            const toolResults = [];

            for (const call of toolCalls) {
                const originalToolName = mcpTools.find(t => t.name.replace(/-/g, "_") === call.name)?.name || call.name;
                console.log(`  -> Calling tool: ${originalToolName} with args: ${JSON.stringify(call.args)}`);
                
                try {
                    const toolResult = await client.callTool({
                        name: originalToolName,
                        arguments: call.args
                    });
                    
                    toolResults.push({
                        functionResponse: {
                            name: call.name,
                            response: toolResult
                        }
                    });
                } catch (toolError) {
                    console.error(`Error calling tool ${originalToolName}:`, toolError.message);
                    toolResults.push({
                        functionResponse: {
                            name: call.name,
                            response: { error: toolError.message }
                        }
                    });
                }
            }

            console.log("Feeding results back to Gemini...");
            result = await chat.sendMessage(toolResults);
            response = result.response;
        }

        console.log("\n--- Gemini's Final Response ---");
        console.log(response.text());
        console.log("-------------------------------\n");

    } catch (error) {
        console.error("Application Error:", error.message);
    } finally {
        console.log("Closing connection...");
        await transport.close();
        process.exit(0);
    }
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
