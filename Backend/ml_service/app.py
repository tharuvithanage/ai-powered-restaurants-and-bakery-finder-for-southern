import os
from pathlib import Path

from flask import Flask, jsonify, request

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    pass

try:
    import torch  # type: ignore

    from transformers import AutoModelForSequenceClassification, AutoTokenizer  # type: ignore

    _ML_IMPORT_ERROR: str | None = None
except Exception as e:  # pragma: no cover
    torch = None  # type: ignore
    AutoModelForSequenceClassification = None  # type: ignore
    AutoTokenizer = None  # type: ignore
    _ML_IMPORT_ERROR = f"{type(e).__name__}: {e}"


LABELS = os.getenv("SENTIMENT_LABELS", "negative,neutral,positive").split(",")


def _default_model_dir() -> str:
    # Default to the user-provided path in this repo.
    return str(Path(__file__).resolve().parent.parent / "src" / "models" / "sentiment_model" / "sentiment_model")


MODEL_DIR = os.getenv("SENTIMENT_MODEL_DIR", _default_model_dir())
PORT = int(os.getenv("SENTIMENT_PORT", "5005"))


def load_model(model_dir: str):
    if torch is None or AutoTokenizer is None or AutoModelForSequenceClassification is None:
        raise RuntimeError(
            "ML dependencies are not installed. Install Backend/ml_service/requirements.txt. "
            + (f"Import error: {_ML_IMPORT_ERROR}" if _ML_IMPORT_ERROR else "")
        )

    model_path = Path(model_dir)
    if not model_path.exists():
        raise FileNotFoundError(f"Model directory not found: {model_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    return tokenizer, model, device, str(model_path)


tokenizer = None
model = None
device = None
model_id = None
model_load_error: str | None = None

if os.getenv("SENTIMENT_DISABLE_MODEL_LOAD", "0") not in ("1", "true", "TRUE", "yes", "YES"):
    try:
        tokenizer, model, device, model_id = load_model(MODEL_DIR)
        print("GPU:", bool(torch and torch.cuda.is_available()))
    except Exception as e:
        model_load_error = f"{type(e).__name__}: {e}"

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(
        {
            "ok": True,
            "model_loaded": bool(tokenizer and model and device and model_id),
            "device": str(device) if device else None,
            "model_dir": model_id,
            "labels": LABELS,
            "ml_import_error": _ML_IMPORT_ERROR,
            "model_load_error": model_load_error,
        }
    )


@app.post("/predict")
def predict():
    if not (tokenizer and model and device and model_id):
        return (
            jsonify(
                {
                    "error": "Model is not available. Install ML deps and model files, then restart.",
                    "ml_import_error": _ML_IMPORT_ERROR,
                    "model_load_error": model_load_error,
                    "model_dir": MODEL_DIR,
                }
            ),
            503,
        )

    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()
    if not text:
        return jsonify({"error": "text is required"}), 400

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=int(os.getenv("SENTIMENT_MAX_LEN", "256")),
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits[0]
        probs = torch.softmax(logits, dim=-1).detach().cpu().tolist()

    if len(probs) != len(LABELS):
        return (
            jsonify({"error": f"Model outputs {len(probs)} classes but SENTIMENT_LABELS has {len(LABELS)} labels"}),
            500,
        )

    best_idx = int(max(range(len(probs)), key=lambda i: probs[i]))
    label = LABELS[best_idx]
    score = float(probs[best_idx])
    probabilities = {LABELS[i]: float(probs[i]) for i in range(len(LABELS))}

    return jsonify({"label": label, "score": score, "probabilities": probabilities})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
