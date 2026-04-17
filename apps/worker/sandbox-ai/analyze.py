"""Phase 06 — Sandbox AI second-opinion entrypoint.

Reads a JSON job over HTTP POST /analyze and returns annotations in the
same shape as the Tier-1 on-device model so the doctor inbox can render
both tiers uniformly.

Job shape:
    {
      "observation_id": "obs_abc",
      "module_type": "vision",
      "media_url": "https://...",
      "model_key": "r2://skids-models/second-opinion/vision/v1.2/model.onnx"
    }

Response shape:
    {
      "status": "ok" | "error" | "skipped",
      "ms_inference": 123,
      "annotations": [{ "id": ..., "confidence": ..., ... }],
      "quality": "good" | "fair" | "poor"
    }

Intentionally defensive — inference failures never crash the listener;
they return { status: "error", error: <msg> } so the queue consumer can
record them and move on.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

import numpy as np
import onnxruntime as ort
import requests
from PIL import Image

from models_registry import preprocess_for_module, postprocess_for_module

LOG = logging.getLogger("skids-sandbox-ai")

MODELS_DIR = os.environ.get("MODELS_DIR", "/tmp/models")
os.makedirs(MODELS_DIR, exist_ok=True)


def download_model(model_uri: str) -> str:
    """Fetch an R2-hosted ONNX model. `model_uri` is `r2://bucket/key/...`."""
    parsed = urlparse(model_uri)
    if parsed.scheme != "r2":
        raise ValueError(f"unsupported model uri scheme: {model_uri}")
    local_path = os.path.join(MODELS_DIR, parsed.netloc, parsed.path.lstrip("/"))
    if os.path.exists(local_path):
        return local_path
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    # The container is expected to receive a pre-signed HTTPS URL in place
    # of the raw r2:// reference when called via the CF container runtime;
    # the queue consumer substitutes it. Callers that pass r2:// directly
    # hit this path and must be running in an env where R2_HTTP_BASE
    # resolves.
    http_base = os.environ.get("R2_HTTP_BASE")
    if not http_base:
        raise RuntimeError("R2_HTTP_BASE env var required to fetch models over HTTP")
    url = f"{http_base.rstrip('/')}/{parsed.netloc}/{parsed.path.lstrip('/')}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(resp.content)
    return local_path


def load_image(media_url: str) -> np.ndarray:
    resp = requests.get(media_url, timeout=15)
    resp.raise_for_status()
    img = Image.open(resp.raw if hasattr(resp, "raw") and resp.raw else __import__("io").BytesIO(resp.content))
    img = img.convert("RGB")
    return np.asarray(img)


def run_inference(job: dict) -> dict:
    t0 = time.perf_counter()
    try:
        module = job.get("module_type", "")
        media_url = job.get("media_url")
        model_key = job.get("model_key")
        if not media_url or not model_key:
            return {"status": "skipped", "error": "missing media_url or model_key"}

        model_path = download_model(model_key)
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        image = load_image(media_url)

        tensor = preprocess_for_module(module, image)
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: tensor})
        annotations, quality = postprocess_for_module(module, outputs)

        ms_inference = int((time.perf_counter() - t0) * 1000)
        return {
            "status": "ok",
            "ms_inference": ms_inference,
            "annotations": annotations,
            "quality": quality,
        }
    except Exception as exc:  # noqa: BLE001 — defensive boundary
        LOG.exception("inference failed")
        ms_inference = int((time.perf_counter() - t0) * 1000)
        return {"status": "error", "ms_inference": ms_inference, "error": str(exc)[:500]}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler API
        if self.path != "/analyze":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            job = json.loads(raw.decode("utf-8"))
        except Exception:  # noqa: BLE001
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"status":"error","error":"invalid json"}')
            return

        result = run_inference(job)
        payload = json.dumps(result).encode("utf-8")
        self.send_response(200 if result.get("status") == "ok" else 202)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args: object) -> None:  # quiet default noise
        LOG.info("%s - %s", self.address_string(), fmt % args)


def main() -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen", default="0.0.0.0:8080")
    args = parser.parse_args()
    host, port = args.listen.rsplit(":", 1)
    server = HTTPServer((host, int(port)), Handler)
    LOG.info("skids-sandbox-ai listening on %s", args.listen)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
