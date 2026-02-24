import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { data, context = {} } = req.body;
  if (!data) {
    return res.status(400).json({ success: false, error: 'data is required' });
  }
  const executionId = uuidv4();
  // Simple pass-through workflow: trigger -> process -> respond
  const result = { ...data, processed: true, processed_at: new Date().toISOString() };
  res.status(200).json({
    success: true,
    data: { execution_id: executionId, result, started_at: new Date().toISOString() },
  });
}
