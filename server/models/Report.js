export const reportStatuses = ['Pending', 'Under Review', 'Action Taken', 'Rejected'];
export const vehicleTypes = ['Car', 'Motorcycle', 'Truck', 'Auto-rickshaw', 'Construction vehicle'];
export const violationTypes = ['Excessive honking', 'Loud music', 'Construction noise', 'Vehicle revving'];
export const zoneTypes = ['Residential', 'Silent zone - Hospital', 'Silent zone - School', 'Commercial'];

export function normalizeReport(data) {
  return {
    referenceId: data.referenceId,
    submittedAt: data.submittedAt ? new Date(data.submittedAt).toISOString() : new Date().toISOString(),
    location: {
      latitude: Number(data.location?.latitude),
      longitude: Number(data.location?.longitude),
      address: data.location?.address || ''
    },
    videoUrl: data.videoUrl,
    storagePath: data.storagePath || '',
    vehicleType: data.vehicleType,
    violationType: data.violationType,
    zoneType: data.zoneType,
    noiseLevel: Number(data.noiseLevel),
    description: data.description || '',
    status: data.status || 'Pending',
    assignedOfficer: data.assignedOfficer || '',
    notes: data.notes || '',
    citizenContact: data.citizenContact || ''
  };
}
