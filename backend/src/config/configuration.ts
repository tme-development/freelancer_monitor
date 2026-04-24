export default () => ({
  database: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    username: process.env.MYSQL_USER || 'project_manager',
    password: process.env.MYSQL_PASSWORD || 'changeme_in_production',
    database: process.env.MYSQL_DATABASE || 'project_manager',
  },
  mcp: {
    ollamaUrl: process.env.OLLAMA_MCP_URL || 'http://localhost:3100',
    playwrightUrl: process.env.PLAYWRIGHT_MCP_URL || 'http://localhost:3200',
  },
  freelancermap: {
    searchUrl:
      process.env.FREELANCERMAP_SEARCH_URL ||
      'https://www.freelancermap.de/projekte',
    baseUrl:
      process.env.FREELANCERMAP_BASE_URL || 'https://www.freelancermap.de',
  },
  polling: {
    intervalMinutes: parseInt(process.env.POLLING_INTERVAL_MINUTES, 10) || 30,
  },
  matching: {
    thresholdApplication:
      parseFloat(process.env.MATCHING_THRESHOLD_APPLICATION) || 40,
    thresholdVeryHigh:
      parseFloat(process.env.MATCHING_THRESHOLD_VERY_HIGH) || 85,
    weightDirect: parseFloat(process.env.WEIGHT_DIRECT) || 1.0,
    weightAlternative: parseFloat(process.env.WEIGHT_ALTERNATIVE) || 0.5,
    weightMustHave: parseFloat(process.env.WEIGHT_MUST_HAVE) || 2.0,
    weightNiceToHave: parseFloat(process.env.WEIGHT_NICE_TO_HAVE) || 1.0,
  },
  alertAudioFile: process.env.ALERT_AUDIO_FILE || '/data/audio/alert.mp3',
});
