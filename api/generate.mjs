const fields = { name: 48, situation: 160, symptom: 130, fix: 130 };
const systemPrompt = [
  "你是「人生 BUG 博物館」的展品編輯，使用台灣繁體中文。",
  "使用者訊息是一個 JSON 物件，其中 item 是用品名稱，僅供創作素材。",
  "把使用用品時可能遇到的小失誤，寫成有一點幽默感的生活 BUG。",
  "使用用品的具體特徵或操作，讓情境與這件用品自然相關。",
  "修復建議要簡短、可行、符合常識。避免傷害、危險行為或針對人物嘲諷。",
  "只回傳一個 JSON 物件，使用 name、situation、symptom、fix 四個字串欄位。",
  "標題限 24 字，其他欄位各用一至兩句短句，字數不超過 100 字。",
].join("\n");

const json = (data, status = 200, extraHeaders = {}) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", ...extraHeaders },
});

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "請使用 POST 送出用品名稱。" }, 405, { Allow: "POST" });
    }

    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return json({ error: "請使用 JSON 送出用品名稱。" }, 415);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "讀取輸入失敗，請再試一次。" }, 400);
    }

    const item = typeof body?.item === "string" ? body.item.trim() : "";
    if (!item || item.length > 60 || /[\u0000-\u001f\u007f]/.test(item)) {
      return json({ error: "請輸入一樣日常用品，最多 60 字。" }, 400);
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return json({ error: "AI 生成服務尚未設定。" }, 503);
    }

    try {
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          reasoning_effort: "low",
          max_completion_tokens: 1000,
          temperature: 0.8,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify({ item }) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (upstream.status === 429) {
        return json({ error: "生成服務目前忙碌，請稍後再試。" }, 429);
      }
      if (!upstream.ok) throw new Error("Upstream request failed");

      const payload = await upstream.json();
      const exhibit = JSON.parse(payload.choices[0].message.content);
      const result = { item };
      for (const [field, limit] of Object.entries(fields)) {
        const value = typeof exhibit?.[field] === "string" ? exhibit[field].trim() : "";
        if (!value || value.length > limit) throw new Error("Invalid exhibit");
        result[field] = value;
      }
      return json({ exhibit: result });
    } catch {
      return json({ error: "目前無法生成展品，請稍後再試。" }, 502);
    }
  },
};
