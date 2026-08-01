---
name: Pipeline Traces Viewer
description: Tabella pipeline_traces + helper _shared/pipelineTrace.ts + pagina /v2/pipeline-traces. Timeline cronologica passo-passo di ogni procedura (email, contatti, missioni). Realtime live, vista per trace_id, aggregato per step. Wireup minimo: classify-inbound-message (4 step) e funnemail-auto-route (start). Trace_id deterministico = message_id per correlare. Tracer fail-safe: errori swallowed, mai blocca pipeline reale.
type: feature
---
