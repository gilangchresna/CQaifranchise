# ML Hosting Decision for CyberQuote

## Context

CyberQuote is an AI-powered franchise monitoring platform that will serve 300+ franchise outlets. Each outlet requires:

- Real-time price intelligence scraping
- Computer vision for shelf monitoring
- NLP for competitor analysis
- Predictive analytics for pricing optimization

This document evaluates ML inference hosting options for MVP and scales to 300 outlets.

---

## Options Compared

| Provider | Type | Free Tier | Pay-as-you-go | Scale | Cold Starts |
|----------|------|-----------|---------------|-------|-------------|
| Railway | PaaS | $5/mo credit | ~$0.10/vCPU-hr | Horizontal | ~30s |
| Render | PaaS | $0 (free tier) | ~$0.10/vCPU-hr | Horizontal | ~30s |
| Modal.com | Serverless ML | $30/mo | Per-second billing | Auto-scaling | ~1s |
| Baseten | ML PaaS | Limited | Per-second billing | Auto-scaling | ~1s |

---

## Detailed Comparison

### 1. Railway / Render (PaaS)

**Pros:**
- Familiar container-based deployment (Docker)
- No code changes required
- Works with existing FastAPI + Celery stack
- Good for CPU-bound ML tasks
- Easy vertical scaling

**Cons:**
- Cold starts ~30 seconds
- No GPU support on hobby tiers
- Per-hour billing (rounded up)
- Not optimized for ML inference

**Cost Estimate (300 outlets):**
- 300 outlets × 10 inferences/outlet/day = 3,000 inferences/day
- At 1 second per inference, ~$0.10/vCPU-hour
- Monthly: ~$72/month for basic inference

### 2. Modal.com

**Pros:**
- Serverless-native, auto-scales to zero
- Per-second billing (no waste)
- Built-in GPU support (A100, H100)
- No cold starts (warm pools)
- Native Python SDK, minimal code changes
- Built-in batch inference support
- Secrets management

**Cons:**
- Requires code refactoring for Modal decorator pattern
- Python-only runtime
- Less control over infrastructure
- Vendor lock-in

**Cost Estimate (300 outlets):**
- 3,000 inferences/day × 2 seconds avg = 6,000 GPU-seconds/day
- At $0.0001/GPU-second (T4) = $0.60/day = $18/month
- With H100: ~$0.0009/GPU-second = $5.40/day = $162/month

### 3. Baseten

**Pros:**
- Purpose-built for ML inference
- Native support for transformers, ONNX, PyTorch
- Auto-scaling with warm instances
- Built-in model versioning
- Truss framework for easy deployment
- Good observability dashboard

**Cons:**
- More complex setup than Modal
- Less flexibility than raw containers
- Pricing can be unpredictable at scale

**Cost Estimate (300 outlets):**
- Similar to Modal, ~$30-100/month depending on model size

---

## Recommendation

### MVP Phase (0-50 outlets)

**Recommended: Modal.com**

Rationale:
1. **Lowest cost at low volume** - Pay-per-use means you're not paying for idle compute
2. **Fast cold starts** - Critical for responsive UX during early iteration
3. **Easy Python integration** - Minimal refactoring with Modal decorator pattern
4. **GPU support when needed** - Can start with CPU, upgrade to GPU seamlessly

Example deployment pattern:
```python
import modal

app = modal.App("cyberquote-ml")

@app.function(gpu="T4", timeout=60)
def classify_product_image(image_bytes: bytes) -> dict:
    # Your ML inference code
    model = load_model()
    return model.predict(image_bytes)
```

### Scale Phase (50-300 outlets)

**Recommended: Modal.com (continue) or Baseten**

Rationale for staying with Modal:
1. **Cost predictability** - Per-second billing scales linearly
2. **Operational consistency** - No migration needed
3. **Batch inference** - Can batch multiple outlet requests for efficiency

Rationale for switching to Baseten:
1. If you need advanced ML ops features (model versioning, A/B testing)
2. If your team grows and needs more DevOps tooling
3. If you need ONNX optimization for lower latency

---

## Implementation Plan

### Phase 1: MVP (Weeks 1-4)
```python
# backend/common/ml_inference.py
import modal

modal_app = modal.App("cyberquote-ml")

@modal_app.function(
    image=modal.Image.debian_slim()
        .pip_install(["torch", "transformers", "pillow"]),
    gpu="T4",
    timeout=60,
    memory=4096
)
def run_inference(image_bytes: bytes, task: str):
    # ML inference implementation
    pass
```

### Phase 2: Scale (Weeks 5-12)
- Add batch inference endpoint for bulk scraping results
- Implement caching layer with Redis for repeated queries
- Consider ONNX conversion for 2-3x latency reduction

---

## Final Recommendation

| Phase | Outlets | Recommended Platform | Est. Monthly Cost |
|-------|---------|----------------------|-------------------|
| MVP | 0-50 | Modal.com | $30-50 |
| Growth | 50-150 | Modal.com | $80-150 |
| Scale | 150-300 | Modal.com or Baseten | $150-400 |

**Winner: Modal.com** for MVP due to:
- Best price/performance at low volume
- Fastest time to deployment
- Python-native and developer-friendly
- Scales efficiently to 300 outlets

---

## Next Steps

1. Set up Modal account and configure credentials
2. Create Modal app with initial ML endpoints
3. Integrate with FastAPI backend
4. Set up monitoring and alerting
5. Benchmark performance and optimize
