#!/bin/sh
# Post-build step for Vercel: packages the Vite output and TBA proxy function
# into the Vercel Build Output API v3 format.

set -e

# 1. Set up the Build Output API directory structure
rm -rf .vercel/output
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api/tba.func

# 2. Copy static files from Vite build
cp -r dist/* .vercel/output/static/

# 3. Create the serverless function bundle (ESM)
cp api/tba/\[...path\].js .vercel/output/functions/api/tba.func/index.mjs

# Write the function config
cat > .vercel/output/functions/api/tba.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs22.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs"
}
EOF

# 4. Write the output config with routing
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/tba(?:/(.*))?" , "dest": "/api/tba" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

echo "✓ Vercel Build Output ready"
