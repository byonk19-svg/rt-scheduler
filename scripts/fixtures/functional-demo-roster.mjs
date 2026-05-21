export const FUNCTIONAL_DEMO_DOMAIN = 'teamwise.test'
export const FUNCTIONAL_DEMO_PASSWORD = 'Teamwise123!'

export const FUNCTIONAL_DEMO_ROSTER = [
  {
    fullName: 'Julie D.',
    role: 'manager',
    shiftType: 'day',
    employmentType: 'full_time',
    login: true,
    emailLocal: 'julie.d',
  },
  {
    fullName: 'Adrienne',
    role: 'lead',
    shiftType: 'day',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Kim',
    role: 'lead',
    shiftType: 'day',
    employmentType: 'full_time',
    onFmla: true,
    login: true,
    emailLocal: 'kim',
  },
  {
    fullName: 'Brianna',
    role: 'lead',
    shiftType: 'day',
    employmentType: 'full_time',
    login: true,
    emailLocal: 'brianna',
  },
  {
    fullName: 'Barbara',
    role: 'lead',
    shiftType: 'day',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Layne',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'full_time',
    login: true,
    emailLocal: 'layne',
    requestWorkflowAnchor: true,
  },
  {
    fullName: 'Tannie',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Aleyce',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Lynn',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Lisa',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'prn',
    login: true,
    emailLocal: 'lisa',
  },
  {
    fullName: 'Irene',
    role: 'therapist',
    shiftType: 'day',
    employmentType: 'prn',
    login: true,
    emailLocal: 'irene',
  },
  {
    fullName: 'Kristine',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'prn',
    login: true,
    emailLocal: 'kristine',
  },
  {
    fullName: 'Matthew',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'prn',
    login: false,
  },
  {
    fullName: 'Rosa',
    role: 'lead',
    shiftType: 'night',
    employmentType: 'prn',
    login: true,
    emailLocal: 'rosa',
  },
  {
    fullName: 'Sarah',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Audbriana',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'full_time',
    login: true,
    emailLocal: 'audbriana',
  },
  {
    fullName: 'Gayle',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Julie C.',
    role: 'therapist',
    shiftType: 'night',
    employmentType: 'full_time',
    login: false,
    emailLocal: 'julie.c',
  },
  {
    fullName: 'Ruth',
    role: 'lead',
    shiftType: 'night',
    employmentType: 'full_time',
    login: true,
    emailLocal: 'ruth',
  },
  {
    fullName: 'Nicole',
    role: 'lead',
    shiftType: 'night',
    employmentType: 'full_time',
    login: false,
  },
  {
    fullName: 'Mark',
    role: 'lead',
    shiftType: 'night',
    employmentType: 'full_time',
    onFmla: true,
    login: true,
    emailLocal: 'mark',
  },
]

export function toSeedEmail(member, domain = FUNCTIONAL_DEMO_DOMAIN) {
  const local =
    member.emailLocal ??
    String(member.fullName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')

  return `${local}@${domain}`.toLowerCase()
}

function buildFunctionalDemoAccounts(domain = FUNCTIONAL_DEMO_DOMAIN) {
  return FUNCTIONAL_DEMO_ROSTER.filter((member) => member.login).map((member) =>
    toSeedEmail(member, domain)
  )
}

function getFunctionalDemoManager() {
  return FUNCTIONAL_DEMO_ROSTER.find((member) => member.role === 'manager' && member.login)
}

export function getFunctionalDemoRequestAnchor(domain = FUNCTIONAL_DEMO_DOMAIN) {
  const member = FUNCTIONAL_DEMO_ROSTER.find((row) => row.requestWorkflowAnchor)
  return member ? { ...member, email: toSeedEmail(member, domain) } : null
}

export function getFunctionalDemoLoginExamples(domain = FUNCTIONAL_DEMO_DOMAIN) {
  const manager = getFunctionalDemoManager()
  const dayLead = FUNCTIONAL_DEMO_ROSTER.find(
    (member) => member.login && member.role === 'lead' && member.shiftType === 'day'
  )
  const nightLead = FUNCTIONAL_DEMO_ROSTER.find(
    (member) => member.login && member.role === 'lead' && member.shiftType === 'night'
  )
  const staff = getFunctionalDemoRequestAnchor(domain)

  return [manager, dayLead, nightLead, staff].filter(Boolean).map((member) => ({
    label:
      member.role === 'manager'
        ? 'Manager'
        : member.role === 'lead'
          ? `${member.shiftType === 'night' ? 'Night' : 'Day'} lead`
          : 'Staff',
    name: member.fullName,
    email: member.email ?? toSeedEmail(member, domain),
  }))
}

export const FUNCTIONAL_DEMO_ACCOUNTS = buildFunctionalDemoAccounts()
