import os
config = {}
with open('/Users/weskonek/WeskonekWeb/CQaiFrh/CQaifranchise/.env.local') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            config[k] = v
print(config.get('SUPABASE_SERVICE_ROLE_KEY', ''))
