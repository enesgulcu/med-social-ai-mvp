// Türkçe yorum: OpenAI TTS client; ses üretimi için. Env yoksa graceful fallback.

/**
 * OpenAI TTS ile ses üretir.
 * @param {Object} params
 * @param {string} params.text - Seslendirilecek metin
 * @param {string} [params.voice] - Ses seçeneği (alloy, echo, fable, onyx, nova, shimmer). Default: env'den veya "alloy"
 * @returns {Promise<{ok: boolean, audioUrl?: string, transcript?: string, meta?: any, errorCode?: string, message?: string}>}
 */
export async function synthesize({ text, voice }) {
  // Türkçe yorum: API key kontrolü; yoksa mock'a dönüş.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      errorCode: "NO_API_KEY",
      message: "OpenAI API key bulunamadı, mock fallback kullanılacak",
      transcript: text,
    };
  }

  const model = process.env.OPENAI_TTS_MODEL || "tts-1";
  // Türkçe yorum: Voice parametresi öncelikli, yoksa env'den, yoksa default "alloy".
  const selectedVoice = voice || process.env.OPENAI_TTS_VOICE || "alloy";
  const timeout = parseInt(process.env.OPENAI_TIMEOUT_MS || "30000", 10);

  const url = "https://api.openai.com/v1/audio/speech";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const body = {
    model,
    input: text,
    voice: selectedVoice,
  };

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
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        message: errorData.error?.message || `HTTP ${response.status}`,
        transcript: text,
      };
    }

    // Türkçe yorum: Binary audio data döner; base64'e çevrilir (MVP için).
    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    // Türkçe yorum: Büyük dosyalar için /api/media route kullanılabilir, şimdilik base64.
    return {
      ok: true,
      audioUrl,
      transcript: text,
      meta: {
        model,
        voice: selectedVoice,
        sizeBytes: audioBuffer.byteLength,
      },
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        ok: false,
        errorCode: "TIMEOUT",
        message: `İstek ${timeout}ms içinde tamamlanamadı`,
        transcript: text,
      };
    }

    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      message: error.message || "Ağ hatası",
      transcript: text,
    };
  }
}

