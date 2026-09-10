# Token Pump Engine — Cloud Deploy (GitHub → Cloud Build → Cloud Run + App Hosting)
#
# 1. Secrets (create once):
#   echo -n "mongodb+srv://..." | gcloud secrets create mongo-url --data-file=-
#   python -c "import json; print(json.dumps([11,22] + [0]*62))"  # placeholder shape only —
#   put the REAL 64-int hot-wallet secret here:
#   echo -n '[...64 ints...]' | gcloud secrets create executor-secret-key --data-file=-
#   python -c "import secrets; print(secrets.token_hex(32))" | gcloud secrets create node-api-key --data-file=-
#   echo -n "https://<cloud-run-url>" | gcloud secrets create backend-url --data-file=-
#
# 2. Artifact Registry + Build trigger (GitHub-connected):
#   gcloud artifacts repositories create pump-engine --repository-format=docker --location=us-central1
#   gcloud builds triggers create github --repo-owner=yabbiebass-debug --repo-name=token-pump-engine \
#     --branch-pattern=^main$ --build-config=cloudbuild.yaml
#
# 3. Push → trigger fires → backend lands on Cloud Run (min-instances=1 so the
# scheduler never sleeps), frontend builds with REACT_APP_BACKEND_URL baked in.
#
# 4. AI Studio app: Firebase console → App Hosting → link this repo, root dir
# `frontend`, env REACT_APP_BACKEND_URL = the Cloud Run URL. Redeploys on push.
#
# 5. Verify: curl $BACKEND/api/executor/status → {"enabled": true, hot_wallet: "HTN1fv…"}.
#    Fund the hot wallet above min_wallet_balance_sol, watch /flywheel/status.
