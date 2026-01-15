# Plan to Add `thought_signature` to Gemini API Requests

1.  **Modify `Gemini.Part` types:** Ensure that the `thought_signature` is a property on the `FunctionCallPart`, `TextPart`, and `FunctionResponsePart` in `src/types/gemini.ts`.
2.  **Update `streamContentInternal` in `client.ts`:** Modify the `streamContentInternal` function in `src/gemini/client.ts` to extract the `thought_signature` from the model's response and store it.
3.  **Update `mapOpenAIMessageToGeminiFormat` in `openai-mapper.ts`:** Modify the `mapOpenAIMessageToGeminiFormat` function in `src/gemini/openai-mapper.ts` to include the stored `thought_signature` in the next request.
