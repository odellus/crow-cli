#!/usr/bin/env python3
"""
Mock ACP Agent for testing.

This simple agent responds to JSON-RPC chat requests with echo responses.
It reads from stdin and writes to stdout, following the ACP protocol.
"""

import sys
import json


def main():
    """Process JSON-RPC messages from stdin."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)

            # Handle JSON-RPC request
            if request.get("method") == "chat":
                message = request.get("params", {}).get("message", "")
                response = {
                    "jsonrpc": "2.0",
                    "result": {
                        "response": f"Echo: {message}",
                        "type": "text"
                    },
                    "id": request.get("id")
                }
            else:
                response = {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {request.get('method')}"
                    },
                    "id": request.get("id")
                }

            print(json.dumps(response), flush=True)

        except json.JSONDecodeError:
            error = {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                },
                "id": None
            }
            print(json.dumps(error), flush=True)


if __name__ == "__main__":
    main()
