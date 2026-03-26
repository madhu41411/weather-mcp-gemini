service AIAssistService {
    function askAI(topic: String) returns String;
    action updateApiKey(key: String) returns Boolean;
}
