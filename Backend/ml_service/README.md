# Sentiment Flask API

Loads your Colab-exported HuggingFace model from:

`Backend/src/models/sentiment_model/sentiment_model`

## Run

```powershell
python -m pip install flask
python Backend/ml_service/app.py
```

To enable `/predict`, install the full ML dependencies (may take a while):

```powershell
python -m pip install -r Backend/ml_service/requirements.txt
```

## Endpoints

- `GET /health`
- `POST /predict` body: `{ "text": "..." }`

## Environment variables

- `SENTIMENT_PORT` (default `5005`)
- `SENTIMENT_MODEL_DIR` (default points to this repo's model folder)
- `SENTIMENT_LABELS` (default `negative,neutral,positive`)
- `SENTIMENT_DISABLE_MODEL_LOAD` (`1` to start without loading the model)
