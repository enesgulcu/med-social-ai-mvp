import { callOpenAIChat } from "../../../../lib/ai/openaiClient";
import { AUDIENCE_SUGGESTIONS_BY_SECTOR } from "../../../../features/onboarding/questions";

export async function POST(req) {
  try {
    const body = await req.json();
    const sector = body?.sector || "";
    const sectorArea = body?.sectorArea || "";
    const purpose = body?.purpose || "";

    const system = "Kullanıcının sektörüne ve sektör içi alana uygun kısa onboarding soruları ve hedef kitle önerileri oluşturan bir asistansınız. Yanıtları JSON formatında döndürün: { questions: [{id, question, type, placeholder}], suggestions: [string] }. Lütfen tüm metinleri SADECE Türkçe olarak üretin.";
    const userPrompt = "Sektör: " + sector + "\nSektörAlanı: " + sectorArea + "\nAmaç: " + purpose + "\nRol: sağlayıcı\n\nKullanıcı bir işletme/hizmet sağlayıcısıdır ve kendi sunduğu hizmetler hakkında bilgi girecektir. Sağlayıcıya yönelik, sunduğu hizmetleri, hizmet formatlarını ve coğrafi kapsama alanını soran 2-3 kısa ve net onboarding sorusu üretin. ÖNEMLİ: 'Hedef müşteri kitleniz kimlerdir?' veya benzeri hedef kitle sorusu SORMAYIN çünkü hedef kitle bilgisi ayrı bir adımda manuel olarak alınacaktır. Ayrıca 3 kısa hedef kitle önerisi (potansiyel hedef segmentler) üretin. Yanıtı JSON nesnesi olarak verin: { questions: [{id,question,type,placeholder}], suggestions: [string] }. Lütfen tüm yanıtları yalnızca Türkçe verin.";

    const aiRes = await callOpenAIChat({ system, user: userPrompt, temperature: 0.6, maxTokens: 400, responseJson: true });

    if (aiRes.ok && aiRes.data) {
      return new Response(JSON.stringify({ ok: true, ...aiRes.data }), { status: 200 });
    }

    // Fallback: return heuristic suggestions based on sector
    const key = sector || "default";
    const suggestions = AUDIENCE_SUGGESTIONS_BY_SECTOR[key] || AUDIENCE_SUGGESTIONS_BY_SECTOR.default;
    const questions = [
      { id: "age", question: "Hedef kitlenizin yaş aralığı nedir?", type: "text", placeholder: "Örn: 30-50" },
      { id: "topic", question: sector ? sector + " alanında odaklanmak istediğiniz konu nedir?" : "Hangi konu/tema üzerinde odaklanmak istersiniz?", type: "text", placeholder: "Örn: Ürün tanıtımı, kampanya" },
      { id: "geography", question: "Hedef kitleniz hangi bölgede?", type: "text", placeholder: "Örn: İstanbul, Türkiye geneli" },
    ];

    return new Response(JSON.stringify({ ok: true, questions, suggestions }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
}
