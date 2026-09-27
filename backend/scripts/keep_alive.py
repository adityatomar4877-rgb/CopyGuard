"""Keep-alive script — ping the backend every 5 minutes so Railway doesn't sleep.

Run this on your machine in the background, or deploy it on a free service
like cron-job.org, UptimeRobot, etc. Just hit the /health endpoint.

Usage:
    python keep_alive.py
    python keep_alive.py --url https://your-app.up.railway.app --interval 300
"""

import argparse
import logging
import time
import urllib.request

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
log = logging.getLogger("keepalive")


def ping(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        log.error("Ping failed: %s", e)
        return False


def main():
    parser = argparse.ArgumentParser(description="Keep CopyGuard backend alive.")
    parser.add_argument("--url", default="https://copyguard-backend-production-f05e.up.railway.app/health",
                        help="Health endpoint URL")
    parser.add_argument("--interval", type=int, default=300,
                        help="Seconds between pings (default: 300 = 5 min)")
    args = parser.parse_args()

    log.info("Keep-alive started: %s every %ss", args.url, args.interval)

    while True:
        ok = ping(args.url)
        if ok:
            log.info("OK — backend is awake")
        else:
            log.warning("FAIL — backend may be sleeping or down")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
