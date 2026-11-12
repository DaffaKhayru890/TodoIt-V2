from __future__ import annotations

import socket
import sys
import time


def wait_for_database(host: str, port: int, timeout: int = 30) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"Database available at {host}:{port}")
                return
        except OSError:
            time.sleep(1)
    raise SystemExit(f"Timed out waiting for database at {host}:{port}")


if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "localhost"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 5432
    wait_for_database(host, port)
