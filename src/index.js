const AASA = JSON.stringify({
  applinks: {
    details: [
      {
        appIDs: ["FDT7YQMSWR.com.bob.TripButler"],
        components: [
          { "/": "/rcr-preview", exclude: true },
          { "/": "/rcr-preview/*", exclude: true },
          { "/": "/invite" },
          { "/": "/invite/*" },
          { "/": "/auth/callback" }
        ]
      }
    ]
  }
});

const INVITE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TripButler Invite</title>
  <meta name="robots" content="noindex" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; }
    .card { width: min(560px, calc(100vw - 32px)); padding: 32px 24px; background: #fff; border-radius: 20px; box-shadow: 0 18px 60px rgba(0,0,0,.10); }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.1; }
    p { margin: 0 0 16px; color: #4b5563; line-height: 1.5; }
    a.button { display: inline-block; padding: 14px 20px; border-radius: 999px; background: #111827; color: #fff; text-decoration: none; font-weight: 600; }
    .secondary { margin-top: 16px; font-size: 13px; color: #6b7280; }
    .secondary a { color: #111827; }
  </style>
</head>
<body>
  <main class="card">
    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 12px;">TripButler</p>
    <h1>Accept your trip invite</h1>
    <p>Tap below to continue in TripButler. If the app is already installed, it should open after you tap the button. If not, install TripButler first and return to this invite link to continue.</p>
    <p><a class="button" href="tripbutler://invite">Open in TripButler</a></p>
    <p><a href="https://apps.apple.com/us/search?term=TripButler">Install TripButler</a></p>
    <div class="secondary">Invite link: https://ripcurrentworks.com/invite</div>
  </main>
</body>
</html>`;

const AUTH_CALLBACK_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authentication Complete</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b1e33;
        color: white;
      }
      .card {
        max-width: 520px;
        padding: 32px;
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0;
        color: rgba(255,255,255,0.78);
        font-size: 17px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Authentication complete</h1>
      <p>You can return to the app.</p>
    </main>
  </body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "biteiq.ripcurrentworks.com") {
      const assetUrl = new URL(url);
      assetUrl.pathname = url.pathname.startsWith("/biteiq/")
        ? url.pathname
        : `/biteiq${url.pathname}`;
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    if (url.pathname === "/apple-app-site-association" || url.pathname === "/.well-known/apple-app-site-association") {
      return new Response(AASA, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/invite" || url.pathname === "/invite/") {
      return new Response(INVITE_HTML, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/auth/callback") {
      return new Response(AUTH_CALLBACK_HTML, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
