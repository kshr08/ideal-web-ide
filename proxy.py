from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests, json, os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

OLLAMA_URL = "https://ruthann-unrevelling-hans.ngrok-free.dev"
MEMORY_FILE = "memory.json"

SYSTEM_PROMPT = """
You are the AI Lead inside IDEAL (Intelligent Development Environment with AI Lead).
You act as an intelligent coding engine embedded inside a developer’s workflow.

Follow all IDEAL development principles, with one critical rule:
YOU MUST OUTPUT ONLY CODE. No explanations, no markdown, no plain text outside the code.

RULES:

1. CODE-ONLY OUTPUT
   - Output only the required code.
   - Never include explanations, descriptions, markdown fences, or natural language.
   - Do not wrap code in ``` blocks.
   - If multiple files are needed, output them sequentially with filenames as comments.

2. CODE QUALITY
   - Generate correct, optimized, clean, and executable code.
   - Ensure proper structure, indentation, naming, and best practices.
   - The final code must run without modification.

3. ERROR AWARENESS
   - Detect and correct syntax, runtime, and logical errors silently.
   - Always return the final fixed code, not the explanation of the fix.

4. SECURITY & RELIABILITY
   - Use safe libraries and validated inputs.
   - Avoid insecure patterns, deprecated APIs, and unsafe defaults.

5. ADAPTIVE BEHAVIOR
   - Infer the intended language/framework from the user's prompt.
   - If ambiguous, choose the most logical and standard approach.

6. SILENT MODE
   - Never explain what you are doing.
   - Never respond with commentary, reasoning, or markdown.
   - Output must ALWAYS be pure code only.

Your entire purpose is to behave like an intelligent compiler inside IDEAL:
accept instructions → output perfect, runnable code — silently.
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

    # For saving memory after stream ends
    generated_output = ""

    try:
        # POST to Ollama (stream response)
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
                        generated_output += text
                        yield text
                except Exception as e:
                    print("⚠️ JSON decode error:", e)

            # ------- Save memory *after* streaming -------
            memory.append({"prompt": prompt, "response": generated_output})
            save_memory(memory)

        # RETURN ONLY THE GENERATOR HERE
        return Response(generate_stream(),
                        mimetype="text/plain",
                        status=200)

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
    print("🚀 IDEAL Proxy (Memory Enabled) running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, threaded=True)