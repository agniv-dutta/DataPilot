# DataPilot architecture

## Components

```mermaid
flowchart LR
    Browser["React + Vite SPA<br/>(Tailwind, Recharts)"] -- "REST + SSE (/api)" --> API

    subgraph Backend["FastAPI backend"]
        API["api/ routes"] --> SVC["services/ logic"]
        SVC --> CORE["core/ config, LLM, sandbox"]
    end

    SVC --> Store["SessionStore<br/>(datasets, history, cache)"]
    SVC --> Agent["AnalystAgent<br/>(tool-calling loop)"]
    Agent --> LLM["LLM provider<br/>(Groq, OpenAI-compatible)"]
    Agent --> Sandbox["Sandbox<br/>read-only DuckDB + AST checked pandas"]
    Sandbox --> Store
    Agent -- "SSE events" --> Browser
```

## One chat request

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as FastAPI API
    participant G as AnalystAgent
    participant L as LLM provider
    participant S as Sandbox
    B->>A: POST /api/sessions/{id}/chat
    A-->>B: Open text/event-stream response
    A->>G: Start agent with message and session
    G-->>B: status event (via API stream)
    G->>L: Prompt, context, and available tools
    L-->>G: Tool call or final answer
    G->>S: Validated SQL or restricted pandas code
    S-->>G: Capped result or sandbox error
    G->>L: Tool result for grounded answer
    L-->>G: Final structured answer
    G-->>A: final event
    A-->>B: SSE final event
```

The synchronous `/chat/sync` route uses the same agent loop and returns JSON. In-memory
session state is local to one backend process.
