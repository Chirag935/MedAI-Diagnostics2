"""
GenAI Medical Assistant Router
Uses Groq API (free tier) with Llama 3 for real-time medical Q&A.
Implements Retrieval-Augmented Generation (RAG) by injecting diagnostic 
context from the user's session into the LLM prompt.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
import traceback

router = APIRouter()

# Groq API configuration - free tier provides fast Llama 3 inference
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are MedAI Clinical Consultant, a knowledgeable medical AI assistant.

CRITICAL RULES:
1. Answer each medical question INDEPENDENTLY based on your medical knowledge.
2. Do NOT automatically reference or mention any diagnostic context unless the user EXPLICITLY asks about "my diagnosis", "my results", "my test", or "what did the checker say".
3. If the user asks a general question like "remedies for fever" or "what causes headaches", answer it directly WITHOUT mentioning any prior diagnostic results.
4. Keep responses concise but comprehensive (2-4 paragraphs).
5. Use bullet points for lists of symptoms, treatments, or recommendations.
6. Always remind users to consult a healthcare professional for proper diagnosis.
7. Never definitively diagnose — use phrases like "this could indicate", "common causes include", "you may want to consider"."""


class ChatRequest(BaseModel):
    message: str
    diagnostic_context: str = ""  # Optional RAG context from predictions
    history: list = []  # Previous conversation messages


class ChatMessage(BaseModel):
    role: str
    content: str


@router.post("/chat")
async def chat_with_ai(request: ChatRequest):
    try:
        if not GROQ_API_KEY:
            # Fallback for when API key isn't configured
            return _generate_offline_response(request.message, request.diagnostic_context)

        # Build RAG-augmented prompt
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Inject diagnostic context (RAG)
        if request.diagnostic_context:
            messages.append({
                "role": "system",
                "content": f"DIAGNOSTIC CONTEXT FROM USER'S SESSION:\n{request.diagnostic_context}\n\nUse this context to provide personalized medical guidance."
            })

        # Add conversation history
        for msg in request.history[-6:]:  # Keep last 6 messages for context window
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        # Add current user message
        messages.append({"role": "user", "content": request.message})

        # Call Groq API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1024,
                    "top_p": 0.9,
                }
            )

        if response.status_code != 200:
            print(f"Groq API error: {response.status_code} - {response.text}")
            return _generate_offline_response(request.message, request.diagnostic_context)

        data = response.json()
        reply = data["choices"][0]["message"]["content"]

        return {
            "reply": reply,
            "model": MODEL,
            "mode": "online",
            "tokens_used": data.get("usage", {}).get("total_tokens", 0)
        }

    except Exception as e:
        traceback.print_exc()
        return _generate_offline_response(request.message, request.diagnostic_context)


def _generate_offline_response(message: str, context: str = "") -> dict:
    """
    Intelligent offline fallback when Groq API is unavailable.
    Uses keyword matching to provide relevant medical information.
    """
    message_lower = message.lower()
    
    responses = {
        "eczema": "**Eczema (Atopic Dermatitis)** is a chronic inflammatory skin condition characterized by dry, itchy, and inflamed patches of skin.\n\n**Key Management Strategies:**\n- **Moisturize frequently** with fragrance-free emollients\n- **Avoid triggers** such as harsh soaps, certain fabrics, and stress\n- **Topical corticosteroids** can reduce inflammation during flare-ups\n- **Antihistamines** may help reduce itching\n\n**Foods to consider avoiding:** Dairy, eggs, gluten, and nuts are common dietary triggers for some individuals.\n\n⚠️ *This is educational information only. Please consult a dermatologist for personalized treatment.*",
        
        "acne": "**Acne** occurs when hair follicles become clogged with oil and dead skin cells, leading to whiteheads, blackheads, or pimples.\n\n**Treatment Approach:**\n- **Mild:** Over-the-counter benzoyl peroxide or salicylic acid cleansers\n- **Moderate:** Prescription retinoids (tretinoin) or topical antibiotics\n- **Severe:** Oral antibiotics or isotretinoin (Accutane) under medical supervision\n\n**Lifestyle Tips:**\n- Wash face twice daily with gentle cleanser\n- Avoid touching or picking at blemishes\n- Use non-comedogenic skincare products\n\n⚠️ *This is educational information only. Please consult a dermatologist for personalized treatment.*",
        
        "melanoma": "**Melanoma** is the most serious type of skin cancer, developing from melanocytes (pigment-producing cells).\n\n**ABCDE Rule for Detection:**\n- **A**symmetry: One half doesn't match the other\n- **B**order: Irregular, ragged edges\n- **C**olor: Multiple colors or uneven distribution\n- **D**iameter: Larger than 6mm (pencil eraser)\n- **E**volving: Changes in size, shape, or color\n\n**Critical Action:** If our AI has flagged potential melanoma, please **seek immediate dermatological evaluation**. Early detection dramatically improves survival rates (99% 5-year survival when caught early).\n\n⚠️ *This is educational information only. Please consult an oncologist immediately for proper diagnosis.*",

        "fever": "**Fever Management Guidelines:**\n\n- **Low-grade (99-100.4°F):** Rest, hydrate, monitor\n- **Moderate (100.4-102°F):** OTC antipyretics (acetaminophen/ibuprofen), cool compresses\n- **High (>102°F):** Seek medical attention, especially if persistent >3 days\n\n**When to see a doctor immediately:**\n- Fever above 103°F (39.4°C)\n- Fever lasting more than 3 days\n- Accompanied by severe headache, stiff neck, or confusion\n- In infants under 3 months\n\n⚠️ *This is educational information only. Please consult a physician for proper evaluation.*",

        "headache": "**Headache Assessment:**\n\n**Common Types:**\n- **Tension headache:** Dull, aching sensation across forehead\n- **Migraine:** Throbbing pain, often one-sided, with nausea/light sensitivity\n- **Cluster headache:** Severe, burning pain around one eye\n\n**Immediate Relief:**\n- Rest in a quiet, dark room\n- OTC pain relief (ibuprofen, acetaminophen)\n- Stay hydrated\n- Apply cold or warm compress\n\n**Seek emergency care if:** Sudden severe headache, headache after head injury, or accompanied by fever, stiff neck, confusion, or vision changes.\n\n⚠️ *This is educational information only. Please consult a physician for chronic or severe headaches.*",
    }

    # Find best matching response
    reply = None
    for keyword, response in responses.items():
        if keyword in message_lower:
            reply = response
            break
    
    if context and not reply:
        reply = f"Based on your diagnostic session, here is what I can share:\n\n{context}\n\n**General Recommendations:**\n- Monitor your symptoms carefully over the next 24-48 hours\n- Maintain proper hydration and rest\n- Document any changes in severity or new symptoms\n- Schedule an appointment with a healthcare professional for a comprehensive evaluation"

    if not reply:
        reply = f"Thank you for your question about: **\"{message}\"**\n\nHere are my recommendations:\n\n- **Track your symptoms** using our Symptom Checker module for a preliminary AI assessment\n- **Document any changes** in your condition over time\n- **Stay hydrated** and get adequate rest\n- **Consult a healthcare professional** for proper diagnosis and treatment\n\nFor more specific AI-powered analysis, try using our Symptom Checker or Skin Analyzer modules, then return here for a detailed discussion."

    return {
        "reply": reply,
        "model": "MedAI Offline Engine",
        "mode": "offline",
        "tokens_used": 0
    }
