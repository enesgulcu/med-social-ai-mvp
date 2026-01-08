// Türkçe yorum: Google Gemini Image Generation API client; görsel üretimi için. Env yoksa graceful fallback.
// Geriye dönük uyumluluk: NANO_BANANA_API_KEY varsa GEMINI_API_KEY gibi kullanılır.

/**
 * Google Gemini ile görsel üretir.
 * @param {Object} params
 * @param {string} params.prompt - Görsel prompt'u
 * @param {string} params.format - "9:16" veya "16:9"
 * @returns {Promise<{ok: boolean, imageUrl?: string, usedPrompt?: string, meta?: any, errorCode?: string, message?: string}>}
 */
export async function createImage({ prompt, format = "9:16" }) {
  // Türkçe yorum: API key kontrolü; GEMINI_API_KEY öncelikli, yoksa NANO_BANANA_API_KEY (geriye dönük uyumluluk).
  const apiKey = process.env.GEMINI_API_KEY || process.env.NANO_BANANA_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const timeout = parseInt(process.env.GEMINI_TIMEOUT_MS || process.env.NANO_BANANA_TIMEOUT_MS || "45000", 10);

  if (!apiKey) {
    return {
      ok: false,
      errorCode: "NO_API_KEY",
      message: "Gemini API key bulunamadı, mock fallback kullanılacak",
      usedPrompt: prompt,
      meta: { ok: false, provider: "gemini", format },
    };
  }

  // Türkçe yorum: Gemini REST endpoint sabit; model ve API key query param olarak gönderilir.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Türkçe yorum: Format'a göre prompt'a aspect ratio bilgisi eklenir.
  const aspectRatio = format === "9:16" ? "9:16" : "16:9";
  const enhancedPrompt = `${prompt}\n\nAspect ratio: ${aspectRatio}.`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: enhancedPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: errorData.error?.message || `HTTP ${response.status}`,
        usedPrompt: prompt,
        meta: {
          ok: false,
          provider: "gemini",
          model,
          format,
          error: errorData,
        },
      };
    }

    const data = await response.json();

    // Türkçe yorum: Gemini response'dan inline base64 image data çıkarılır.
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];
    const inlineData = parts.find((part) => part.inlineData)?.inlineData;

    if (!inlineData || !inlineData.data) {
      return {
        ok: false,
        errorCode: "NO_IMAGE_DATA",
        message: "API'den görsel data dönmedi",
        usedPrompt: prompt,
        meta: {
          ok: false,
          provider: "gemini",
          model,
          format,
        },
      };
    }

    // Türkçe yorum: Base64 data'yı data URL'ye çevir.
    const mimeType = inlineData.mimeType || "image/png";
    const imageUrl = `data:${mimeType};base64,${inlineData.data}`;

    const durationMs = Date.now() - startTime;

    return {
      ok: true,
      imageUrl,
      usedPrompt: prompt,
      meta: {
        ok: true,
        provider: "gemini",
        model,
        format,
        aspectRatio,
        durationMs,
        mimeType,
      },
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        ok: false,
        errorCode: "TIMEOUT",
        message: `İstek ${timeout}ms içinde tamamlanamadı`,
        usedPrompt: prompt,
        meta: {
          ok: false,
          provider: "gemini",
          model,
          format,
        },
      };
    }

    // Türkçe yorum: Network hatası ise 1 retry yapılır.
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);

      const retryResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: retryController.signal,
      });

      clearTimeout(retryTimeoutId);

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryCandidate = retryData.candidates?.[0];
        const retryContent = retryCandidate?.content;
        const retryParts = retryContent?.parts || [];
        const retryInlineData = retryParts.find((part) => part.inlineData)?.inlineData;

        if (retryInlineData?.data) {
          const mimeType = retryInlineData.mimeType || "image/png";
          const imageUrl = `data:${mimeType};base64,${retryInlineData.data}`;
          const durationMs = Date.now() - startTime;

          return {
            ok: true,
            imageUrl,
            usedPrompt: prompt,
            meta: {
              ok: true,
              provider: "gemini",
              model,
              format,
              aspectRatio,
              durationMs,
              mimeType,
              retried: true,
            },
          };
        }
      }
    } catch (retryError) {
      // Retry başarısız, hata döndürülür.
    }

    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      message: error.message || "Ağ hatası",
      usedPrompt: prompt,
      meta: {
        ok: false,
        provider: "gemini",
        model,
        format,
      },
    };
  }
}

