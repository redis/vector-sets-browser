/** @type {import('next').NextConfig} */
const nextConfig = {
    // Indicate that these packages should not be bundled by webpack
    serverExternalPackages:  ['sharp', 'onnxruntime-node']
};

export default nextConfig;
