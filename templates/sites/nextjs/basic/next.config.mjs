// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `allowedDevOrigins` so the site can be opened from another device on the same network.
  // Next's built-in origin protection rejects hosts it does not know, and the symptom looks
  // like "the page does not load" with no message to explain it. The value is the same
  // address the core's dev server binds to (`DEV_HOST` at create time).
  //
  // The key sits at the top level on purpose: `experimental` is a strict object, and
  // Next 15.5 rejects an unknown key in it outright.
  allowedDevOrigins: ['{{DEV_HOST}}'],
}

export default nextConfig
