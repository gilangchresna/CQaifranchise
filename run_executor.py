import urllib.request
import json
import os

# Read the service role key
service_key = None
env_path = '/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local'
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            service_key = line.split('=', 1)[1]
            break

if not service_key:
    print('ERROR: SUPABASE_SERVICE_ROLE_KEY not found')
    exit(1)

print(f'Key length: {len(service_key)} chars')

url = 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/executor-cron'

req = urllib.request.Request(url, method='POST')
req.add_header('Authorization', f'Bearer {service_key}')
req.add_header('Content-Type', 'application/json')

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode()
        status = resp.status
        print(f'HTTP {status}')
        print(body)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f'HTTP {e.code}')
    print(body)
except Exception as e:
    print(f'ERROR: {e}')
