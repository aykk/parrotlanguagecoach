import type { NextConfig } from "next";

const nextConfig = {
  transpilePackages: [
    "@mediapipe/face_mesh",
    "@mediapipe/drawing_utils",
    "@mediapipe/camera_utils",
  ],
};
module.exports = nextConfig;

