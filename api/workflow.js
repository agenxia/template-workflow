export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: {
        steps: [
          { id: 'trigger-1', type: 'trigger', name: 'HTTP Trigger', connections: ['action-1'] },
          { id: 'action-1', type: 'action', name: 'Process Data', connections: ['condition-1'] },
          { id: 'condition-1', type: 'condition', name: 'Check Result', connections: ['response-ok', 'response-err'] },
          { id: 'response-ok', type: 'action', name: 'Success', connections: [] },
          { id: 'response-err', type: 'action', name: 'Error', connections: [] },
        ],
      },
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
