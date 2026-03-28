export default async function process(inputs, { llm, config, workflow }) {
  const { input, step_override } = inputs;
  if (!input) return { output: null, steps: [], error: 'No input provided' };

  const steps = [];

  // Step 1: Validate input
  steps.push({ name: 'validate', status: 'ok', data: input });

  // Step 2: Transform (LLM or passthrough)
  let transformed = input;
  if (llm) {
    const result = await llm.chat([
      { role: 'user', content: `Process this workflow input and return a structured result: ${JSON.stringify(input)}` }
    ]);
    transformed = result.content;
    steps.push({ name: 'transform', status: 'ok', data: transformed });
  } else {
    steps.push({ name: 'transform', status: 'skipped', reason: 'no LLM configured' });
  }

  // Step 3: Output
  steps.push({ name: 'output', status: 'ok' });

  return { output: transformed, steps };
}