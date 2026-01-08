// Türkçe yorum: OpenAI API client; timeout, retry ve hata yönetimi ile güvenli çağrı yapar. Env yoksa graceful fallback.

/**
 * OpenAI Chat API çağrısı yapar; JSON response döndürmeye çalışır.
 * @param {Object} params
 * @param {string} params.system - System prompt
 * @param {string} params.user - User prompt
 * @param {number} [params.temperature=0.7] - Temperature
 * @param {number} [params.maxTokens=1000] - Max tokens
 * @param {boolean} [params.responseJson=false] - JSON response isteniyorsa true
 * @returns {Promise<{ok: boolean, data?: any, errorCode?: string, message?: string, details?: any}>}
 */
export async function callOpenAIChat({ system, user, temperature = 0.7, maxTokens = 1000, responseJson = false }) {
  // Türkçe yorum: API key kontrolü; yoksa mock'a dönüş yapılır.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      errorCode: "NO_API_KEY",
      message: "OpenAI API key bulunamadı, mock fallback kullanılacak",
    };
  }

  // Ucuz model kullan (maliyet optimizasyonu için)
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
  const timeout = parseInt(process.env.OPENAI_TIMEOUT_MS || "30000", 10);

  const url = "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Eğer system prompt Türkçe yanıt talimatı içermiyorsa ekle
  const turkishInstructionRegex = /turkçe|türkçe|yalnızca Türkçe|SADECE Türkçe/i;
  const finalSystem = system && turkishInstructionRegex.test(system)
    ? system
    : (system ? `${system}\n\nLütfen tüm yanıtları yalnızca Türkçe olarak verin.` : 'Lütfen tüm yanıtları yalnızca Türkçe olarak verin.');

  const body = {
    model,
    messages: [
      { role: "system", content: finalSystem },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // Türkçe yorum: JSON response isteniyorsa response_format eklenir.
  if (responseJson) {
    body.response_format = { type: "json_object" };
  }

  // Türkçe yorum: Retry mekanizması; 2 deneme, exponential backoff.
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastError = {
          ok: false,
          errorCode: `HTTP_${response.status}`,
          message: errorData.error?.message || `HTTP ${response.status}`,
          details: errorData,
        };
        // Türkçe yorum: Rate limit veya geçici hata ise retry yapılır.
        if (response.status === 429 || response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        return lastError;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          ok: false,
          errorCode: "NO_CONTENT",
          message: "API'den içerik dönmedi",
        };
      }

      // Türkçe yorum: JSON response isteniyorsa parse edilir.
      if (responseJson) {
        try {
          const parsed = JSON.parse(content);
          return { ok: true, data: parsed };
        } catch (parseError) {
          return {
            ok: false,
            errorCode: "PARSE_ERROR",
            message: "JSON parse hatası",
            details: parseError,
          };
        }
      }

      return { ok: true, data: content };
    } catch (error) {
      if (error.name === "AbortError") {
        return {
          ok: false,
          errorCode: "TIMEOUT",
          message: `İstek ${timeout}ms içinde tamamlanamadı`,
        };
      }
      lastError = {
        ok: false,
        errorCode: "NETWORK_ERROR",
        message: error.message || "Ağ hatası",
        details: error,
      };
      // Türkçe yorum: Network hatası ise retry yapılır.
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  return lastError || {
    ok: false,
    errorCode: "UNKNOWN",
    message: "Bilinmeyen hata",
  };
}

