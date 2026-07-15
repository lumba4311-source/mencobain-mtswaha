import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Matikan telemetry — tidak ada request ke internet saat build/runtime
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};

export default nextConfig;
