/**
 * Keeps report status in sync with team assignments (automated tracking).
 */
function syncReportStatus(report) {
  if (report.status === 'resolved') return report;

  const teamCount = (report.assignedTeams || []).length;

  if (teamCount === 0) {
    if (report.status !== 'in-progress') {
      report.status = 'pending';
    }
    report.claimedBy = null;
    return report;
  }

  if (report.status === 'pending') {
    report.status = 'claimed';
  }

  if (!report.claimedBy && report.assignedTeams[0]) {
    report.claimedBy = report.assignedTeams[0];
  }

  return report;
}

module.exports = { syncReportStatus };
