# {{AGENT_NAME}}

{{AGENT_DESCRIPTION}}

## Endpoints

- `GET /api/status` — Agent health + workflow engine status
- `POST /api/start` — Start a workflow execution
- `GET /api/workflow` — Get workflow configuration

## Environment Variables

| Variable | Description |
|----------|-------------|
| AGENT_NAME | Name of the agent |
| API_VERSION | API version |
| WORKFLOW_TIMEOUT | Max execution time in ms (default: 300000) |
| MAX_RETRIES | Max retry attempts (default: 3) |
