import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema privado: não deixar buscadores indexarem nenhuma página.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
