---
tags: [relay, network, ssh]
---

# 07 Relay & Network

The autochecker runs on a public host (Hetzner). Student VMs are often on internal university subnets (`10.x.x.x`) that aren't reachable from the public internet. The relay worker bridges this gap.

## Network topology

```
┌─ DEPLOY HOST (public internet) ────────────────────────────┐
│                                                            │
│  Bot + Dashboard containers                                │
│    engine.py dispatches SSH/HTTP jobs                      │
│                                                            │
│    Direct path (public IPs):                               │
│      ssh -i /app/ssh_key user@<public-ip>                  │
│      curl http://<public-ip>/...                           │
│                                                            │
│    Indirect path (internal IPs):                           │
│      POST /relay/ssh  or  /relay/check                     │
│        → dashboard routes job over WebSocket              │
└────────────────────────┬───────────────────────────────────┘
                         │  wss://$DASHBOARD/relay/ws
                         │
┌─ UNIVERSITY NETWORK (10.93.x.x/24) ─────────────────────────┐
│                                                             │
│  Relay worker (systemd service on a small VM)               │
│    relay/worker.py                                          │
│    connects out to the dashboard WebSocket                  │
│    receives jobs, executes locally, returns results         │
│                                                             │
│    SSH jobs:  ssh -i ~/.ssh/autochecker_ed25519 ...         │
│    HTTP jobs: curl ...                                      │
│                                                             │
│    Only allows hosts matching:                              │
│      10.x.x.x | 172.16-31.x.x | 192.168.x.x                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
             ┌─────────────────────────────┐
             │  Student VMs (internal IPs) │
             └─────────────────────────────┘
```

## IP-based routing

The engine makes the public-vs-internal decision per check:

| Student IP | Path | SSH key location |
|-----------|------|------------------|
| Internal (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`) | Engine → Dashboard `/relay/ssh` → WebSocket → Relay worker → Student VM | Relay VM: `~/.ssh/autochecker_ed25519` |
| Public (anything else) | Engine → direct `ssh` subprocess from the bot container | Bot container: `/app/ssh_key` (mounted from host `~/autochecker-ssh-key`) |

The routing logic lives in `autochecker/engine.py`:

```python
# simplified
if not host.startswith("10."):
    return self._direct_ssh(host, port, username, command, timeout)
# else → relay path
```

## Direct SSH (public IPs)

The bot container needs:

- `openssh-client` installed (in `deploy/Dockerfile`)
- The private key mounted at `/app/ssh_key` (in `deploy/docker-compose.yml` via `${SSH_KEY_PATH:?}:/app/ssh_key:ro`)

The public key (shared with students so they can put it in their VM's `authorized_keys` for the `autochecker` user) is:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKiL0DDQZw7L0Uf1c9cNlREY7IS6ZkIbGVWNsClqGNCZ se-toolkit-autochecker
```

The private key is never committed. It lives on the deploy host as `~/autochecker-ssh-key` and on the relay VM as `~/.ssh/autochecker_ed25519`.

## Relay WebSocket protocol

The relay worker connects out to `wss://<dashboard>/relay/ws`. On connect:

1. Worker sends: `{"type": "auth", "token": "<RELAY_TOKEN>"}`
2. Dashboard replies: `{"type": "auth_ok"}`
3. Either side can close at any time; worker auto-reconnects after 5 s

After auth, every message from dashboard to worker is a job:

```json
// HTTP job
{"type": "http", "job_id": "<uuid>", "url": "...", "method": "GET", "headers": {...}, "body": null, "timeout": 10}

// SSH job
{"type": "ssh", "job_id": "<uuid>", "host": "10.93.1.5", "port": 22, "username": "autochecker", "command": "echo ok", "timeout": 10}
```

Every message from worker to dashboard is a result:

```json
// HTTP result
{"job_id": "<uuid>", "status_code": 200, "body": "...", "error": ""}

// SSH result
{"job_id": "<uuid>", "exit_code": 0, "stdout": "...", "stderr": "...", "error": ""}
```

## Worker safety

`relay/worker.py` enforces several constraints:

- **Internal-IP allowlist** — refuses any URL or host that doesn't match the internal ranges
- **Timeout cap** — per-job timeout capped at 300 seconds (though most callers request 10–30 s)
- **Stdout cap** — 65 536 bytes from the start of stdout; stderr capped at 4 096 bytes. **Always truncate from the start**: a tail-truncation bug dropped the leading `{` of agent eval JSON output (see [[13 Gotchas]])
- **SSH options** — `StrictHostKeyChecking=no`, `UserKnownHostsFile=/dev/null` (student VMs are ephemeral)

## Concurrency

The relay worker uses a fire-and-forget model:

```python
async for raw in ws:
    job = json.loads(raw)
    asyncio.create_task(_handle_job(ws, job))
```

This is critical — a single slow SSH job must not block the WebSocket read loop for every other student. The previous serial version caused cascading timeouts during peak lab-06 sessions.

Each job runs in the default thread-pool executor (`loop.run_in_executor(None, _do_ssh_check, job)`) so `subprocess.run` doesn't block the event loop.

## Resilience

Three layers of retry handle unstable university network conditions:

- **Worker** — auto-reconnects every 5 s on disconnect; WebSocket ping every 20 s with 30 s timeout
- **Dashboard** — `_send_relay_job()` waits up to 12 s for a reconnected worker, retries once on timeout or stale connection, returns 503 on final failure
- **Engine** — `_ssh_check_via_relay()` and `_http_check_via_relay()` retry on 503/504 with 6 s backoff

## Health checking the relay

`/relay/status` is unreliable as a liveness signal (a bug in dashboard state-tracking caused false negatives; see [[13 Gotchas]]). Use a real SSH job instead:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $RELAY_TOKEN" \
  -d '{"host":"$RELAY_VM_IP","port":22,"username":"deploy","command":"echo ok","timeout":5}' \
  $DASHBOARD_URL/relay/ssh \
| grep '"exit_code":0'
```

## Deploying the relay

The relay worker runs as a systemd service on a VM inside the internal subnet. It is **not** auto-deployed from CI; changes to `relay/worker.py` require a manual scp + systemctl restart:

```bash
scp relay/worker.py root@$RELAY_VM_IP:/opt/relay/worker.py
ssh root@$RELAY_VM_IP systemctl restart relay-worker
```

Required env vars on the relay VM:

| Variable | Purpose |
|----------|---------|
| `RELAY_TOKEN` | Shared secret with the dashboard |
| `RELAY_URL` | WebSocket URL, e.g. `wss://your-dashboard/relay/ws` |
| `SSH_KEY_PATH` | Private key path (default `~/.ssh/autochecker_ed25519`) |

## Known limitation — one subnet per relay

The relay worker can only reach the subnet it's deployed on. Students on different internal subnets (e.g. the relay is on `10.93.x.x` but a student is on `10.90.x.x`) cannot be reached. For those students, deployment checks must be marked done manually via the dashboard's **Mark as done** button or a direct SQL update.

## Related notes

- [[02 Architecture]] — overall topology
- [[06 Dashboard]] — relay endpoints and WebSocket state
- [[13 Gotchas]] — the worker-clearing timeout bug, the stdout tail-truncation bug, the health-check loop
- [[09 Deployment]] — SSH key setup, `SSH_KEY_PATH` mount
