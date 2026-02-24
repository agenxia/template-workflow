export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.status(200).json({
    success: true,
    data: {
      agent_name: process.env.AGENT_NAME || '{{AGENT_NAME}}',
      version: process.env.API_VERSION || 'v1',
      status: 'running',
      timestamp: new Date().toISOString(),
      workflow_engine: { status: 'active', timeout: parseInt(process.env.WORKFLOW_TIMEOUT) || 300000 },
      features: { workflow_execution: true, http_triggers: true, conditional_logic: true },
    },
  });
}
