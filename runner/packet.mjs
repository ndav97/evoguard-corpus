export function makePacket(data, version) {
  if (!['V0','V1','V2','V3'].includes(version)) throw new Error('versión no admitida');
  const index = Number(version.slice(1));
  const turn = index ? data.turns.find(t=>t.to_version===version) : null;
  const active = turn ? turn.active_after : data.family.pilot.initial_requirements;
  const requirements = active.map(id => {
    const r = data.requirements.find(r=>r.id===id);
    if (!r) throw new Error(`Requisito no encontrado: ${id}`);
    // Allowlist: no serializar manifiestos, procedencia, providers o campos futuros.
    return {id:r.id,description:r.description,acceptance:r.acceptance.map(a=>({id:a.id,description:a.description}))};
  });
  return {
    family_id: 'F001', version,
    prompt: `${data.prompts.common}\n${data.prompts[index ? 'evolve-turn' : 'generate-v0']}`,
    request: turn ? turn.request : 'Construye el catálogo cumpliendo R001 y R002.',
    requirements,
    products: data.products.map(p=>({id:p.id,name:p.name,category:p.category,price:p.price}))
  };
}

export function makeRepairPrompt(data, feedback, attempt) {
  if (![2,3].includes(attempt)) throw new Error('intento de reparación inválido');
  if (!['build','typecheck','development_tests'].includes(feedback.source)) throw new Error('Solo feedback visible de desarrollo');
  if (typeof feedback.text !== 'string') throw new Error('Feedback debe ser texto');
  return `${data.prompts.repair}\nIntento ${attempt}/3.\nFeedback visible (${feedback.source}):\n${feedback.text}`;
}
