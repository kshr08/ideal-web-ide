from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests, json, os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

OLLAMA_URL = "http://127.0.0.1:11500"
MEMORY_FILE = "memory.json"

SYSTEM_PROMPT = """
You are IDEAL — an AI coding engine.

ABSOLUTE RULES:
1. Output ONLY raw code.
2. NEVER output explanations, sentences, descriptions, apologies, or natural language of any kind.
3. NEVER output markdown or code fences (no ``` or ```python).
4. NEVER output backticks (`) in any form.
5. NEVER output comments (//, #, /* */, <!-- -->).
6. NEVER introduce the code (no “here is…” or “the code is…”).
7. The ENTIRE response must be ONLY the final code, nothing before it and nothing after it.
8. If the user request is unclear, still output ONLY the m 
Your behavior: 
- Produce only the code required to answer the user prompt.
- No other words. No formatting. No explanations. No comments. No markdown.
"""

# ---------------- Memory --------------------

def load_memory():
    if not os.path.exists(MEMORY_FILE):
        return []
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_memory(memory):
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory[-20:], f, indent=2)

# ---------------- API Endpoint ----------------

@app.route("/api/generate", methods=["POST"])
def generate():
    req_data = request.json or {}
    prompt = req_data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "Empty prompt"}), 400

    print("➡️ Received prompt:", prompt[:50])

    # Load memory
    memory = load_memory()

    # Build context
    history = ""
    for turn in memory:
        history += f"User: {turn['prompt']}\nIDEAL: {turn['response']}\n"

    full_prompt = history + f"User: {prompt}\nIDEAL:"

    payload = {
        "model": "codellama",
        "system": SYSTEM_PROMPT,
        "temperature": 1,
        "prompt": full_prompt
    }

    generated_output = ""

    try:
        upstream = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            stream=True,
            timeout=300
        )

        def generate_stream():
            nonlocal generated_output

            for chunk in upstream.iter_lines():
                if not chunk:
                    continue

                try:
                    obj = json.loads(chunk.decode("utf-8"))
                    if "response" in obj:
                        text = obj["response"]

                        # -------- SANITIZER: remove all backticks + fences -------
                        text = text.replace("```", "").replace("`", "")

                        generated_output += text
                        yield text
                except Exception:
                    # If not JSON — treat as raw chunk
                    try:
                        text = chunk.decode("utf-8")
                        text = text.replace("```", "").replace("`", "")
                        generated_output += text
                        yield text
                    except Exception as e:
                        print("⚠️ Chunk decode error:", e)
                        continue

            # Save memory
            memory.append({"prompt": prompt, "response": generated_output})
            save_memory(memory)

        return Response(generate_stream(), mimetype="text/plain", status=200)

    except Exception as e:
        print("❌ Proxy error:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/status", methods=["GET"])
def status():
    try:
        test = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if test.ok:
            return jsonify({"ok": True, "ollama": OLLAMA_URL})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    return jsonify({"ok": False}), 500


@app.route("/api/clear", methods=["POST"])
def clear():
    save_memory([])
    return jsonify({"status": "memory cleared"})


if __name__ == "__main__":
    print("🚀 IDEAL Proxy (Memory + Sanitizer Enabled) running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, threaded=True)
