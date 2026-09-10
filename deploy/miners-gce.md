# Mining workers on Google Cloud — honest setup notes, read before spending.
#
# REALITY CHECK (priced 2026): Cloud CPU/GPU hash rental costs MORE than the
# XMR/RVN/ETC it mines. unMineable payouts to the treasury wallet will be a
# trickle next to the 85-SOL bonding curve. Run workers for decentralization
# and baseline flow, NOT as the funding source. Funding = deposits + rebuys.
#
# Option A — cheap + honest (recommended): one e2-small GCE spot VM per worker.
#   gcloud compute instances create miner-1 \
#     --zone=us-central1-a --machine-type=e2-small \
#     --provisioning-model=SPOT --instance-termination-action=DELETE \
#     --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
#     --metadata=startup-script='#!/bin/bash
#       apt-get update -qq && apt-get install -y -qq xmrig >/dev/null 2>&1 || snap install xmrig
#       xmrig -o rx.unmineable.com:3333 -a rx -k \
#         -u SOL:HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i.miner-1 -p x &'
#   Pool dashboard: https://unmineable.com/coins/SOL/address/HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i
#   Payouts land on-chain → backend /api/mining/status picks them up →
#   mining_share_pct flows into the buyback reserve automatically.
#
# Option B — executor nodes (the actual pump path): each node is a Cloud Run
# job running backend/node_runner.py, registering to the leader backend:
#   gcloud run jobs create node-1 --image=$LEADER_IMAGE --region=us-central1 \
#     --set-env-vars=LEADER_URL=https://pump-engine-backend-xxx.a.run.app,NODE_ID=node-1,NODE_WALLET=<node-pubkey>,NODE_CAPACITY_SOL=0.25 \
#     --set-secrets=NODE_API_KEY=node-api-key:latest
#   gcloud scheduler jobs create http node-1-heartbeat --schedule="* * * * *" \
#     --uri="https://pump-engine-backend-xxx.a.run.app/api/nodes/heartbeat" --http-method=POST
#
# Option C — what NOT to do: mine BTC on Cloud GPUs, run validators on spot
# VMs, or hold EXECUTOR_SECRET_KEY on a miner box. Keys live ONLY in the
# leader's Secret Manager + Cloud Run revision.
