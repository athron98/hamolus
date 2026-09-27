// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `allowedDevOrigins` so the site can be opened over `mac.lan` from other devices on the
  // same network. Next's built-in origin protection rejects other LAN hosts, and the
  // symptom looks like "the page does not load" with no message to explain it.
  //
  // The key sits at the top level on purpose: `experimental` is a strict object, and
  // Next 15.5 rejects an unknown key in it outright.
  allowedDevOrigins: ['mac.lan', '10.20.40.90'],
}

export default nextConfig
