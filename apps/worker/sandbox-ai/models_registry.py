"""Phase 06 — per-module preprocess / postprocess plugins.

Each module registered here must implement:

    preprocess(image: np.ndarray) -> np.ndarray
        Returns a 4D float32 tensor ready for ORT inference.
    postprocess(outputs: list[np.ndarray]) -> tuple[list[dict], str]
        Returns (annotations in AIAnnotation shape, quality label).

Registering a new module is a single entry in `_MODULES`. Upstream
callers never branch on module name — they always go through the two
dispatch helpers below.
"""

from __future__ import annotations

from typing import Callable

import numpy as np


def _vision_preprocess(image: np.ndarray) -> np.ndarray:
    # Resize to 224x224, normalize, CHW.
    from PIL import Image as PIL

    pil = PIL.fromarray(image)
    pil = pil.resize((224, 224))
    arr = np.asarray(pil).astype(np.float32) / 255.0
    arr = (arr - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    arr = arr.transpose(2, 0, 1)[None, ...]
    return arr.astype(np.float32)


def _vision_postprocess(outputs: list[np.ndarray]) -> tuple[list[dict], str]:
    logits = outputs[0][0]
    probs = _softmax(logits)
    top_idx = int(np.argmax(probs))
    confidence = float(probs[top_idx])
    label = _VISION_LABELS[top_idx] if top_idx < len(_VISION_LABELS) else f"class_{top_idx}"
    annotations = [{
        "id": f"secondary-vision-{top_idx}",
        "modelId": "vision_secondary_v1",
        "label": label,
        "confidence": confidence,
        "riskCategory": "moderate" if confidence > 0.8 else "no_risk",
        "qualityFlags": [],
    }]
    return annotations, _quality_from_confidence(confidence)


def _ear_preprocess(image: np.ndarray) -> np.ndarray:
    # Placeholder — real ear otoscopy model preprocess lands in a follow-up.
    return _vision_preprocess(image)


def _ear_postprocess(outputs: list[np.ndarray]) -> tuple[list[dict], str]:
    anns, q = _vision_postprocess(outputs)
    for a in anns:
        a["modelId"] = "ear_secondary_v1"
    return anns, q


def _dental_preprocess(image: np.ndarray) -> np.ndarray:
    return _vision_preprocess(image)


def _dental_postprocess(outputs: list[np.ndarray]) -> tuple[list[dict], str]:
    anns, q = _vision_postprocess(outputs)
    for a in anns:
        a["modelId"] = "dental_secondary_v1"
    return anns, q


def _skin_preprocess(image: np.ndarray) -> np.ndarray:
    return _vision_preprocess(image)


def _skin_postprocess(outputs: list[np.ndarray]) -> tuple[list[dict], str]:
    anns, q = _vision_postprocess(outputs)
    for a in anns:
        a["modelId"] = "skin_secondary_v1"
    return anns, q


_VISION_LABELS = [
    "normal",
    "refractive_error_suspected",
    "strabismus_suspected",
    "conjunctival_redness",
    "other",
]


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x - np.max(x)
    e = np.exp(x)
    return e / np.sum(e)


def _quality_from_confidence(confidence: float) -> str:
    if confidence >= 0.85:
        return "good"
    if confidence >= 0.6:
        return "fair"
    return "poor"


_MODULES: dict[str, tuple[Callable[[np.ndarray], np.ndarray], Callable[[list[np.ndarray]], tuple[list[dict], str]]]] = {
    "vision": (_vision_preprocess, _vision_postprocess),
    "ear": (_ear_preprocess, _ear_postprocess),
    "dental": (_dental_preprocess, _dental_postprocess),
    "skin": (_skin_preprocess, _skin_postprocess),
}


def preprocess_for_module(module: str, image: np.ndarray) -> np.ndarray:
    entry = _MODULES.get(module) or _MODULES["vision"]
    return entry[0](image)


def postprocess_for_module(module: str, outputs: list[np.ndarray]) -> tuple[list[dict], str]:
    entry = _MODULES.get(module) or _MODULES["vision"]
    return entry[1](outputs)
