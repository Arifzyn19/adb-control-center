export default defineApi(async () => {
  const config = useRuntimeConfig()
  return {
    adbPath: config.adbPath,
    serverPort: config.adbServerPort,
    maxDevices: config.maxDevices,
    logcatMaxBuffer: config.logcatMaxBuffer,
    nodeVersion: process.version,
    platform: process.platform,
  }
})