---
name: deploy
description: Test, sync and redeploy the bus system to the Docker server behind demo.promptjang.com
disable-model-invocation: true
---

Deploy the current local code to the production server. Stop and report at the first failing step.

1. Run `npm run lint` and `npm test` from the project root. If lint reports errors or any phase fails, stop and show the failure. Do not deploy.
2. Sync code to the server (never send or delete the server's `.env` or runtime data):
   ```
   rsync -az --delete --exclude='.git' --exclude='node_modules' --exclude='backend/data/runtime/*' --exclude='.env' ./ cs31@100.104.87.92:~/bus-system/
   ```
3. Rebuild and restart only this project:
   ```
   ssh cs31@100.104.87.92 'cd ~/bus-system && docker compose up -d --build'
   ```
4. Verify on the server (wait up to ~40s for the healthcheck):
   ```
   ssh cs31@100.104.87.92 'cd ~/bus-system && docker compose ps && docker compose logs --tail 20 && curl -fsS localhost:3100/api/network'
   ```
   The container must be `healthy` and `/api/network` must return JSON.
5. Verify the public site: `curl -fsS -o /dev/null -w '%{http_code}\n' https://demo.promptjang.com/` should print 200. If it fails but step 4 passed, the problem is the Cloudflare Tunnel public hostname (configured in the Cloudflare dashboard), not the app.
6. Report: tests passed, container status, network source (`osrm` or `estimate`), and public URL status.

Extra instructions from the user, if any: $ARGUMENTS
