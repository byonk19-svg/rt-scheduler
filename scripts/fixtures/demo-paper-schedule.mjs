// Modeled from the photographed Respiratory Therapy paper schedule labeled
// "May 3, 2026 - June 13, 2026". The image is a real-world staffing grid, so
// keep this fixture readable and easy to correct after a manual transcription pass.

export const DEMO_PAPER_SCHEDULE = {
  label: 'RT Paper Demo May 3-Jun 13 2026',
  siteId: 'paper-rt-demo',
  startDate: '2026-05-03',
  endDate: '2026-06-13',
  password: 'Teamwise123!',
  emailDomain: 'paper-demo.teamwise.test',
  manager: {
    fullName: 'Paper Demo Manager',
    email: 'paper-demo-manager@paper-demo.teamwise.test',
  },
  tokenLegend: {
    '.': 'Blank cell on the paper schedule.',
    1: 'Scheduled working cell.',
    H: 'Highlighted/confirmed working cell from the paper schedule.',
    '*': 'Unavailable / need-off / PTO-style marker.',
    N: 'Night-specific assignment marker.',
  },
  // Top subtotal row from the paper schedule. These are used as non-failing
  // sanity checks because exact cell transcription from the photo may need review.
  dayStaffingTargets: [
    3, 2, 4, 3, 4, 3, 2, 2, 3, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 4, 4, 3, 3, 2, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 4, 3, 2, 3,
  ],
  // Bottom total row from the paper schedule.
  combinedStaffingTargets: [
    3, 3, 4, 3, 4, 4, 3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 4, 4, 3, 4, 3, 4, 4, 3, 3,
    3, 4, 4, 4, 4, 3, 4, 3, 3, 4,
  ],
  staff: [
    {
      fullName: 'Adrienne',
      email: 'paper-demo-adrienne@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['.', '1', '.', 'H', '*', '.', 'H'],
        ['H', '.', '.', '.', 'H', '*', 'H'],
        ['.', 'H', '.', 'H', '*', '.', 'H'],
        ['H', '.', '1', '.', '*', '1', '.'],
        ['.', '.', '1', 'H', '*', '.', '1'],
        ['1', '.', '.', '1', '*', 'H', '.'],
      ],
    },
    {
      fullName: 'Kim',
      email: 'paper-demo-kim@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['H', '*', '*', '*', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.'],
      ],
    },
    {
      fullName: 'Brianna',
      email: 'paper-demo-brianna@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['.', '.', '1', '.', 'H', 'H', '.'],
        ['*', 'H', '.', '.', 'H', 'H', '*'],
        ['H', '*', 'H', '.', 'H', 'H', '.'],
        ['*', 'H', '.', '.', '.', 'H', 'H'],
        ['H', '.', '.', '.', 'H', 'H', '*'],
        ['.', '*', 'H', 'H', '.', '.', 'H'],
      ],
    },
    {
      fullName: 'Barbara',
      email: 'paper-demo-barbara@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['*', 'H', 'H', '*', '*', 'N', 'N'],
        ['.', '.', 'H', '*', '*', '*', '*'],
        ['*', '*', '*', '*', '*', '*', '*'],
        ['*', '.', 'H', 'H', 'H', '.', '.'],
        ['.', 'H', 'H', '.', '.', 'H', '.'],
        ['H', 'H', '.', '.', 'H', '.', '.'],
      ],
    },
    {
      fullName: 'Layne',
      email: 'paper-demo-layne@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['1', '.', '1', '1', '*', '.', '.'],
        ['.', '.', '1', '1', '*', '.', '1'],
        ['1', '.', '1', '1', '*', '.', '.'],
        ['.', '.', '1', '1', '*', '.', '1'],
        ['1', '.', '1', '1', '*', '.', '.'],
        ['.', '.', '1', '1', '.', '.', '1'],
      ],
    },
    {
      fullName: 'Tannie',
      email: 'paper-demo-tannie@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['.', '.', '.', '.', '1', '1', '1'],
        ['1', '.', '1', '1', '.', '.', '.'],
        ['.', '.', '.', '.', '1', '1', '1'],
        ['1', '.', '1', '1', '.', '.', '.'],
        ['.', '.', '.', '.', '1', '1', '1'],
        ['1', '.', '1', '1', '.', '.', '.'],
      ],
    },
    {
      fullName: 'Aleyce',
      email: 'paper-demo-aleyce@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['*', '*', '1', '.', '1', '1', '.'],
        ['.', 'H', '*', '.', '1', '1', '.'],
        ['.', '1', '*', '1', '.', '.', '1'],
        ['1', '.', '*', '1', '1', '.', '.'],
        ['.', '1', '.', '1', '1', '.', '.'],
        ['.', '1', '.', '.', '1', '1', '.'],
      ],
    },
    {
      fullName: 'Lynn',
      email: 'paper-demo-lynn@paper-demo.teamwise.test',
      shiftType: 'day',
      weeks: [
        ['1', '*', '.', '1', '1', '.', '.'],
        ['.', 'H', '.', '.', '1', '1', '.'],
        ['.', '.', '1', '.', '1', '1', '.'],
        ['.', '1', '.', '.', '1', '1', '.'],
        ['1', '1', '.', '1', '.', '.', '.'],
        ['.', '1', '1', '.', '.', '.', '1'],
      ],
    },
    {
      fullName: 'Lisa M',
      email: 'paper-demo-lisa-m@paper-demo.teamwise.test',
      shiftType: 'night',
      weeks: [
        ['.', '1', '.', '.', '.', '.', '1'],
        ['.', '1', '.', '.', '.', '.', '1'],
        ['.', '1', '.', '.', '.', '1', '.'],
        ['.', '1', '.', '.', '.', '1', '.'],
        ['.', '1', '.', '.', '.', '1', '.'],
        ['.', '1', '.', '.', '.', '.', '1'],
      ],
    },
    {
      fullName: 'Irene',
      email: 'paper-demo-irene@paper-demo.teamwise.test',
      shiftType: 'night',
      weeks: [
        ['*', '.', '.', '.', '.', '.', '1'],
        ['1', '.', '.', '.', '.', '.', '1'],
        ['1', '.', '.', '.', '.', '.', '*'],
        ['*', '.', '.', '.', '.', '.', '1'],
        ['H', '.', '.', '.', '.', '.', '1'],
        ['1', '.', '.', '.', '.', '.', '1'],
      ],
    },
  ],
}
