// Türkçe yorum: Risk kontrolü v2; hibrit yaklaşım (keyword + semantic AI). Sağlık içerikleri için güvenlik katmanı.

import { callOpenAIChat } from "../../lib/ai/openaiClient";
import { getGovernanceSemanticPrompt } from "../../lib/ai/promptTemplates";

const riskyKeywords = ["kesin", "garanti", "mucize", "tedavi eder", "yan etkisiz", "kurtulursun", "bitirir"];

/**
 * Keyword tabanlı risk kontrolü (fallback).
 * @param {string} text - Kontrol edilecek metin
 * @returns {Object} { verdict, reasons, suggestedFixes }
 */
function riskCheckKeywords(text = "") {
  // Türkçe yorum: Metinde riskli kelimeleri arar; kural tabanlı basit kontrol.
  const lowered = text.toLowerCase();
  const hits = riskyKeywords.filter((kw) => lowered.includes(kw));
  return {
    verdict: hits.length ? "warn" : "pass",
    reasons: hits,
    suggestedFixes: hits.map((kw) => `"${kw}" ifadesini kaldır veya değiştir`),
  };
}

/**
 * Hibrit risk kontrolü: keyword + semantic AI.
 * @param {string} text - Kontrol edilecek metin
 * @param {Object} [contentDNA] - Content DNA objesi (opsiyonel)
 * @returns {Promise<Object>} { verdict, reasons, suggestedFixes }
 */
export async function riskCheck(text = "", contentDNA = null) {
  // Türkçe yorum: Önce keyword kontrolü yapılır; hızlı ve güvenilir.
  const keywordResult = riskCheckKeywords(text);

  // Türkçe yorum: Keyword kontrolü warn döndürdüyse semantic kontrol yapılır (daha detaylı).
  if (keywordResult.verdict === "warn") {
    try {
      const { system, user } = getGovernanceSemanticPrompt(text, contentDNA);
      const aiResult = await callOpenAIChat({
        system,
        user,
        temperature: 0.3,
        maxTokens: 500,
        responseJson: true,
      });

      if (aiResult.ok && aiResult.data) {
        // Türkçe yorum: AI sonucu keyword sonucuyla birleştirilir.
        return {
          verdict: aiResult.data.verdict || keywordResult.verdict,
          reasons: [
            ...keywordResult.reasons,
            ...(Array.isArray(aiResult.data.reasons) ? aiResult.data.reasons : []),
          ],
          suggestedFixes: [
            ...keywordResult.suggestedFixes,
            ...(Array.isArray(aiResult.data.suggestedFixes) ? aiResult.data.suggestedFixes : []),
          ],
        };
      }
    } catch (error) {
      console.error("Governance semantic kontrol hatası:", error);
      // Türkçe yorum: AI hatası olursa keyword sonucu döndürülür.
    }
  }

  // Türkçe yorum: Keyword kontrolü pass döndürdüyse veya AI başarısız olduysa keyword sonucu döndürülür.
  return keywordResult;
}

/**
 * Bilgilendirme etiketi ekler.
 * @param {string} text - Metin
 * @param {string} [policy="always"] - "always" veya "conditional"
 * @returns {string} Etiket eklenmiş metin
 */
export function appendDisclaimer(text = "", policy = "always") {
  // Türkçe yorum: İçeriğe bilgilendirme etiketi ekler; policy'ye göre.
  if (policy === "conditional" && text.includes("Bilgilendirme amaçlıdır")) {
    return text;
  }

  const disclaimer = "\n\nBilgilendirme amaçlıdır; tanı ve tedavi için hekiminize danışın.";
  if (!text.includes("Bilgilendirme amaçlıdır")) {
    return `${text}${disclaimer}`;
  }
  return text;
}


