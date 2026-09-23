ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=180000
ENV npm_config_audit=false npm_config_fund=false
COPY deps/package.json deps/package-lock.json /opt/deps/
RUN cd /opt/deps && npm ci --cache /opt/npm-cache && chmod -R a+rX /opt/deps /opt/npm-cache
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && node /opt/deps/node_modules/playwright/cli.js install --with-deps --only-shell chromium && rm -rf /var/lib/apt/lists/*
COPY init.mjs /opt/evoguard/
RUN mkdir -p /workspace && chown 1000:1000 /workspace && node --version && npm --version && git --version && dpkg-query -W > /opt/evoguard/system-packages.txt
USER 1000:1000
WORKDIR /workspace
CMD ["sleep", "infinity"]
