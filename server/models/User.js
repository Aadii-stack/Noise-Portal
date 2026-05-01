export function getOfficerUser() {
  return {
    id: 'officer-demo',
    email: process.env.OFFICER_EMAIL || 'officer@mumbaipolice.local',
    password: process.env.OFFICER_PASSWORD || 'ChangeMe123!',
    role: 'authority'
  };
}
