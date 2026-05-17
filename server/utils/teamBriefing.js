function normalizeResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources
    .filter((r) => r?.name?.trim())
    .map((r) => ({
      name: String(r.name).trim(),
      category: r.category || 'Other',
      quantity: Math.max(0, Number(r.quantity) || 1),
      source: ['ngo_stock', 'provider', 'other'].includes(r.source) ? r.source : 'other',
      sourceLabel: (r.sourceLabel || '').trim(),
    }));
}

function upsertTeamBriefing(report, teamId, { instructions, resources }) {
  report.teamBriefings = report.teamBriefings || [];
  const teamIdStr = teamId.toString();
  const idx = report.teamBriefings.findIndex(
    (b) => b.team.toString() === teamIdStr
  );
  const entry = {
    team: teamId,
    instructions: (instructions || '').trim(),
    resources: normalizeResources(resources),
    updatedAt: new Date(),
  };
  if (idx >= 0) {
    report.teamBriefings[idx] = entry;
  } else {
    report.teamBriefings.push(entry);
  }
  return report;
}

function removeTeamBriefing(report, teamId) {
  const teamIdStr = teamId.toString();
  report.teamBriefings = (report.teamBriefings || []).filter(
    (b) => b.team.toString() !== teamIdStr
  );
  return report;
}

function getTeamBriefing(report, teamId) {
  const teamIdStr = teamId.toString();
  return (report.teamBriefings || []).find((b) => b.team.toString() === teamIdStr);
}

module.exports = {
  normalizeResources,
  upsertTeamBriefing,
  removeTeamBriefing,
  getTeamBriefing,
};
